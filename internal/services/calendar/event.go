package calendar

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"
)

const (
	// SyncTimeRangeMonthsPast defines how many months in the past to fetch events during full sync
	SyncTimeRangeMonthsPast = 6
	// SyncTimeRangeMonthsFuture defines how many months in the future to fetch events during full sync
	SyncTimeRangeMonthsFuture = 6
)

// SyncStats tracks synchronization statistics
type SyncStats struct {
	EventsProcessed int
	EventsFailed    int
	StartTime       time.Time
	Duration        time.Duration
}

func (cs *CalendarService) SyncEvents(calendarSync *models.CalendarSync) error {
	// Create a context with a longer timeout for the entire sync operation
	// This context will be used for OAuth token refresh operations
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	logger.LogDebug("Syncing events right now", "calendarSyncId", calendarSync.Id)

	stats := &SyncStats{
		StartTime: time.Now(),
	}

	// Update status to syncing
	query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]interface{}{
		"in_progress": true,
		"sync_status": "syncing",
	})

	// Attempt sync with current sync token
	err := cs.performSync(ctx, calendarSync, stats)
	if err != nil {
		// Check if error is due to context cancellation (graceful shutdown)
		if err == context.Canceled {
			logger.LogInfo("Sync cancelled, will resume on next attempt", "calendarSyncId", calendarSync.Id)
			// Don't mark as failed - keep in_progress true so recovery can resume
			return err
		}

		// Check if error is due to inactive token or invalid grant (token expired/revoked)
		errMsg := strings.ToLower(err.Error())
		if strings.Contains(errMsg, "inactive") ||
			strings.Contains(errMsg, "please re-authenticate") ||
			strings.Contains(errMsg, "invalid_grant") ||
			strings.Contains(errMsg, "invalid or expired") {
			// Token is expired/invalid - sync is already marked as inactive by performSync
			logger.LogInfo("Calendar sync stopped due to expired token", "calendarSyncId", calendarSync.Id)
			// Don't mark as failed - it's inactive, not failed
			return err
		}

		// Check if error is due to invalid sync token (410)
		if e, ok := err.(*googleapi.Error); ok && e.Code == 410 {
			logger.LogInfo("Sync token invalid, retrying with full sync", "calendarSyncId", calendarSync.Id)

			// Clear the invalid sync token and checkpoint to start fresh
			query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]interface{}{
				"sync_token":                "",
				"last_full_sync_checkpoint": types.DateTime{},
			})

			// Reload calendar sync to get updated state
			updatedSync, err := query.FindById[*models.CalendarSync](calendarSync.Id)
			if err != nil {
				logger.LogError("Failed to reload calendar sync after clearing token", "error", err)
				query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]interface{}{
					"in_progress": false,
					"sync_status": "failed",
				})
				return err
			}

			// Retry with full sync (no sync token)
			logger.LogInfo("Retrying calendar sync with full sync", "calendarSyncId", calendarSync.Id)
			err = cs.performSync(ctx, updatedSync, stats)
			if err != nil {
				if err == context.Canceled {
					return err
				}
				// Check again for inactive token error
				errMsg := strings.ToLower(err.Error())
				if strings.Contains(errMsg, "inactive") ||
					strings.Contains(errMsg, "please re-authenticate") ||
					strings.Contains(errMsg, "invalid_grant") {
					return err // Already handled by performSync
				}
				logger.LogError("Failed to sync after retry with full sync", "error", err)
				query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]interface{}{
					"in_progress": false,
					"sync_status": "failed",
				})
				return err
			}

			logger.LogInfo("Successfully completed full sync after invalid token recovery", "calendarSyncId", calendarSync.Id)
			return nil
		}

		// For other errors, mark as failed but keep checkpoint for recovery
		logger.LogError("Error during calendar sync", "error", err, "calendarSyncId", calendarSync.Id)
		// Checkpoint will be preserved by performSync on failure
		query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]interface{}{
			"in_progress": false,
			"sync_status": "failed",
		})
		return err
	}

	stats.Duration = time.Since(stats.StartTime)
	logger.LogInfo(fmt.Sprintf("Calendar sync completed: processed %d events, %d failed in %v",
		stats.EventsProcessed, stats.EventsFailed, stats.Duration))

	return nil
}

// performSync performs the actual calendar sync operation
// It supports resuming from checkpoint if sync was interrupted
func (cs *CalendarService) performSync(ctx context.Context, calendarSync *models.CalendarSync, stats *SyncStats) error {
	client, err := cs.FetchClient(ctx, calendarSync.Token)
	if err != nil {
		// Check if error is about inactive token or invalid grant
		errMsg := strings.ToLower(err.Error())
		if strings.Contains(errMsg, "is marked as inactive") ||
			strings.Contains(errMsg, "please re-authenticate") ||
			strings.Contains(errMsg, "invalid_grant") ||
			strings.Contains(errMsg, "invalid or expired") {
			// Mark calendar sync as inactive
			updateData := map[string]interface{}{
				"is_active":   false,
				"sync_status": "inactive",
				"in_progress": false,
			}
			if updateErr := query.UpdateRecord[*models.CalendarSync](calendarSync.Id, updateData); updateErr != nil {
				logger.LogError(fmt.Sprintf("Failed to mark calendar sync %s as inactive", calendarSync.Id), updateErr)
			}
			logger.LogInfo(fmt.Sprintf("Calendar sync %s marked as inactive due to token expiration", calendarSync.Id))
			return fmt.Errorf("calendar sync is inactive: token expired - please re-authenticate: %w", err)
		}
		logger.LogError("Failed fetching client", "error", err)
		return fmt.Errorf("failed to fetch OAuth client: %w", err)
	}

	logger.LogDebug("Fetched client")
	calendarService, err := calendar.NewService(ctx, option.WithHTTPClient(client))

	if err != nil {
		logger.LogError("Unable to create calendar service", "error", err)
		return err
	}

	useSyncToken := calendarSync.SyncToken != ""
	var timeMin, timeMax string
	var oldestProcessedDate time.Time
	var oldestProcessedMutex sync.Mutex

	// Determine if we're resuming from checkpoint
	isResuming := false
	if !useSyncToken && !calendarSync.LastFullSyncCheckpoint.IsZero() {
		// Resuming full sync from checkpoint
		isResuming = true
		oldestProcessedDate = calendarSync.LastFullSyncCheckpoint.Time()
		timeMin = oldestProcessedDate.Format(time.RFC3339)
		timeMax = time.Now().AddDate(0, SyncTimeRangeMonthsFuture, 0).Format(time.RFC3339)
		logger.LogInfo("Resuming full sync from checkpoint", "checkpoint", oldestProcessedDate, "calendarSyncId", calendarSync.Id)
	} else if !useSyncToken {
		// Starting fresh full sync
		timeMin = time.Now().AddDate(0, -SyncTimeRangeMonthsPast, 0).Format(time.RFC3339)
		timeMax = time.Now().AddDate(0, SyncTimeRangeMonthsFuture, 0).Format(time.RFC3339)
		logger.LogDebug("Starting fresh full sync", "timeMin", timeMin, "timeMax", timeMax, "pastMonths", SyncTimeRangeMonthsPast, "futureMonths", SyncTimeRangeMonthsFuture)
	}

	const numWorkers = 5
	eventsChannel := make(chan *calendar.Event, 100)
	errorChannel := make(chan error, numWorkers)
	var wg sync.WaitGroup
	checkpointUpdateInterval := 50 // Update checkpoint every 50 events
	lastCheckpointUpdate := 0

	// Start worker goroutines with context cancellation support
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					logger.LogInfo(fmt.Sprintf("Worker %d: context cancelled, stopping", workerID))
					return
				case event, ok := <-eventsChannel:
					if !ok {
						// Channel closed, no more events
						return
					}

					// If resuming, skip events that are newer than or equal to checkpoint
					if isResuming && !oldestProcessedDate.IsZero() {
						var eventStart time.Time
						var err error
						// Handle both DateTime (regular events) and Date (all-day events)
						if event.Start.DateTime != "" {
							eventStart, err = time.Parse(time.RFC3339, event.Start.DateTime)
						} else if event.Start.Date != "" {
							eventStart, err = time.Parse("2006-01-02", event.Start.Date)
						}
						if err == nil {
							// If event start is newer than or equal to checkpoint, it's already processed
							if !eventStart.Before(oldestProcessedDate) {
								continue
							}
						}
					}

					// Process event
					if err := InsertEvent(event, calendarSync.User, calendarSync.Id); err != nil {
						stats.EventsFailed++
						logger.LogError(fmt.Sprintf("Worker %d failed to insert event %s", workerID, event.Id), err)
						select {
						case errorChannel <- fmt.Errorf("worker %d: event %s: %w", workerID, event.Id, err):
						default:
						}
					} else {
						stats.EventsProcessed++
						// Update oldest processed date for checkpoint tracking (only for full sync)
						if !useSyncToken {
							var eventStart time.Time
							var err error
							// Handle both DateTime (regular events) and Date (all-day events)
							if event.Start.DateTime != "" {
								eventStart, err = time.Parse(time.RFC3339, event.Start.DateTime)
							} else if event.Start.Date != "" {
								eventStart, err = time.Parse("2006-01-02", event.Start.Date)
							}
							if err == nil {
								oldestProcessedMutex.Lock()
								if oldestProcessedDate.IsZero() || eventStart.Before(oldestProcessedDate) {
									oldestProcessedDate = eventStart
								}
								oldestProcessedMutex.Unlock()
							}
						}
					}
				}
			}
		}(i)
	}

	// Note: Error monitoring is done after workers finish

	var lastNextSyncToken string // Store NextSyncToken from last successful response
	pageToken := ""              // Start from beginning (checkpoint handles resume)

	defer func() {
		close(eventsChannel)
		wg.Wait()
		close(errorChannel)
	}()

	for {
		// Check for context cancellation
		select {
		case <-ctx.Done():
			logger.LogInfo("Sync cancelled, saving checkpoint", "calendarSyncId", calendarSync.Id, "eventsProcessed", stats.EventsProcessed)
			// Save checkpoint for resume
			oldestProcessedMutex.Lock()
			currentOldest := oldestProcessedDate
			oldestProcessedMutex.Unlock()

			if !currentOldest.IsZero() && !useSyncToken {
				checkpointUpdate := types.DateTime{}
				checkpointUpdate.Scan(currentOldest)
				checkpointData := map[string]interface{}{
					"last_full_sync_checkpoint": checkpointUpdate,
				}
				query.UpdateRecord[*models.CalendarSync](calendarSync.Id, checkpointData)
			}
			return context.Canceled
		default:
		}

		logger.LogDebug("Fetching events page", "pageToken", pageToken, "eventsProcessed", stats.EventsProcessed)

		// Create a new request for each page
		pageRequest := calendarService.Events.List(calendarSync.Type)
		if useSyncToken {
			pageRequest.SyncToken(calendarSync.SyncToken)
		} else {
			pageRequest.TimeMin(timeMin)
			pageRequest.TimeMax(timeMax)
		}

		if pageToken != "" {
			pageRequest.PageToken(pageToken)
		}

		events, err := pageRequest.SingleEvents(true).Do()
		if err != nil {
			// Check for rate limiting (429)
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "rate limit") || strings.Contains(errMsg, "quota exceeded") {
				logger.LogWarning("Google Calendar API rate limit hit during event listing, will retry on next sync")
				// Preserve checkpoint before returning
				oldestProcessedMutex.Lock()
				currentOldest := oldestProcessedDate
				oldestProcessedMutex.Unlock()

				if !currentOldest.IsZero() && !useSyncToken {
					checkpointUpdate := types.DateTime{}
					checkpointUpdate.Scan(currentOldest)
					checkpointData := map[string]interface{}{
						"last_full_sync_checkpoint": checkpointUpdate,
					}
					query.UpdateRecord[*models.CalendarSync](calendarSync.Id, checkpointData)
				}
				return fmt.Errorf("rate limit exceeded: %w", err)
			}
			// Return error to be handled by caller (especially 410 errors)
			return err
		}

		logger.LogDebug("Got events", "count", len(events.Items))

		if len(events.Items) == 0 {
			logger.LogDebug("No new events to sync")
			// Store NextSyncToken for future incremental syncs
			if events.NextSyncToken != "" {
				lastNextSyncToken = events.NextSyncToken
			}
			break
		}

		// Send events to workers
		for _, event := range events.Items {
			select {
			case <-ctx.Done():
				// Save checkpoint before returning
				oldestProcessedMutex.Lock()
				currentOldest := oldestProcessedDate
				oldestProcessedMutex.Unlock()

				if !currentOldest.IsZero() && !useSyncToken {
					checkpointUpdate := types.DateTime{}
					checkpointUpdate.Scan(currentOldest)
					checkpointData := map[string]interface{}{
						"last_full_sync_checkpoint": checkpointUpdate,
					}
					query.UpdateRecord[*models.CalendarSync](calendarSync.Id, checkpointData)
				}
				return context.Canceled
			case eventsChannel <- event:
				// Event sent to worker, will be counted when processed
			}
		}

		// Periodically update checkpoint during full sync
		if !useSyncToken && stats.EventsProcessed-lastCheckpointUpdate >= checkpointUpdateInterval {
			oldestProcessedMutex.Lock()
			currentOldest := oldestProcessedDate
			oldestProcessedMutex.Unlock()

			if !currentOldest.IsZero() {
				checkpointUpdate := types.DateTime{}
				checkpointUpdate.Scan(currentOldest)
				updateData := map[string]interface{}{
					"last_full_sync_checkpoint": checkpointUpdate,
				}
				if updateErr := query.UpdateRecord[*models.CalendarSync](calendarSync.Id, updateData); updateErr != nil {
					logger.LogError(fmt.Sprintf("Failed to update checkpoint for calendar sync %s", calendarSync.Id), updateErr)
				} else {
					logger.LogInfo(fmt.Sprintf("Updated checkpoint to %v (processed %d events)", currentOldest, stats.EventsProcessed))
				}
				lastCheckpointUpdate = stats.EventsProcessed
			}
		}

		// Store NextSyncToken from response (for incremental sync)
		if events.NextSyncToken != "" {
			lastNextSyncToken = events.NextSyncToken
		}

		pageToken = events.NextPageToken
		if pageToken == "" {
			break
		}
	}

	// Wait for all workers to finish and check for errors
	var syncError error
	select {
	case err := <-errorChannel:
		if err != nil {
			syncError = fmt.Errorf("error during sync: %w", err)
		}
	default:
	}

	// Prepare update data
	updateData := map[string]interface{}{}

	// On successful sync completion:
	// 1. Clear the full sync checkpoint (we're done with full sync)
	// 2. Set sync_token to NextSyncToken (for future incremental syncs)
	// 3. Update last_synced timestamp
	if syncError == nil {
		// Sync completed successfully
		updateData["last_full_sync_checkpoint"] = nil // Clear checkpoint
		updateData["last_synced"] = types.NowDateTime()
		updateData["in_progress"] = false
		if useSyncToken {
			updateData["sync_status"] = "no change"
		} else {
			updateData["sync_status"] = "added"
		}
		// Set sync_token to NextSyncToken for future incremental syncs
		if lastNextSyncToken != "" {
			updateData["sync_token"] = lastNextSyncToken
		}
		logger.LogInfo(fmt.Sprintf("Sync completed successfully, cleared checkpoint (processed %d events, %d failed)",
			stats.EventsProcessed, stats.EventsFailed))
	} else {
		// Sync failed - preserve checkpoint so we can resume
		// Update checkpoint with the oldest event we processed (even if < 50 events)
		oldestProcessedMutex.Lock()
		finalOldest := oldestProcessedDate
		oldestProcessedMutex.Unlock()

		if !finalOldest.IsZero() && !useSyncToken {
			checkpointUpdate := types.DateTime{}
			checkpointUpdate.Scan(finalOldest)
			updateData["last_full_sync_checkpoint"] = checkpointUpdate
			logger.LogInfo(fmt.Sprintf("Sync failed, preserving checkpoint at %v for resume (processed %d events, %d failed)",
				finalOldest, stats.EventsProcessed, stats.EventsFailed))
		} else if stats.EventsProcessed > 0 && !useSyncToken {
			// If we processed events but oldestProcessedDate is still zero (edge case)
			// Try to recover checkpoint from the oldest processed event in database
			allEvents, findErr := query.FindAllByFilter[*models.CalendarEvent](map[string]interface{}{
				"calendar": calendarSync.Id,
			})
			if findErr == nil && len(allEvents) > 0 {
				// Find the oldest event by start date
				var oldestEvent *models.CalendarEvent
				for _, event := range allEvents {
					if oldestEvent == nil ||
						(!event.Start.IsZero() &&
							(oldestEvent.Start.IsZero() || event.Start.Time().Before(oldestEvent.Start.Time()))) {
						oldestEvent = event
					}
				}
				if oldestEvent != nil && !oldestEvent.Start.IsZero() {
					updateData["last_full_sync_checkpoint"] = oldestEvent.Start
					logger.LogInfo(fmt.Sprintf("Sync failed, preserving checkpoint from oldest event at %v (processed %d events but oldest date not tracked)",
						oldestEvent.Start, stats.EventsProcessed))
				}
			}
		}
		updateData["in_progress"] = false
		updateData["sync_status"] = "failed"
		// Don't update sync_token or last_synced on failure
	}

	if len(updateData) > 0 {
		if err := query.UpdateRecord[*models.CalendarSync](calendarSync.Id, updateData); err != nil {
			logger.LogError(fmt.Sprintf("Failed to update sync state for calendar sync %s", calendarSync.Id), err)
			// Don't fail the sync if we can't update the state, but log it
		}
	}

	// Return the sync error if there was one
	if syncError != nil {
		return syncError
	}

	return nil
}

func InsertEvent(event *calendar.Event, userId string, calendarSyncId string) error {

	eventModel := &models.CalendarEvent{
		CalendarId:     event.Id,
		CalendarUId:    event.ICalUID,
		User:           userId,
		Calendar:       calendarSyncId,
		Etag:           event.Etag,
		Summary:        event.Summary,
		Description:    event.Description,
		EventType:      event.EventType,
		Creator:        event.Creator.DisplayName,
		CreatorEmail:   event.Creator.Email,
		Organizer:      event.Organizer.DisplayName,
		OrganizerEmail: event.Organizer.Email,
		Kind:           event.Kind,
		Location:       event.Location,
		Status:         event.Status,
	}

	if calendarStart, err := types.ParseDateTime(event.Start.DateTime); err == nil {
		eventModel.Start = calendarStart
	}
	if calendarEnd, err := types.ParseDateTime(event.End.DateTime); err == nil {
		eventModel.End = calendarEnd
	}
	if calendarEventCreated, err := types.ParseDateTime(event.Created); err == nil {
		eventModel.EventCreated = calendarEventCreated
	}
	if calendarEventUpdated, err := types.ParseDateTime(event.Updated); err == nil {
		eventModel.EventUpdated = calendarEventUpdated
	}

	query.UpsertRecord[*models.CalendarEvent](eventModel, map[string]interface{}{
		"calendar_id": event.Id,
	})

	return nil
}

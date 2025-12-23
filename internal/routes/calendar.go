package routes

import (
	"fmt"
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/calendar"
	"github.com/shashank-sharma/backend/internal/services/oauth"
	"github.com/shashank-sharma/backend/internal/util"
)

type SyncCalendarAPI struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	TokenId string `json:"token_id"`
}

type CalendarTokenAPI struct {
	Code     string `json:"code"`
	Provider string `json:"provider"`
}

func RegisterCalendarRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, calendarService *calendar.CalendarService) {
	calendarRouter := apiRouter.Group(path)
	calendarRouter.GET("/auth/redirect", func(e *core.RequestEvent) error {
		return CalendarAuthHandler(calendarService, e)
	})
	calendarRouter.POST("/auth/callback", func(e *core.RequestEvent) error {
		return CalendarAuthCallback(calendarService, e)
	})
	calendarRouter.POST("/sync", func(e *core.RequestEvent) error {
		return CalendarSyncHandler(calendarService, e)
	})
	calendarRouter.POST("/create", func(e *core.RequestEvent) error {
		return CalendarCreateSync(calendarService, e)
	})
}

func CalendarAuthHandler(cs *calendar.CalendarService, e *core.RequestEvent) error {
	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{"url": cs.GetAuthUrl()})
}

func CalendarAuthCallback(cs *calendar.CalendarService, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	calTokenData := &CalendarTokenAPI{}
	if err := e.BindBody(calTokenData); err != nil {
		logger.LogError("Failed to parse request body", "error", err)
		return util.RespondError(e, util.NewBadRequestError("Invalid request body"))
	}

	googleConfig := cs.GetConfig()
	token, err := googleConfig.Exchange(e.Request.Context(), calTokenData.Code)
	if err != nil {
		logger.LogError("Token exchange failed", "error", err)
		return util.RespondError(e, util.ErrUnauthorized)
	}

	client := googleConfig.Client(e.Request.Context(), token)
	userInfo, err := oauth.FetchUserInfo(client)
	if err != nil {
		logger.LogError("Failed to fetch user info", "error", err)
		return util.RespondError(e, util.ErrUnauthorized)
	}

	expiry := types.DateTime{}
	expiry.Scan(token.Expiry)

	calToken := &models.Token{
		User:         userId,
		Provider:     "google_calendar",
		Account:      userInfo.Email,
		AccessToken:  token.AccessToken,
		TokenType:    token.TokenType,
		RefreshToken: token.RefreshToken,
		Expiry:       expiry,
		Scope:        token.TokenType,
		IsActive:     true,
	}

	// Use typed filter for token upsert
	tokenFilter := &query.TokenFilter{
		BaseFilter: query.BaseFilter{},
		Provider:   "google_calendar",
		Account:    userInfo.Email,
	}
	if err := query.UpsertRecord[*models.Token](calToken, tokenFilter.ToMap()); err != nil {
		logger.LogError("Failed to save token", "error", err, "userId", userId)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}
	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"message":  "Authenticated successfully",
		"token":    calToken,
		"token_id": calToken.Id,
	})
}

func CalendarSyncHandler(cs *calendar.CalendarService, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	// Use typed filter for calendar sync query
	isActive := true
	filter := &query.CalendarSyncFilter{
		BaseFilter: query.BaseFilter{
			User:     userId,
			IsActive: &isActive,
		},
	}
	calendarSync, err := query.FindByFilter[*models.CalendarSync](filter.ToMap())

	if err != nil {
		return util.RespondError(e, util.ErrNotFound)
	}

	// Send realtime notification that sync started (user-specific) using builder pattern
	go func() {
		if err := util.Notify(e.App).ToUser(userId).Info("Calendar sync started").Send(); err != nil {
			logger.LogError("Failed to send realtime notification", "error", err)
		}
	}()

	go cs.SyncEvents(calendarSync)
	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{"message": "Sync started"})
}

func CalendarCreateSync(cs *calendar.CalendarService, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	data := &SyncCalendarAPI{}

	if err := e.BindBody(data); err != nil {
		logger.LogError("Failed to parse request body", "error", err)
		return util.RespondError(e, util.NewBadRequestError("Invalid request body"))
	}

	if data.Name == "" {
		return util.RespondError(e, util.NewValidationError("name", "Name is required"))
	}

	// Use typed filter for calendar sync query
	isActive := true
	filter := &query.CalendarSyncFilter{
		BaseFilter: query.BaseFilter{
			User:     userId,
			IsActive: &isActive,
		},
		Token: data.TokenId,
	}
	calToken, err := query.FindByFilter[*models.CalendarSync](filter.ToMap())

	logger.LogDebug("Found calToken", calToken, err)

	if calToken != nil {
		return util.RespondError(e, util.NewBadRequestError("Calendar sync already exists"))
	}

	calendarSync := &models.CalendarSync{
		User:       userId,
		Token:      data.TokenId,
		Name:       data.Name,
		Type:       data.Type,
		SyncStatus: "pending",
		IsActive:   true,
		InProgress: true,
	}

	if err := query.SaveRecord(calendarSync); err != nil {
		logger.LogError("Failed to create calendar sync", "error", err, "userId", userId)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	go func() {
		if err := cs.SyncEvents(calendarSync); err != nil {
			logger.LogError("Error in syncing events", err)
			query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]interface{}{
				"in_progress": false,
				"sync_status": "failed",
			})
			// Send error notification (user-specific) using builder pattern
			if notifyErr := util.Notify(e.App).ToUser(userId).Error("Calendar sync failed").Send(); notifyErr != nil {
				logger.LogError("Failed to send error notification", "error", notifyErr)
			}
		} else {
			query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]interface{}{
				"in_progress": false,
				"sync_status": "success",
			})
			// Send success notification (user-specific) using builder pattern
			if notifyErr := util.Notify(e.App).ToUser(userId).Success("Calendar sync completed successfully").Send(); notifyErr != nil {
				logger.LogError("Failed to send success notification", "error", notifyErr)
			}
		}
	}()

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{"message": "Calendar sync created", "data": calendarSync})
}

// ResetStaleCalendarSyncStatuses detects and resumes calendar syncs that were interrupted
// (e.g., due to server crash). It resumes the sync using available checkpoints.
func ResetStaleCalendarSyncStatuses(cs *calendar.CalendarService) error {
	logger.LogInfo("Checking for stale calendar sync statuses...")

	// Find all calendar syncs with in_progress = true (stale syncs from crash)
	staleSyncs, err := query.FindAllByFilter[*models.CalendarSync](map[string]interface{}{
		"in_progress": true,
	})
	if err != nil {
		logger.LogError("Failed to query stale calendar sync statuses", err)
		return err
	}

	if len(staleSyncs) == 0 {
		logger.LogInfo("No stale calendar sync statuses found")
		return nil
	}

	logger.LogInfo(fmt.Sprintf("Found %d stale calendar sync(s), resuming sync with checkpoint", len(staleSyncs)))

	// Resume each stale sync using the checkpoint
	resumedCount := 0
	for _, calendarSync := range staleSyncs {
		// Check if calendar sync is active before resuming
		if !calendarSync.IsActive {
			logger.LogInfo(fmt.Sprintf("Skipping inactive calendar sync %s (user: %s)", calendarSync.Id, calendarSync.User))
			// Set status to inactive instead of in_progress
			updateData := map[string]interface{}{
				"in_progress": false,
				"sync_status": "inactive",
			}
			if err := query.UpdateRecord[*models.CalendarSync](calendarSync.Id, updateData); err != nil {
				logger.LogError(fmt.Sprintf("Failed to update inactive sync status for calendar sync %s", calendarSync.Id), err)
			}
			continue
		}

		// Reload the calendar sync to get latest state
		reloadedSync, err := query.FindById[*models.CalendarSync](calendarSync.Id)
		if err != nil {
			logger.LogError(fmt.Sprintf("Failed to reload calendar sync %s", calendarSync.Id), err)
			continue
		}

		// Recovery logic for stale syncs:
		// 1. If full sync checkpoint exists -> resume full sync from checkpoint
		// 2. If sync_token exists but no checkpoint -> use incremental sync (normal case)
		// 3. If neither exists -> start fresh full sync
		hasCheckpoint := !reloadedSync.LastFullSyncCheckpoint.IsZero()
		hasSyncToken := reloadedSync.SyncToken != ""

		if hasCheckpoint {
			logger.LogInfo(fmt.Sprintf("Calendar sync %s has full sync checkpoint at %v, will resume full sync",
				reloadedSync.Id, reloadedSync.LastFullSyncCheckpoint))
		} else if hasSyncToken {
			logger.LogInfo(fmt.Sprintf("Calendar sync %s has sync token, will use incremental sync",
				reloadedSync.Id))
		} else {
			// Try to recover checkpoint from database (oldest event's start date)
			// If events exist, we should resume full sync from that point
			allEvents, findErr := query.FindAllByFilter[*models.CalendarEvent](map[string]interface{}{
				"calendar": reloadedSync.Id,
			})
			if findErr == nil && len(allEvents) > 0 {
				// Find the oldest event by start date to use as checkpoint
				var oldestEvent *models.CalendarEvent
				for _, event := range allEvents {
					if oldestEvent == nil ||
						(!event.Start.IsZero() &&
							(oldestEvent.Start.IsZero() || event.Start.Time().Before(oldestEvent.Start.Time()))) {
						oldestEvent = event
					}
				}
				if oldestEvent != nil && !oldestEvent.Start.IsZero() {
					// Events exist but no checkpoint - recover checkpoint from oldest event
					// This means full sync was interrupted before checkpoint was saved
					checkpointUpdate := types.DateTime{}
					checkpointUpdate.Scan(oldestEvent.Start.Time())
					updateData := map[string]interface{}{
						"last_full_sync_checkpoint": checkpointUpdate,
					}
					if updateErr := query.UpdateRecord[*models.CalendarSync](reloadedSync.Id, updateData); updateErr == nil {
						reloadedSync.LastFullSyncCheckpoint = checkpointUpdate
						logger.LogInfo(fmt.Sprintf("Recovered full sync checkpoint from oldest event for calendar sync %s: %v (will resume full sync)",
							reloadedSync.Id, checkpointUpdate))
					} else {
						logger.LogError(fmt.Sprintf("Failed to save recovered checkpoint for calendar sync %s", reloadedSync.Id), updateErr)
					}
				}
			} else {
				// No events exist - this is truly a fresh sync
				logger.LogInfo(fmt.Sprintf("Calendar sync %s has no checkpoint, no page token, and no events - will start fresh full sync",
					reloadedSync.Id))
			}
		}

		// Resume sync in background (it will use checkpoint if available)
		go func(sync *models.CalendarSync) {
			logger.LogInfo(fmt.Sprintf("Resuming stale sync for calendar sync %s (user: %s, checkpoint: %v)",
				sync.Id, sync.User, sync.LastFullSyncCheckpoint))

			err := cs.SyncEvents(sync)

			updateData := map[string]interface{}{}
			if err != nil {
				logger.LogError(fmt.Sprintf("Failed to resume stale calendar sync %s", sync.Id), err)
				updateData["sync_status"] = "failed"
				updateData["in_progress"] = false
			} else {
				logger.LogInfo(fmt.Sprintf("Successfully resumed stale calendar sync %s", sync.Id))
				updateData["sync_status"] = "success"
				updateData["in_progress"] = false
			}

			if updateErr := query.UpdateRecord[*models.CalendarSync](sync.Id, updateData); updateErr != nil {
				logger.LogError(fmt.Sprintf("Failed to update sync status for calendar sync %s", sync.Id), updateErr)
			}
		}(reloadedSync)

		resumedCount++
	}

	logger.LogInfo(fmt.Sprintf("Initiated recovery for %d stale calendar sync(s)", resumedCount))
	return nil
}

package calendar

import (
	"context"
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

func (cs *CalendarService) SyncEvents(calendarSync *models.CalendarSync) error {
	logger.LogDebug("Syncing events right now")
	query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]interface{}{
		"in_progress": true,
		"sync_status": "syncing",
	})
	client, err := cs.FetchClient(calendarSync.Token)
	if err != nil {
		logger.LogError("Failed fetching client", "error", err)
		return err
	}

	logger.LogDebug("Fetched client")
	calendarService, err := calendar.NewService(context.Background(), option.WithHTTPClient(client))

	if err != nil {
		logger.LogError("Unable to create calendar service", "error", err)
		return err
	}

	request := calendarService.Events.List(calendarSync.Type)
	logger.LogDebug("Request: ", request)
	if calendarSync.SyncToken != "" {
		request.SyncToken(calendarSync.SyncToken)
	} else {
		timeMin := time.Now().AddDate(0, -2, 0).Format(time.RFC3339)
		timeMax := time.Now().AddDate(0, 2, 0).Format(time.RFC3339)

		request.TimeMin(timeMin)
		request.TimeMax(timeMax)
	}

	eventsChannel := make(chan *calendar.Event)
	var wg sync.WaitGroup

	const numWorkers = 5
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for event := range eventsChannel {
				InsertEvent(event, calendarSync.User, calendarSync.Id)
			}
		}()
	}

	pageToken := ""
	for {
		logger.LogDebug("Starting here")
		request.PageToken(pageToken)
		events, err := request.SingleEvents(true).Do()
		logger.LogDebug("Got events")
		if err != nil {
			if e, ok := err.(*googleapi.Error); ok && e.Code == 410 {
				logger.LogError("Invalid sync token", "error", err)
				return err
			}
			logger.LogError("Error fetching events", "error", err)
			return err
		}
		if len(events.Items) == 0 {
			logger.LogDebug("No new events to sync")
			query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]any{
				"sync_token":  events.NextSyncToken,
				"last_synced": types.NowDateTime(),
				"in_progress": false,
				"sync_status": "no change",
			})
			break
		}

		for _, event := range events.Items {
			eventsChannel <- event
		}

		pageToken = events.NextPageToken
		if pageToken == "" {
			query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]any{
				"sync_token":  events.NextSyncToken,
				"last_synced": types.NowDateTime(),
				"in_progress": false,
				"sync_status": "added",
			})
			break
		}
	}

	close(eventsChannel)
	wg.Wait()

	logger.LogDebug("Returning now")
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
		eventModel.EventCreated = calendarEventUpdated
	}

	query.UpsertRecord[*models.CalendarEvent](eventModel, map[string]interface{}{
		"calendar_id": event.Id,
	})

	return nil
}

package routes

import (
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
	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{"message": "Authenticated successfully", "token": calToken})
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

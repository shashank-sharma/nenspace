package routes

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase/apis"
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
	return e.JSON(http.StatusOK, map[string]interface{}{"url": cs.GetAuthUrl()})
}

func CalendarAuthCallback(cs *calendar.CalendarService, e *core.RequestEvent) error {
	pbToken := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(pbToken)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Invalid authorization",
		})
	}

	calTokenData := &CalendarTokenAPI{}
	if err := e.BindBody(calTokenData); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid input")
	}

	googleConfig := cs.GetConfig()
	token, err := googleConfig.Exchange(context.Background(), calTokenData.Code)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Invalid token exchange"})
	}

	client := googleConfig.Client(context.Background(), token)
	userInfo, err := oauth.FetchUserInfo(client)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Failed to fetch userinfo"})
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

	if err := query.UpsertRecord[*models.Token](calToken, map[string]interface{}{
		"provider": "google_calendar",
		"account":  userInfo.Email,
	}); err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Error saving token",
		})
	}
	return e.JSON(http.StatusOK, map[string]interface{}{"message": "Authenticated successfully", "token": calToken})
}

func CalendarSyncHandler(cs *calendar.CalendarService, e *core.RequestEvent) error {
	pbToken := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(pbToken)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Invalid authorization",
		})
	}

	calendarSync, err := query.FindByFilter[*models.CalendarSync](map[string]interface{}{
		"user":      userId,
		"is_active": true,
	})

	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Calendar sync not found"})
	}

	go cs.SyncEvents(calendarSync)
	return e.JSON(http.StatusOK, map[string]interface{}{"message": "Sync started"})
}

func CalendarCreateSync(cs *calendar.CalendarService, e *core.RequestEvent) error {
	pbToken := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(pbToken)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Invalid authorization",
		})
	}

	data := &SyncCalendarAPI{}

	if err := e.BindBody(data); err != nil || data.Name == "" {
		logger.LogError("Error in parsing =", err)
		return apis.NewBadRequestError("Failed to read request data", err)
	}

	calToken, err := query.FindByFilter[*models.CalendarSync](map[string]interface{}{
		"user":      userId,
		"token":     data.TokenId,
		"is_active": true,
	})

	logger.LogDebug("Found calToken", calToken, err)

	if calToken != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Calendar sync already exists"})
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
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Error creating calendar sync"})
	}

	go func() {
		if err := cs.SyncEvents(calendarSync); err != nil {
			logger.LogError("Error in syncing events", err)
			query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]interface{}{
				"in_progress": false,
				"sync_status": "failed",
			})
		} else {
			query.UpdateRecord[*models.CalendarSync](calendarSync.Id, map[string]interface{}{
				"in_progress": false,
				"sync_status": "success",
			})
		}
	}()

	return e.JSON(http.StatusOK, map[string]interface{}{"message": "Calendar sync created", "data": calendarSync})
}

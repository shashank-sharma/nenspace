package routes

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/mail"
	"github.com/shashank-sharma/backend/internal/services/oauth"
	"github.com/shashank-sharma/backend/internal/util"
)

type MailAuthData struct {
	Code     string `json:"code"`
	Provider string `json:"provider"`
}

func RegisterMailRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, mailService *mail.MailService) {
	// Mail
	mailRouter := apiRouter.Group(path)
	mailRouter.GET("/auth/redirect", func(e *core.RequestEvent) error {
		return MailAuthHandler(mailService, e)
	})

	mailRouter.POST("/auth/callback", func(e *core.RequestEvent) error {
		return MailAuthCallback(mailService, e)
	})

	mailRouter.POST("/sync", func(e *core.RequestEvent) error {
		return MailSyncHandler(mailService, e)
	})

	mailRouter.GET("/sync/status", func(e *core.RequestEvent) error {
		return MailSyncStatusHandler(mailService, e)
	})
}

// MailAuthHandler initiates the OAuth flow for Gmail
func MailAuthHandler(ms *mail.MailService, e *core.RequestEvent) error {
	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"url": ms.GetAuthUrl(),
	})
}

// MailAuthCallback handles the OAuth callback from Gmail
func MailAuthCallback(ms *mail.MailService, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	mailAuthData := &MailAuthData{}
	if err := e.BindBody(mailAuthData); err != nil {
		logger.LogError("Failed to parse request body", "error", err)
		return util.RespondError(e, util.NewBadRequestError("Invalid request body"))
	}

	googleConfig := ms.GetConfig()
	token, err := googleConfig.Exchange(e.Request.Context(), mailAuthData.Code)
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

	mailToken := &models.Token{
		User:         userId,
		Provider:     "gmail",
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
		Provider:   "gmail",
		Account:    userInfo.Email,
	}
	if err := query.UpsertRecord[*models.Token](mailToken, tokenFilter.ToMap()); err != nil {
		logger.LogError("Failed to save token", "error", err, "userId", userId)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	_, err = ms.InitializeLabels(mailToken.Id, userId)
	if err != nil {
		logger.LogError("Failed to initialize labels", "error", err, "userId", userId)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"message": "Mail authentication successful",
	})
}

// MailSyncHandler triggers a non-blocking mail sync
func MailSyncHandler(ms *mail.MailService, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	// Find active mail sync configuration using typed filter
	// TODO: Assumption that mailsync is possible by only 1 provider
	isActive := true
	filter := &query.MailSyncFilter{
		BaseFilter: query.BaseFilter{
			User:     userId,
			IsActive: &isActive,
		},
	}
	mailSync, err := query.FindByFilter[*models.MailSync](filter.ToMap())
	if err != nil {
		return util.RespondError(e, util.ErrNotFound)
	}

	syncStatus := map[string]interface{}{
		"sync_status": "in_progress",
		"last_synced": types.NowDateTime(),
	}

	if err := query.UpdateRecord[*models.MailSync](mailSync.Id, syncStatus); err != nil {
		logger.LogError("Failed to update sync status", err)
	}

	go func() {
		logger.LogInfo("Starting async mail sync for user: " + userId)

		err := ms.SyncMessages(mailSync)

		var finalStatus string
		if err != nil {
			logger.LogError("Mail sync failed", err)
			finalStatus = "failed"
		} else {
			finalStatus = "completed"
		}

		if err := query.UpdateRecord[*models.MailSync](mailSync.Id, map[string]interface{}{
			"sync_status": finalStatus,
		}); err != nil {
			logger.LogError("Failed to update final sync status", err)
		}
	}()

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"message": "Mail sync started in background",
		"status":  "in_progress",
	})
}

// MailSyncStatusHandler checks the status of the mail sync
func MailSyncStatusHandler(ms *mail.MailService, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	// Use typed filter for mail sync query
	isActive := true
	filter := &query.MailSyncFilter{
		BaseFilter: query.BaseFilter{
			User:     userId,
			IsActive: &isActive,
		},
	}
	mailSync, err := query.FindByFilter[*models.MailSync](filter.ToMap())
	if err != nil {
		return util.RespondError(e, util.ErrNotFound)
	}

	// Use typed filter for message count
	messageFilter := &query.MailSyncFilter{
		BaseFilter: query.BaseFilter{
			User: userId,
		},
		MailSyncID: mailSync.Id,
	}
	messageCount, err := query.CountRecords[*models.MailMessage](messageFilter.ToMap())
	if err != nil {
		logger.LogError("Failed to count messages", err)
		messageCount = 0
	}

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"id":            mailSync.Id,
		"status":        mailSync.SyncStatus,
		"last_synced":   mailSync.LastSynced,
		"message_count": messageCount,
	})
}

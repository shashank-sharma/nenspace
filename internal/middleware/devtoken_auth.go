package middleware

import (
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/credentials"
	"github.com/shashank-sharma/backend/internal/util"
)

// DevTokenAuthMiddleware validates dev tokens from AuthSyncToken header
func DevTokenAuthMiddleware() func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		// Get dev token from header
		devTokenValue := e.Request.Header.Get("AuthSyncToken")

		if devTokenValue == "" {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		// Validate dev token using query utility
		devToken, err := query.ValidateDevToken(devTokenValue)
		if err != nil {
			logger.LogError("Dev token validation failed", "error", err)
			return util.RespondError(e, util.ErrUnauthorized)
		}

		// Store user ID in context for downstream handlers
		e.Set("devTokenUserId", devToken.User)
		e.Set("devTokenId", devToken.Id)

		startTime := time.Now()
		err = e.Next()
		responseTime := time.Since(startTime)

		statusCode := 200
		if err != nil {
			statusCode = 0
		}

		event := &credentials.UsageEvent{
			CredentialType: "dev_token",
			CredentialID:   devToken.Id,
			UserID:         devToken.User,
			Service:        "pocketbase",
			Endpoint:       e.Request.URL.Path,
			Method:         e.Request.Method,
			StatusCode:     statusCode,
			ResponseTimeMs: responseTime.Milliseconds(),
			Timestamp:      startTime,
			Metadata: map[string]interface{}{
				"path": e.Request.URL.Path,
			},
		}

		if err != nil {
			event.ErrorType = "middleware_error"
			event.ErrorMessage = err.Error()
		}

		_ = credentials.TrackUsageDirect(e.Request.Context(), event)

		return err
	}
}

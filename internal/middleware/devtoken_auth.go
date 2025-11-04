package middleware

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/query"
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

		return e.Next()
	}
}

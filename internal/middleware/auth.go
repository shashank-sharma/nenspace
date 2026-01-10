package middleware

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/util"
)

// AuthMiddleware extracts and validates user ID from Authorization header
// Stores user ID in request context for downstream handlers
func AuthMiddleware() func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		if token == "" {
			token = e.Request.URL.Query().Get("token")
		} else {
			if len(token) > 7 && token[:7] == "Bearer " {
				token = token[7:]
			}
		}

		if token == "" {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		userId, err := util.GetUserId(token)
		if err != nil {
			logger.LogError("Failed to extract user ID from token", "error", err)
			return util.RespondError(e, util.ErrUnauthorized)
		}

		if userId == "" {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		// Store user ID in request context
		e.Set("userId", userId)

		// Also store in request context for context propagation
		ctx := util.WithUserID(e.Request.Context(), userId)
		e.Request = e.Request.WithContext(ctx)

		return e.Next()
	}
}

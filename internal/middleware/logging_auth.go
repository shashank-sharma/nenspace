package middleware

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/util"
)

func LoggingAuthMiddleware() func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		apiKey := e.Request.Header.Get("X-API-Key")
		if apiKey == "" {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		devToken, err := query.ValidateLoggingToken(apiKey)
		if err != nil {
			logger.LogWarning("Logging API key validation failed", "error", err)
			return util.RespondError(e, util.ErrUnauthorized)
		}

		project, err := query.FindByFilter[*models.LoggingProject](map[string]interface{}{
			"dev_token": devToken.Id,
		})
		if err != nil {
			logger.LogWarning("No logging project found for dev token", "devTokenId", devToken.Id)
			return util.RespondError(e, util.ErrForbidden)
		}

		if !project.Active {
			logger.LogWarning("Logging project is inactive", "project", project.Slug)
			return util.RespondError(e, util.ErrForbidden)
		}

		e.Set("loggingProjectId", project.Id)
		e.Set("loggingProjectSlug", project.Slug)

		return e.Next()
	}
}

package middleware

import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
)

// PanicRecoveryMiddleware recovers from panics and returns a proper error response
func PanicRecoveryMiddleware() func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		defer func() {
			if r := recover(); r != nil {
				// Log the panic with stack trace
				errMsg := fmt.Sprintf("Panic recovered: %v", r)
				logger.LogError("Panic in request handler",
					"error", errMsg,
					"path", e.Request.URL.Path,
					"method", e.Request.Method,
					"stack", string(debug.Stack()))

				// Return error response
				e.JSON(http.StatusInternalServerError, map[string]interface{}{
					"error": "An internal server error occurred",
					"code":  "INTERNAL_ERROR",
				})
			}
		}()

		return e.Next()
	}
}

// RegisterGlobalMiddleware registers global middleware for all routes
func RegisterGlobalMiddleware(e *core.RequestEvent) error {
	logger.Debug.Println("Registering global middleware")
	return e.Next()
}

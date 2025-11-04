package util

import (
	"github.com/pocketbase/pocketbase/core"
)

// GetUserIDFromRequest extracts user ID from request context (set by AuthMiddleware)
// Returns the user ID and true if found, empty string and false otherwise
func GetUserIDFromRequest(e *core.RequestEvent) (string, bool) {
	userID, ok := e.Get("userId").(string)
	if !ok || userID == "" {
		return "", false
	}
	return userID, true
}

// RequireUserID extracts user ID from request and returns an error if not found
// This is a convenience function for handlers that require authentication
func RequireUserID(e *core.RequestEvent) (string, error) {
	userID, ok := GetUserIDFromRequest(e)
	if !ok {
		return "", ErrUnauthorized
	}
	return userID, nil
}

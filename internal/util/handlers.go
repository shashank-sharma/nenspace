package util

import (
	"strconv"

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

// GetQueryInt extracts an integer from a query parameter with a default value
func GetQueryInt(e *core.RequestEvent, key string, defaultValue int) int {
	val := e.Request.URL.Query().Get(key)
	if val == "" {
		return defaultValue
	}

	importVal, err := strconv.Atoi(val)
	if err != nil {
		return defaultValue
	}

	return importVal
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

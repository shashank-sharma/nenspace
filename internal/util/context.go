package util

import "context"

// ContextKey is a type-safe key for context values
type ContextKey string

const (
	// ContextKeyUserID is the context key for user ID
	ContextKeyUserID ContextKey = "userId"
	// ContextKeyUserEmail is the context key for user email
	ContextKeyUserEmail ContextKey = "userEmail"
)

// GetUserIDFromContext extracts user ID from context
func GetUserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(ContextKeyUserID).(string)
	return userID, ok
}

// WithUserID adds user ID to context
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, ContextKeyUserID, userID)
}

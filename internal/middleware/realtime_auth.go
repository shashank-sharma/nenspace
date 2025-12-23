package middleware

import (
	"strings"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/util"
)

// Custom key for storing userId in client
const RealtimeClientUserIdKey = "userId"

// RegisterRealtimeAuth sets up realtime subscription authorization
// This ensures users can only subscribe to topics they're authorized to access
func RegisterRealtimeAuth(app core.App) {
	// Extract and store userId during connection
	app.OnRealtimeConnectRequest().BindFunc(func(e *core.RealtimeConnectRequestEvent) error {
		authRecord, _ := e.Client.Get(apis.RealtimeClientAuthKey).(*core.Record)

		var userId string

		if authRecord != nil {
			// Standard auth with user record (frontend)
			userId = authRecord.Id
		} else {
			// Token-only auth (browser extension)
			// Extract userId from Authorization header
			authHeader := e.Request.Header.Get("Authorization")
			if authHeader != "" {
				// Remove "Bearer " prefix if present
				token := strings.TrimPrefix(authHeader, "Bearer ")
				token = strings.TrimSpace(token)

				if token != "" {
					extractedUserId, err := util.GetUserId(token)
					if err == nil && extractedUserId != "" {
						userId = extractedUserId
					}
				}
			}
		}

		// Store userId in client for later use
		if userId != "" {
			e.Client.Set(RealtimeClientUserIdKey, userId)
		}

		return e.Next()
	})

	// Validate subscriptions using stored userId
	app.OnRealtimeSubscribeRequest().BindFunc(func(e *core.RealtimeSubscribeRequestEvent) error {
		subscriptions := e.Client.Subscriptions()
		logger.LogDebug("Subscriptions requested", "count", len(subscriptions))

		// Get userId from client (set during connection)
		userId, _ := e.Client.Get(RealtimeClientUserIdKey).(string)

		if userId == "" {
			// If no userId, try to get from auth record as fallback
			authRecord, _ := e.Client.Get(apis.RealtimeClientAuthKey).(*core.Record)
			if authRecord != nil {
				userId = authRecord.Id
			}
		}

		// If no authenticated user, reject custom topic subscriptions
		if userId == "" {
			for subscription := range subscriptions {
				// Allow collection subscriptions (handled by PocketBase)
				if strings.Contains(subscription, ":") {
					return apis.NewForbiddenError("Authentication required for realtime subscriptions", nil)
				}
			}
			return e.Next()
		}

		// Validate all subscriptions
		for subscription := range subscriptions {
			if !isAuthorizedForTopic(userId, subscription) {
				return apis.NewForbiddenError("Not authorized to subscribe to this topic", nil)
			}
		}

		return e.Next()
	})
}

// isAuthorizedForTopic checks if a user is allowed to subscribe to a topic
func isAuthorizedForTopic(userId string, topic string) bool {
	// Allow collection subscriptions (PocketBase default behavior)
	// These follow the pattern: "collectionName" or "collectionName/recordId"
	if !strings.Contains(topic, ":") {
		// This is a collection subscription, let PocketBase handle authorization
		return true
	}

	// For custom topics with format:
	// - "topicName:targetUserId" (user-specific)
	// - "topicName:targetUserId:browserId" (browser-specific)
	parts := strings.Split(topic, ":")
	if len(parts) < 2 || len(parts) > 3 {
		// Invalid topic format
		return false
	}

	topicName := parts[0]
	targetUserId := parts[1]
	// browserId := "" // Optional third part
	// if len(parts) == 3 {
	// 	browserId = parts[2]
	// }

	// User can subscribe to their own user-specific topics (with or without browserId)
	if targetUserId == userId {
		return true
	}

	// Special admin/system topics (if needed in the future)
	// You can add logic here to allow admins to subscribe to any topic
	// if isAdmin(userId) {
	//     return true
	// }

	// Check for broadcast topics (no user ID suffix means it's global)
	globalBroadcastTopics := []string{
		"system-broadcast",
		"maintenance",
		"announcements",
	}

	for _, globalTopic := range globalBroadcastTopics {
		if topicName == globalTopic {
			return true
		}
	}

	// Deny by default
	return false
}

// Optional: Add admin check function if needed
// func isAdmin(userId string) bool {
//     // Query user record and check if they have admin role
//     // Implementation depends on your user model
//     return false
// }

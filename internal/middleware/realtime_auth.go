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
		logger.LogInfo("=== REALTIME CONNECT REQUEST ===", "clientId", e.Client.Id())
		
		// Try to get authenticated user from record
		authRecord, _ := e.Client.Get(apis.RealtimeClientAuthKey).(*core.Record)
		
		var userId string
		
		if authRecord != nil {
			// Standard auth with user record (frontend)
			logger.LogInfo("🌐 FLOW: Using SESSION-BASED AUTH (Frontend/Web)", "clientId", e.Client.Id())
			userId = authRecord.Id
			logger.LogInfo("✓ Session auth successful", "userId", userId, "email", authRecord.GetString("email"))
		} else {
			// Token-only auth (browser extension)
			logger.LogInfo("🔌 FLOW: Checking TOKEN-BASED AUTH (Browser Extension)", "clientId", e.Client.Id())
			
			// Extract userId from Authorization header
			authHeader := e.Request.Header.Get("Authorization")
			if authHeader != "" {
				logger.LogDebug("Authorization header present", "header", authHeader[:20]+"...")
				
				// Remove "Bearer " prefix if present
				token := strings.TrimPrefix(authHeader, "Bearer ")
				token = strings.TrimSpace(token)
				
				if token != "" {
					logger.LogDebug("Attempting to extract userId from token...")
					extractedUserId, err := util.GetUserId(token)
					if err == nil && extractedUserId != "" {
						userId = extractedUserId
						logger.LogInfo("✓ Token auth successful", "userId", userId)
					} else {
						logger.LogWarning("✗ Failed to extract userId from token", "error", err)
					}
				} else {
					logger.LogWarning("✗ Empty token after processing")
				}
			} else {
				logger.LogWarning("✗ No Authorization header found")
			}
		}
		
		// Store userId in client for later use
		if userId != "" {
			e.Client.Set(RealtimeClientUserIdKey, userId)
			logger.LogInfo("✓ Realtime connection established", "userId", userId, "clientId", e.Client.Id())
		} else {
			logger.LogWarning("⚠ No userId extracted from either auth method", "clientId", e.Client.Id())
		}
		
		return e.Next()
	})

	// Validate subscriptions using stored userId
	app.OnRealtimeSubscribeRequest().BindFunc(func(e *core.RealtimeSubscribeRequestEvent) error {
		logger.LogInfo("=== REALTIME SUBSCRIBE REQUEST ===", "clientId", e.Client.Id())
		
		// Get the subscriptions map from the client
		subscriptions := e.Client.Subscriptions()
		logger.LogDebug("Subscriptions requested", "count", len(subscriptions))
		
		// Get userId from client (set during connection)
		userId, _ := e.Client.Get(RealtimeClientUserIdKey).(string)
		
		if userId != "" {
			logger.LogInfo("Using stored userId from connection", "userId", userId)
		} else {
			logger.LogDebug("No stored userId, checking auth record fallback...")
			// If no userId, try to get from auth record as fallback
			authRecord, _ := e.Client.Get(apis.RealtimeClientAuthKey).(*core.Record)
			if authRecord != nil {
				userId = authRecord.Id
				logger.LogInfo("Using userId from auth record fallback", "userId", userId)
			}
		}
		
		// If no authenticated user, reject custom topic subscriptions
		if userId == "" {
			logger.LogWarning("⚠ No userId available for subscription validation", "clientId", e.Client.Id())
			for subscription := range subscriptions {
				// Allow collection subscriptions (handled by PocketBase)
				if strings.Contains(subscription, ":") {
					logger.LogWarning("✗ Unauthenticated custom topic subscription attempt", "topic", subscription)
					return apis.NewForbiddenError("Authentication required for realtime subscriptions", nil)
				}
			}
			return e.Next()
		}

		// Validate all subscriptions
		logger.LogInfo("Validating subscriptions", "userId", userId, "count", len(subscriptions))
		for subscription := range subscriptions {
			logger.LogDebug("Checking authorization", "topic", subscription)
			if !isAuthorizedForTopic(userId, subscription) {
				logger.LogWarning(
					"✗ UNAUTHORIZED subscription attempt",
					"userId", userId,
					"topic", subscription,
				)
				return apis.NewForbiddenError("Not authorized to subscribe to this topic", nil)
			}
			logger.LogInfo("✓ AUTHORIZED subscription", "userId", userId, "topic", subscription)
		}

		logger.LogInfo("✓ All subscriptions authorized", "userId", userId, "clientId", e.Client.Id())
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

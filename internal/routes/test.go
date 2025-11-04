package routes

import (
	"net/http"
	"strconv"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/util"
)

// RegisterTestRoutes registers test API endpoints
func RegisterTestRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string) {
	testRouter := apiRouter.Group(path)
	
	// Basic test endpoint
	testRouter.GET("", TestHandler)
	
	// Test realtime notification endpoint
	testRouter.GET("/notify/{userId}", TestNotificationHandler)
	
	logger.LogInfo("Test routes registered")
}

func TestHandler(e *core.RequestEvent) error {
	return e.JSON(http.StatusOK, map[string]interface{}{"message": "success"})
}

// TestNotificationHandler sends a test notification to a specific user
// Usage: GET /api/test/notify/{userId}?message=Hello&variant=info&duration=3000&profileId=abc123
func TestNotificationHandler(e *core.RequestEvent) error {
	userId := e.Request.PathValue("userId")
	if userId == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "User ID is required",
		})
	}

	// Get query parameters
	message := e.Request.URL.Query().Get("message")
	if message == "" {
		message = "Test notification from browser extension!"
	}

	variant := e.Request.URL.Query().Get("variant")
	if variant == "" {
		variant = "info"
	}

	durationStr := e.Request.URL.Query().Get("duration")
	duration := 3000 // default 3 seconds
	if durationStr != "" {
		if d, err := strconv.Atoi(durationStr); err == nil && d >= 0 {
			duration = d
		}
	}

	// Get profile ID from query (optional) - this is the browser profile ID
	profileId := e.Request.URL.Query().Get("profileId")
	
	// Construct topic based on profile ID
	var topic string
	if profileId != "" {
		topic = "notifications:" + userId + ":" + profileId
	} else {
		topic = "notifications:" + userId
	}

	// Send the notification
	err := util.NotifyClients(e.App, topic, message, variant, duration)
	if err != nil {
		logger.LogError("Failed to send test notification: %v", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to send notification: " + err.Error(),
		})
	}

	logger.LogInfo("Test notification sent to user %s on topic %s", userId, topic)

	return e.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Test notification sent",
		"details": map[string]interface{}{
			"userId":    userId,
			"topic":     topic,
			"message":   message,
			"variant":   variant,
			"duration":  duration,
			"profileId": profileId,
		},
	})
}

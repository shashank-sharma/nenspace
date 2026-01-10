package util

import (
	"encoding/json"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/subscriptions"
	"golang.org/x/sync/errgroup"
)

// NotificationMessage represents a realtime notification payload
type NotificationMessage struct {
	Message  string `json:"message"`
	Variant  string `json:"variant"`  // success, error, info, warning, loading
	Duration int    `json:"duration"` // in milliseconds, 0 = no auto-dismiss
}

// NotifyClients sends a realtime message to all clients subscribed to a topic
//
// Parameters:
//   - app: The PocketBase app instance
//   - topic: The subscription topic (e.g., "notifications", "calendar-sync", "system")
//   - message: The notification message
//   - variant: The type of notification (success, error, info, warning, loading)
//   - duration: Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
//
// Example usage:
//
//	err := util.NotifyClients(app, "notifications", "Sync completed", "success", 3000)
//	if err != nil {
//	    logger.LogError("Failed to send notification", "error", err)
//	}
func NotifyClients(app core.App, topic string, message string, variant string, duration int) error {
	return notifyClientsInternal(app, topic, message, variant, duration)
}

// NotifyClientsWithDelay sends a realtime message to all clients subscribed to a topic with optional delay
//
// Parameters:
//   - app: The PocketBase app instance
//   - topic: The subscription topic (e.g., "notifications", "calendar-sync", "system")
//   - message: The notification message
//   - variant: The type of notification (success, error, info, warning, loading)
//   - duration: Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
//   - delay: Delay before sending notification in seconds (0 = send immediately)
//
// The delay is handled on the backend - the notification is sent after the delay period.
// This ensures the frontend receives the notification at the right time and can display it immediately.
func NotifyClientsWithDelay(app core.App, topic string, message string, variant string, duration int, delay int) error {
	if delay > 0 {
		go func() {
			time.Sleep(time.Duration(delay) * time.Second)
			notifyClientsInternal(app, topic, message, variant, duration)
		}()
		return nil
	}
	return notifyClientsInternal(app, topic, message, variant, duration)
}

// notifyClientsInternal is the internal implementation that actually sends the notification
func notifyClientsInternal(app core.App, topic string, message string, variant string, duration int) error {
	notification := NotificationMessage{
		Message:  message,
		Variant:  variant,
		Duration: duration,
	}

	rawData, err := json.Marshal(notification)
	if err != nil {
		return err
	}

	msg := subscriptions.Message{
		Name: topic,
		Data: rawData,
	}

	group := new(errgroup.Group)
	chunks := app.SubscriptionsBroker().ChunkedClients(RealtimeClientChunkSize)

	for _, chunk := range chunks {
		currentChunk := chunk
		group.Go(func() error {
			for _, client := range currentChunk {
				if !client.HasSubscription(topic) {
					continue
				}
				client.Send(msg)
			}
			return nil
		})
	}

	return group.Wait()
}

// Legacy convenience functions - kept for backward compatibility
// New code should use util.Notify(app).ToUser(userId).Success(message).Send()

// NotifySuccess is a convenience function for success notifications
// Deprecated: Use util.Notify(app).Success(message).Send() instead
func NotifySuccess(app core.App, message string) error {
	return Notify(app).Success(message).Send()
}

// NotifyError is a convenience function for error notifications
// Deprecated: Use util.Notify(app).Error(message).Send() instead
func NotifyError(app core.App, message string) error {
	return Notify(app).Error(message).Send()
}

// NotifyInfo is a convenience function for info notifications
// Deprecated: Use util.Notify(app).Info(message).Send() instead
func NotifyInfo(app core.App, message string) error {
	return Notify(app).Info(message).Send()
}

// NotifyWarning is a convenience function for warning notifications
// Deprecated: Use util.Notify(app).Warning(message).Send() instead
func NotifyWarning(app core.App, message string) error {
	return Notify(app).Warning(message).Send()
}

// NotifyLoading is a convenience function for loading notifications (no auto-dismiss)
// Deprecated: Use util.Notify(app).Loading(message).Send() instead
func NotifyLoading(app core.App, message string) error {
	return Notify(app).Loading(message).Send()
}

// NotifyUser sends a notification to a specific user
// Topic format: "notifications:userId" (e.g., "notifications:abc123")
// Deprecated: Use util.Notify(app).ToUser(userId).WithVariant(variant).WithMessage(message).Send() instead
func NotifyUser(app core.App, userId string, message string, variant string, duration int) error {
	return Notify(app).ToUser(userId).WithMessage(message).WithVariant(variant).WithDuration(duration).Send()
}

// NotifyUserSuccess sends a success notification to a specific user
// Deprecated: Use util.Notify(app).ToUser(userId).Success(message).Send() instead
func NotifyUserSuccess(app core.App, userId string, message string) error {
	return Notify(app).ToUser(userId).Success(message).Send()
}

// NotifyUserError sends an error notification to a specific user
// Deprecated: Use util.Notify(app).ToUser(userId).Error(message).Send() instead
func NotifyUserError(app core.App, userId string, message string) error {
	return Notify(app).ToUser(userId).Error(message).Send()
}

// NotifyUserInfo sends an info notification to a specific user
// Deprecated: Use util.Notify(app).ToUser(userId).Info(message).Send() instead
func NotifyUserInfo(app core.App, userId string, message string) error {
	return Notify(app).ToUser(userId).Info(message).Send()
}

// NotifyUserWarning sends a warning notification to a specific user
// Deprecated: Use util.Notify(app).ToUser(userId).Warning(message).Send() instead
func NotifyUserWarning(app core.App, userId string, message string) error {
	return Notify(app).ToUser(userId).Warning(message).Send()
}

// NotifyUserLoading sends a loading notification to a specific user
// Deprecated: Use util.Notify(app).ToUser(userId).Loading(message).Send() instead
func NotifyUserLoading(app core.App, userId string, message string) error {
	return Notify(app).ToUser(userId).Loading(message).Send()
}

// NotifyBrowser sends a notification to a specific browser/profile
// Topic format: "notifications:userId:browserId" (e.g., "notifications:user123:browser456")
// Deprecated: Use util.Notify(app).ToBrowser(userId, browserId).WithVariant(variant).WithMessage(message).Send() instead
func NotifyBrowser(app core.App, userId string, browserId string, message string, variant string, duration int) error {
	return Notify(app).ToBrowser(userId, browserId).WithMessage(message).WithVariant(variant).WithDuration(duration).Send()
}

// NotifyBrowserSuccess sends a success notification to a specific browser
// Deprecated: Use util.Notify(app).ToBrowser(userId, browserId).Success(message).Send() instead
func NotifyBrowserSuccess(app core.App, userId string, browserId string, message string) error {
	return Notify(app).ToBrowser(userId, browserId).Success(message).Send()
}

// NotifyBrowserError sends an error notification to a specific browser
// Deprecated: Use util.Notify(app).ToBrowser(userId, browserId).Error(message).Send() instead
func NotifyBrowserError(app core.App, userId string, browserId string, message string) error {
	return Notify(app).ToBrowser(userId, browserId).Error(message).Send()
}

// NotifyBrowserInfo sends an info notification to a specific browser
// Deprecated: Use util.Notify(app).ToBrowser(userId, browserId).Info(message).Send() instead
func NotifyBrowserInfo(app core.App, userId string, browserId string, message string) error {
	return Notify(app).ToBrowser(userId, browserId).Info(message).Send()
}

// NotifyBrowserWarning sends a warning notification to a specific browser
// Deprecated: Use util.Notify(app).ToBrowser(userId, browserId).Warning(message).Send() instead
func NotifyBrowserWarning(app core.App, userId string, browserId string, message string) error {
	return Notify(app).ToBrowser(userId, browserId).Warning(message).Send()
}

// NotifyBrowserLoading sends a loading notification to a specific browser
// Deprecated: Use util.Notify(app).ToBrowser(userId, browserId).Loading(message).Send() instead
func NotifyBrowserLoading(app core.App, userId string, browserId string, message string) error {
	return Notify(app).ToBrowser(userId, browserId).Loading(message).Send()
}

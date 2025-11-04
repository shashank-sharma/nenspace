package util

import (
	"github.com/pocketbase/pocketbase/core"
)

// NotificationBuilder provides a fluent interface for building and sending notifications
type NotificationBuilder struct {
	app       core.App
	topic     string
	message   string
	variant   string
	duration  int
	userId    string
	browserId string
}

// NewNotification creates a new notification builder
func NewNotification(app core.App) *NotificationBuilder {
	return &NotificationBuilder{
		app:      app,
		topic:    "notifications",
		variant:  "info",
		duration: NotificationDurationInfo,
	}
}

// WithMessage sets the notification message
func (nb *NotificationBuilder) WithMessage(message string) *NotificationBuilder {
	nb.message = message
	return nb
}

// WithVariant sets the notification variant (success, error, info, warning, loading)
func (nb *NotificationBuilder) WithVariant(variant string) *NotificationBuilder {
	nb.variant = variant
	return nb
}

// WithDuration sets the notification duration in milliseconds (0 = no auto-dismiss)
func (nb *NotificationBuilder) WithDuration(duration int) *NotificationBuilder {
	nb.duration = duration
	return nb
}

// WithTopic sets a custom topic (default: "notifications")
func (nb *NotificationBuilder) WithTopic(topic string) *NotificationBuilder {
	nb.topic = topic
	return nb
}

// ToUser sets the notification target to a specific user
// Topic becomes "notifications:userId"
func (nb *NotificationBuilder) ToUser(userId string) *NotificationBuilder {
	nb.userId = userId
	nb.topic = "notifications:" + userId
	return nb
}

// ToBrowser sets the notification target to a specific browser/profile
// Topic becomes "notifications:userId:browserId"
func (nb *NotificationBuilder) ToBrowser(userId, browserId string) *NotificationBuilder {
	nb.userId = userId
	nb.browserId = browserId
	nb.topic = "notifications:" + userId + ":" + browserId
	return nb
}

// Success sets variant to "success" and duration to default success duration
func (nb *NotificationBuilder) Success(message string) *NotificationBuilder {
	nb.message = message
	nb.variant = "success"
	nb.duration = NotificationDurationSuccess
	return nb
}

// Error sets variant to "error" and duration to default error duration
func (nb *NotificationBuilder) Error(message string) *NotificationBuilder {
	nb.message = message
	nb.variant = "error"
	nb.duration = NotificationDurationError
	return nb
}

// Info sets variant to "info" and duration to default info duration
func (nb *NotificationBuilder) Info(message string) *NotificationBuilder {
	nb.message = message
	nb.variant = "info"
	nb.duration = NotificationDurationInfo
	return nb
}

// Warning sets variant to "warning" and duration to default warning duration
func (nb *NotificationBuilder) Warning(message string) *NotificationBuilder {
	nb.message = message
	nb.variant = "warning"
	nb.duration = NotificationDurationWarning
	return nb
}

// Loading sets variant to "loading" with no auto-dismiss
func (nb *NotificationBuilder) Loading(message string) *NotificationBuilder {
	nb.message = message
	nb.variant = "loading"
	nb.duration = NotificationDurationLoading
	return nb
}

// Send sends the notification and returns any error
func (nb *NotificationBuilder) Send() error {
	if nb.message == "" {
		return nil // No message to send
	}
	return NotifyClients(nb.app, nb.topic, nb.message, nb.variant, nb.duration)
}

// Convenience functions using the builder pattern

// Notify creates a new notification builder
// Example: util.Notify(app).ToUser(userId).Success("Operation completed").Send()
func Notify(app core.App) *NotificationBuilder {
	return NewNotification(app)
}

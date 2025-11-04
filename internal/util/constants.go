package util

// Batch processing constants
const (
	// MaxBatchSize is the maximum number of items allowed in a single batch request
	MaxBatchSize = 500

	// RealtimeClientChunkSize is the number of clients processed per chunk in realtime broadcasts
	RealtimeClientChunkSize = 300
)

// Notification duration constants (in milliseconds)
const (
	NotificationDurationSuccess = 3000
	NotificationDurationError   = 5000
	NotificationDurationInfo    = 3000
	NotificationDurationWarning = 4000
	NotificationDurationLoading = 0 // No auto-dismiss
)

package credentials

import (
	"context"
	"time"
)

type UsageEvent struct {
	CredentialType string
	CredentialID   string
	UserID         string
	Service        string
	Endpoint       string
	Method         string
	StatusCode     int
	ResponseTimeMs int64
	TokensUsed     int64
	RequestSize    int64
	ResponseSize   int64
	ErrorType      string
	ErrorMessage   string
	Timestamp      time.Time
	Metadata       map[string]interface{}
}

type UsageTracker interface {
	TrackUsage(ctx context.Context, event *UsageEvent) error
	Flush(ctx context.Context) error
	Shutdown(ctx context.Context) error
	GetStats() TrackerStats
}

type TrackerStats struct {
	EventsBuffered  int64
	EventsFlushed   int64
	Errors          int64
	BufferOverflows int64
}

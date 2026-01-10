package credentials

import (
	"context"
	"net/http"
)

var (
	globalTracker UsageTracker
)

// InitTracker initializes the global tracker instance
func InitTracker(config *Config) {
	if globalTracker == nil {
		globalTracker = NewTracker(config)
	}
}

// GetTracker returns the global tracker instance
func GetTracker() UsageTracker {
	return globalTracker
}

// NewTrackedClient creates a new HTTP client with tracking enabled
func NewTrackedClient(baseClient *http.Client, credentialType, credentialID, service string) *http.Client {
	if baseClient == nil {
		baseClient = &http.Client{}
	}

	tracker := GetTracker()
	if tracker == nil {
		return baseClient
	}

	baseTransport := baseClient.Transport
	if baseTransport == nil {
		baseTransport = http.DefaultTransport
	}

	trackedTransport := NewTrackedRoundTripper(baseTransport, tracker)

	return &http.Client{
		Transport:     trackedTransport,
		CheckRedirect: baseClient.CheckRedirect,
		Jar:           baseClient.Jar,
		Timeout:       baseClient.Timeout,
	}
}

// WrapOAuthClient wraps an OAuth2 client with tracking
func WrapOAuthClient(oauthClient *http.Client, credentialType, credentialID, service string) *http.Client {
	return NewTrackedClient(oauthClient, credentialType, credentialID, service)
}

// NewTrackedClientWithContext creates a tracked client that uses context for credential info
// This is useful when credential info is passed via context
func NewTrackedClientWithContext(baseClient *http.Client) *http.Client {
	if baseClient == nil {
		baseClient = &http.Client{}
	}

	tracker := GetTracker()
	if tracker == nil {
		return baseClient
	}

	baseTransport := baseClient.Transport
	if baseTransport == nil {
		baseTransport = http.DefaultTransport
	}

	trackedTransport := NewTrackedRoundTripper(baseTransport, tracker)

	return &http.Client{
		Transport:     trackedTransport,
		CheckRedirect: baseClient.CheckRedirect,
		Jar:           baseClient.Jar,
		Timeout:       baseClient.Timeout,
	}
}

// TrackUsageDirect tracks a usage event directly (for non-HTTP operations like SSH)
func TrackUsageDirect(ctx context.Context, event *UsageEvent) error {
	tracker := GetTracker()
	if tracker == nil {
		return nil
	}

	return tracker.TrackUsage(ctx, event)
}

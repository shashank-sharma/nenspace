package credentials

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/shashank-sharma/backend/internal/util"
)

type TrackedRoundTripper struct {
	base            http.RoundTripper
	tracker         UsageTracker
	mu              sync.RWMutex
	userIDExtractor func(*http.Request) (string, bool)
}

func NewTrackedRoundTripper(base http.RoundTripper, tracker UsageTracker) *TrackedRoundTripper {
	if base == nil {
		base = http.DefaultTransport
	}

	return &TrackedRoundTripper{
		base:            base,
		tracker:         tracker,
		userIDExtractor: extractUserIDFromRequest,
	}
}

func (rt *TrackedRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	credInfo, hasCred := GetCredentialFromContext(req.Context())
	if !hasCred {
		return rt.base.RoundTrip(req)
	}

	userID, _ := rt.userIDExtractor(req)
	if userID == "" {
		userID, _ = util.GetUserIDFromContext(req.Context())
	}

	service := DetectService(req)
	if service == "" || service == "unknown" {
		if credInfo.Service != "" {
			service = credInfo.Service
		}
	}

	startTime := time.Now()

	var requestSize int64
	if req.Body != nil {
		bodyBytes, err := io.ReadAll(req.Body)
		if err == nil {
			requestSize = int64(len(bodyBytes))
			req.Body = io.NopCloser(strings.NewReader(string(bodyBytes)))
		}
	}

	resp, err := rt.base.RoundTrip(req)

	responseTime := time.Since(startTime)

	var statusCode int
	var responseSize int64
	var tokensUsed int64

	if resp != nil {
		statusCode = resp.StatusCode

		if resp.Body != nil {
			bodyBytes, readErr := io.ReadAll(resp.Body)
			if readErr == nil {
				responseSize = int64(len(bodyBytes))
				resp.Body = io.NopCloser(strings.NewReader(string(bodyBytes)))

				if service == "openai" || service == "claude" {
					parser := GetParserForService(service)
					if tokens, parseErr := parser.ParseTokensUsed(resp); parseErr == nil {
						tokensUsed = tokens
					}
				}
			}
		}
	} else {
		statusCode = 0
	}

	event := &UsageEvent{
		CredentialType: credInfo.Type,
		CredentialID:   credInfo.ID,
		UserID:         userID,
		Service:        service,
		Endpoint:       req.URL.Path,
		Method:         req.Method,
		StatusCode:     statusCode,
		ResponseTimeMs: responseTime.Milliseconds(),
		TokensUsed:     tokensUsed,
		RequestSize:    requestSize,
		ResponseSize:   responseSize,
		Timestamp:      startTime,
	}

	if err != nil {
		event.ErrorType = "request_error"
		event.ErrorMessage = err.Error()
	} else if resp != nil && resp.StatusCode >= 400 {
		event.ErrorType = "http_error"
		event.ErrorMessage = http.StatusText(resp.StatusCode)
	}

	go func() {
		_ = rt.tracker.TrackUsage(context.Background(), event)
	}()

	return resp, err
}

func extractUserIDFromRequest(req *http.Request) (string, bool) {
	if userID, ok := util.GetUserIDFromContext(req.Context()); ok {
		return userID, true
	}

	return "", false
}

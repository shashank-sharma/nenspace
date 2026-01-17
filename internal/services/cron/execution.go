package cron

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

type Executor struct {
	client *http.Client
}

func NewExecutor() *Executor {
	return &Executor{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type ExecutionResult struct {
	Status          string
	HTTPStatus      int
	DurationMs      int64
	RequestURL      string
	RequestMethod   string
	RequestHeaders  map[string]string
	RequestPayload  map[string]interface{}
	ResponseHeaders map[string]string
	ResponseBody    string
	ErrorMessage    string
	ErrorStack      string
	StartedAt       time.Time
	CompletedAt     time.Time
	RetryCount      int
}

func (e *Executor) Execute(cronRecord *models.Cron) error {
	startTime := time.Now()
	result := &ExecutionResult{
		Status:         "running",
		RequestURL:     cronRecord.WebhookURL,
		RequestMethod:  cronRecord.WebhookMethod,
		StartedAt:      startTime,
		RequestHeaders: make(map[string]string),
		RequestPayload: make(map[string]interface{}),
	}

	timeout := time.Duration(cronRecord.TimeoutSeconds) * time.Second
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var requestBody io.Reader
	// Only include request body for methods that support it
	supportsBody := cronRecord.WebhookMethod == "POST" || 
		cronRecord.WebhookMethod == "PUT" || 
		cronRecord.WebhookMethod == "PATCH"
	
	if supportsBody && cronRecord.WebhookPayload != nil {
		payloadBytes, err := json.Marshal(cronRecord.WebhookPayload)
		if err != nil {
			result.Status = "failure"
			result.ErrorMessage = fmt.Sprintf("failed to marshal payload: %v", err)
			result.ErrorStack = getStackTrace()
			result.CompletedAt = time.Now()
			result.DurationMs = time.Since(startTime).Milliseconds()
			e.logExecution(cronRecord, result)
			return fmt.Errorf("failed to marshal payload: %w", err)
		}
		requestBody = bytes.NewReader(payloadBytes)

		if err := json.Unmarshal(payloadBytes, &result.RequestPayload); err == nil {
		}
	}

	req, err := http.NewRequestWithContext(ctx, cronRecord.WebhookMethod, cronRecord.WebhookURL, requestBody)
	if err != nil {
		result.Status = "failure"
		result.ErrorMessage = fmt.Sprintf("failed to create request: %v", err)
		result.ErrorStack = getStackTrace()
		result.CompletedAt = time.Now()
		result.DurationMs = time.Since(startTime).Milliseconds()
		e.logExecution(cronRecord, result)
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Only set Content-Type for methods that support request bodies
	if supportsBody && requestBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if cronRecord.WebhookHeaders != nil {
		var headers map[string]interface{}
		if err := json.Unmarshal(cronRecord.WebhookHeaders, &headers); err == nil {
			for key, value := range headers {
				if strValue, ok := value.(string); ok {
					req.Header.Set(key, strValue)
					result.RequestHeaders[key] = strValue
				}
			}
		}
	}

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		result.Status = "failure"
		result.ErrorMessage = fmt.Sprintf("request failed: %v", err)
		result.ErrorStack = getStackTrace()
		result.CompletedAt = time.Now()
		result.DurationMs = time.Since(startTime).Milliseconds()
		e.logExecution(cronRecord, result)
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	result.HTTPStatus = resp.StatusCode
	result.ResponseHeaders = make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			result.ResponseHeaders[key] = values[0]
		}
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		result.Status = "failure"
		result.ErrorMessage = fmt.Sprintf("failed to read response: %v", err)
		result.ErrorStack = getStackTrace()
	} else {
		bodyStr := string(bodyBytes)
		if len(bodyStr) > 10000 {
			bodyStr = bodyStr[:10000] + "... (truncated)"
		}
		result.ResponseBody = bodyStr

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			result.Status = "success"
		} else {
			result.Status = "failure"
			result.ErrorMessage = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, bodyStr)
		}
	}

	result.CompletedAt = time.Now()
	result.DurationMs = time.Since(startTime).Milliseconds()

	if err := e.logExecution(cronRecord, result); err != nil {
		logger.LogError("Failed to log execution", "error", err)
	}

	cronRecord.LastRun = parseTimeToDateTime(result.CompletedAt)
	cronRecord.NextRun = parseTimeToDateTime(e.getNextRunTime(cronRecord.Schedule, result.CompletedAt))
	cronRecord.RefreshUpdated()
	if err := query.SaveRecord(cronRecord); err != nil {
		logger.LogError("Failed to update cron last_run", "error", err)
	}

	if (result.Status == "success" && cronRecord.NotifyOnSuccess) ||
		(result.Status == "failure" && cronRecord.NotifyOnFailure) {
		if err := e.sendNotification(cronRecord, result); err != nil {
			logger.LogError("Failed to send notification", "error", err)
		}
	}

	if result.Status == "failure" && cronRecord.MaxRetries > 0 {
		go e.scheduleRetry(cronRecord, result)
	}

	return nil
}

func (e *Executor) logExecution(cronRecord *models.Cron, result *ExecutionResult) error {
	execution := &models.CronExecution{
		Cron:          cronRecord.Id,
		User:          cronRecord.User,
		Status:        result.Status,
		StartedAt:     parseTimeToDateTime(result.StartedAt),
		CompletedAt:   parseTimeToDateTime(result.CompletedAt),
		DurationMs:    result.DurationMs,
		HTTPStatus:    result.HTTPStatus,
		RequestURL:    result.RequestURL,
		RequestMethod: result.RequestMethod,
		ResponseBody:  result.ResponseBody,
		ErrorMessage:  result.ErrorMessage,
		ErrorStack:    result.ErrorStack,
	}

	if len(result.RequestHeaders) > 0 {
		headersBytes, _ := json.Marshal(result.RequestHeaders)
		execution.RequestHeaders = types.JSONRaw(headersBytes)
	}

	if len(result.RequestPayload) > 0 {
		payloadBytes, _ := json.Marshal(result.RequestPayload)
		execution.RequestPayload = types.JSONRaw(payloadBytes)
	}

	if len(result.ResponseHeaders) > 0 {
		headersBytes, _ := json.Marshal(result.ResponseHeaders)
		execution.ResponseHeaders = types.JSONRaw(headersBytes)
	}

	execution.RefreshCreated()
	if err := query.SaveRecord(execution); err != nil {
		return fmt.Errorf("failed to save execution: %w", err)
	}

	return nil
}

func (e *Executor) scheduleRetry(cronRecord *models.Cron, result *ExecutionResult) {
	retryDelay := time.Duration(cronRecord.RetryDelaySeconds) * time.Second
	if retryDelay == 0 {
		retryDelay = 60 * time.Second
	}

	time.Sleep(retryDelay)

	cronRecord, err := query.FindById[*models.Cron](cronRecord.Id)
	if err != nil {
		logger.LogError("Failed to reload cron for retry", "error", err)
		return
	}

	if !cronRecord.IsActive {
		return
	}

	retryResult := *result
	retryResult.Status = "running"
	retryResult.StartedAt = time.Now()
	retryResult.RetryCount++

	if err := e.Execute(cronRecord); err != nil {
		logger.LogError("Retry execution failed", "cronId", cronRecord.Id, "error", err)
	}
}

func (e *Executor) sendNotification(cronRecord *models.Cron, result *ExecutionResult) error {
	if cronRecord.NotificationWebhook == "" {
		return nil
	}

	notification := map[string]interface{}{
		"cron_id":    cronRecord.Id,
		"cron_name":  cronRecord.Name,
		"status":     result.Status,
		"timestamp":  result.CompletedAt,
		"duration_ms": result.DurationMs,
	}

	if result.Status == "failure" {
		notification["error"] = result.ErrorMessage
		notification["http_status"] = result.HTTPStatus
	}

	payloadBytes, err := json.Marshal(notification)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	req, err := http.NewRequest("POST", cronRecord.NotificationWebhook, bytes.NewReader(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create notification request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send notification: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (e *Executor) getNextRunTime(schedule string, fromTime time.Time) time.Time {
	parts := parseCronSchedule(schedule)
	if parts == nil {
		return fromTime.Add(1 * time.Minute)
	}

	minute, hour, day := parts[0], parts[1], parts[2]

	if minute == "*" || minute == "*/1" {
		return fromTime.Add(1 * time.Minute)
	}

	if minute == "*/5" {
		return fromTime.Add(5 * time.Minute)
	}

	if minute == "*/15" {
		return fromTime.Add(15 * time.Minute)
	}

	if minute == "*/30" {
		return fromTime.Add(30 * time.Minute)
	}

	if hour == "*" && minute == "0" {
		return fromTime.Add(1 * time.Hour)
	}

	if day == "*" && hour == "0" && minute == "0" {
		return fromTime.Add(24 * time.Hour)
	}

	return fromTime.Add(1 * time.Hour)
}

func parseCronSchedule(schedule string) []string {
	parts := make([]string, 0)
	current := ""
	for _, char := range schedule {
		if char == ' ' {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	if len(parts) < 5 {
		return nil
	}
	return parts
}

func parseTimeToDateTime(t time.Time) types.DateTime {
	dt := types.DateTime{}
	dt.Scan(t.Format(time.RFC3339))
	return dt
}

func getStackTrace() string {
	buf := make([]byte, 4096)
	n := runtime.Stack(buf, false)
	return string(buf[:n])
}

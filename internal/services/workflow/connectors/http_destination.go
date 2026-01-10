package connectors

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

type HTTPDestinationConnector struct {
	types.BaseConnector
	client *http.Client
}

func NewHTTPDestinationConnector() types.Connector {
	configSchema := map[string]interface{}{
		"url": map[string]interface{}{
			"type":        "string",
			"title":       "URL",
			"description": "Target URL to send data to",
			"required":    true,
		},
		"method": map[string]interface{}{
			"type":        "string",
			"title":       "HTTP Method",
			"description": "HTTP method to use",
			"enum":        []string{"POST", "PUT", "PATCH"},
			"default":     "POST",
			"required":    false,
		},
		"headers": map[string]interface{}{
			"type":        "object",
			"title":       "Headers",
			"description": "HTTP headers to send with the request",
			"required":    false,
		},
		"batch_size": map[string]interface{}{
			"type":        "number",
			"title":       "Batch Size",
			"description": "Number of records to send per request (0 = all at once)",
			"default":     100,
			"minimum":     0,
			"maximum":     1000,
		},
		"timeout_seconds": map[string]interface{}{
			"type":        "number",
			"title":       "Timeout",
			"description": "Request timeout in seconds",
			"default":     30,
			"minimum":     1,
			"maximum":     300,
		},
		"retry_attempts": map[string]interface{}{
			"type":        "number",
			"title":       "Retry Attempts",
			"description": "Number of retry attempts on failure",
			"default":     3,
			"minimum":     0,
			"maximum":     10,
		},
		"retry_delay_ms": map[string]interface{}{
			"type":        "number",
			"title":       "Retry Delay",
			"description": "Delay between retries in milliseconds",
			"default":     1000,
			"minimum":     100,
			"maximum":     10000,
		},
		"format": map[string]interface{}{
			"type":        "string",
			"title":       "Payload Format",
			"description": "How to format the request body",
			"enum":        []string{"json_array", "json_object", "ndjson"},
			"default":     "json_array",
			"required":    false,
		},
	}

	connector := &HTTPDestinationConnector{
		BaseConnector: types.BaseConnector{
			ConnID:       "http_destination",
			ConnName:     "HTTP Destination",
			ConnType:     types.DestinationConnector,
			ConfigSchema: configSchema,
			Config:       make(map[string]interface{}),
		},
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
	return connector
}

func (c *HTTPDestinationConnector) Execute(ctx context.Context, input map[string]interface{}) (map[string]interface{}, error) {
	url, ok := c.Config["url"].(string)
	if !ok || url == "" {
		return nil, fmt.Errorf("URL is required")
	}

	method := "POST"
	if m, ok := c.Config["method"].(string); ok && m != "" {
		method = m
	}

	timeoutSeconds := 30
	if t, ok := c.Config["timeout_seconds"].(float64); ok {
		timeoutSeconds = int(t)
	}
	c.client.Timeout = time.Duration(timeoutSeconds) * time.Second

	retryAttempts := 3
	if r, ok := c.Config["retry_attempts"].(float64); ok {
		retryAttempts = int(r)
	}

	retryDelayMs := 1000
	if d, ok := c.Config["retry_delay_ms"].(float64); ok {
		retryDelayMs = int(d)
	}

	batchSize := 100
	if bs, ok := c.Config["batch_size"].(float64); ok {
		batchSize = int(bs)
	}

	format := "json_array"
	if f, ok := c.Config["format"].(string); ok && f != "" {
		format = f
	}

	envelope := types.FromMap(input)
	inputData := envelope.Data
	if len(inputData) == 0 {
		logger.Info.Printf("No data to send to %s", url)
		return c.createEmptyResult(envelope), nil
	}

	headers := make(map[string]string)
	if h, ok := c.Config["headers"].(map[string]interface{}); ok {
		for k, v := range h {
			if strVal, ok := v.(string); ok {
				headers[k] = strVal
			}
		}
	}

	if format == "json_array" || format == "json_object" {
		headers["Content-Type"] = "application/json"
	} else if format == "ndjson" {
		headers["Content-Type"] = "application/x-ndjson"
	}

	totalSent := 0
	totalErrors := 0
	errors := make([]string, 0)

	if batchSize <= 0 || batchSize >= len(inputData) {
		err := c.sendBatch(ctx, url, method, headers, inputData, format, retryAttempts, retryDelayMs)
		if err != nil {
			totalErrors++
			errors = append(errors, err.Error())
		} else {
			totalSent += len(inputData)
		}
	} else {
		for i := 0; i < len(inputData); i += batchSize {
			end := i + batchSize
			if end > len(inputData) {
				end = len(inputData)
			}
			batch := inputData[i:end]

			err := c.sendBatch(ctx, url, method, headers, batch, format, retryAttempts, retryDelayMs)
			if err != nil {
				totalErrors++
				if len(errors) < 10 {
					errors = append(errors, err.Error())
				}
			} else {
				totalSent += len(batch)
			}

			logger.Info.Printf("Sent batch to %s: %d records (total: %d, errors: %d)",
				url, len(batch), totalSent, totalErrors)
		}
	}

	if totalErrors > 0 && totalSent == 0 {
		return nil, fmt.Errorf("failed to send any data: %v", errors)
	}

	nodeID := c.ID()
	resultEnvelope := &types.DataEnvelope{
		Data: make([]map[string]interface{}, 0),
		Metadata: types.Metadata{
			NodeID:      nodeID,
			NodeType:    c.ConnID,
			RecordCount: 0,
			Schema:      envelope.Metadata.Schema,
			Sources:     envelope.Metadata.Sources,
			Custom: map[string]interface{}{
				"url":           url,
				"method":        method,
				"records_sent":  totalSent,
				"errors":        totalErrors,
				"error_samples": errors,
			},
		},
	}

	return resultEnvelope.ToMap(), nil
}

func (c *HTTPDestinationConnector) sendBatch(
	ctx context.Context,
	url string,
	method string,
	headers map[string]string,
	data []map[string]interface{},
	format string,
	retryAttempts int,
	retryDelayMs int,
) error {
	var body []byte
	var err error

	switch format {
	case "json_array":
		body, err = json.Marshal(data)
	case "json_object":
		wrapper := map[string]interface{}{"data": data}
		body, err = json.Marshal(wrapper)
	case "ndjson":
		var lines []byte
		for _, record := range data {
			line, jsonErr := json.Marshal(record)
			if jsonErr != nil {
				return fmt.Errorf("failed to marshal record: %w", jsonErr)
			}
			lines = append(lines, line...)
			lines = append(lines, '\n')
		}
		body = lines
	default:
		return fmt.Errorf("unsupported format: %s", format)
	}

	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	var lastErr error
	for attempt := 0; attempt <= retryAttempts; attempt++ {
		if attempt > 0 {
			delay := time.Duration(retryDelayMs) * time.Millisecond
			logger.Info.Printf("Retrying HTTP request (attempt %d/%d) after %v", attempt, retryAttempts, delay)
			time.Sleep(delay)
		}

		req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
		if err != nil {
			lastErr = fmt.Errorf("failed to create request: %w", err)
			continue
		}

		for key, value := range headers {
			req.Header.Set(key, value)
		}

		resp, err := c.client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("request failed: %w", err)
			continue
		}

		defer resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return nil
		}

		responseBody, _ := io.ReadAll(resp.Body)
		lastErr = fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(responseBody))

		if resp.StatusCode >= 400 && resp.StatusCode < 500 && resp.StatusCode != 429 {
			return lastErr
		}
	}

	return lastErr
}

func (c *HTTPDestinationConnector) createEmptyResult(envelope *types.DataEnvelope) map[string]interface{} {
	nodeID := c.ID()
	resultEnvelope := &types.DataEnvelope{
		Data: make([]map[string]interface{}, 0),
		Metadata: types.Metadata{
			NodeID:      nodeID,
			NodeType:    c.ConnID,
			RecordCount: 0,
			Schema:      envelope.Metadata.Schema,
			Sources:     envelope.Metadata.Sources,
		},
	}
	return resultEnvelope.ToMap()
}

func (c *HTTPDestinationConnector) GetOutputSchema(inputSchema *types.DataSchema) (*types.DataSchema, error) {
	if inputSchema != nil {
		return inputSchema, nil
	}
	return &types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: make([]string, 0),
	}, nil
}

func (c *HTTPDestinationConnector) ValidateInputSchema(schema *types.DataSchema) error {
	if schema == nil || len(schema.Fields) == 0 {
		return fmt.Errorf("destination connector requires input schema with at least one field")
	}
	return nil
}

package connectors

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

// HTTPConnector is a connector for making HTTP requests
// This serves as a reference implementation for SchemaAwareConnector
type HTTPConnector struct {
	types.BaseConnector
	client *http.Client
}

// NewHTTPSourceConnector creates a new HTTP source connector
func NewHTTPSourceConnector() types.Connector {
	configSchema := map[string]interface{}{
		"url": map[string]interface{}{
			"type":        "string",
			"title":       "URL",
			"description": "HTTP endpoint URL to fetch data from",
			"required":    true,
		},
		"method": map[string]interface{}{
			"type":        "string",
			"title":       "HTTP Method",
			"description": "HTTP method (GET, POST, etc.)",
			"default":     "GET",
			"enum":        []string{"GET", "POST", "PUT", "PATCH", "DELETE"},
		},
		"headers": map[string]interface{}{
			"type":        "object",
			"title":       "Headers",
			"description": "HTTP headers as key-value pairs",
			"required":    false,
		},
		"body": map[string]interface{}{
			"type":        "string",
			"title":       "Request Body",
			"description": "Request body (for POST/PUT requests)",
			"required":    false,
		},
		"timeout": map[string]interface{}{
			"type":        "number",
			"title":       "Timeout (seconds)",
			"description": "Request timeout in seconds",
			"default":     30,
			"minimum":     1,
			"maximum":     300,
		},
	}

	connector := &HTTPConnector{
		BaseConnector: types.BaseConnector{
			ConnID:       "http_source",
			ConnName:     "HTTP Source",
			ConnType:     types.SourceConnector,
			ConfigSchema: configSchema,
			Config:       make(map[string]interface{}),
		},
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
	return connector
}

// Configure sets up the HTTP connector configuration
func (c *HTTPConnector) Configure(config map[string]interface{}) error {
	c.BaseConnector.Configure(config)

	// Set HTTP client timeout if specified
	if timeout, ok := config["timeout"].(float64); ok {
		c.client.Timeout = time.Duration(timeout) * time.Second
	}

	return nil
}

// Execute makes an HTTP request and returns the response data
func (c *HTTPConnector) Execute(ctx context.Context, input map[string]interface{}) (map[string]interface{}, error) {
	url, ok := c.Config["url"].(string)
	if !ok || url == "" {
		return nil, fmt.Errorf("URL is required")
	}

	method := "GET"
	if m, ok := c.Config["method"].(string); ok && m != "" {
		method = m
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	if headers, ok := c.Config["headers"].(map[string]interface{}); ok {
		for key, value := range headers {
			if strValue, ok := value.(string); ok {
				req.Header.Set(key, strValue)
			}
		}
	}

	// Set body for POST/PUT requests
	if body, ok := c.Config["body"].(string); ok && body != "" {
		req.Body = io.NopCloser(strings.NewReader(body))
		req.ContentLength = int64(len(body))
	}

	// Make request
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse JSON response
	var responseData interface{}
	if err := json.Unmarshal(bodyBytes, &responseData); err != nil {
		// Not JSON, return as string
		responseData = string(bodyBytes)
	}

	// Convert response to records format
	records := make([]map[string]interface{}, 0)
	if dataArray, ok := responseData.([]interface{}); ok {
		// Array response
		for _, item := range dataArray {
			if itemMap, ok := item.(map[string]interface{}); ok {
				records = append(records, itemMap)
			}
		}
	} else if dataMap, ok := responseData.(map[string]interface{}); ok {
		// Object response - check for common data fields
		if items, ok := dataMap["data"].([]interface{}); ok {
			for _, item := range items {
				if itemMap, ok := item.(map[string]interface{}); ok {
					records = append(records, itemMap)
				}
			}
		} else if items, ok := dataMap["items"].([]interface{}); ok {
			for _, item := range items {
				if itemMap, ok := item.(map[string]interface{}); ok {
					records = append(records, itemMap)
				}
			}
		} else {
			// Single object - wrap in array
			records = append(records, dataMap)
		}
	}

	nodeID := c.ID()
	schema := inferSchemaFromHTTPResponse(records, nodeID)

	envelope := &types.DataEnvelope{
		Data: records,
		Metadata: types.Metadata{
			NodeID:          nodeID,
			NodeType:        c.ConnID,
			RecordCount:     len(records),
			ExecutionTimeMs: 0,
			Schema:          schema,
			Sources:         []string{nodeID},
			Custom: map[string]interface{}{
				"url":         url,
				"method":      method,
				"status_code": resp.StatusCode,
			},
		},
	}

	return envelope.ToMap(), nil
}

// GetOutputSchema returns the schema this HTTP connector produces
// For HTTP connectors, schema is inferred from the response structure
func (c *HTTPConnector) GetOutputSchema(inputSchema *types.DataSchema) (*types.DataSchema, error) {
	// Source connectors don't accept input schemas
	if inputSchema != nil {
		return nil, fmt.Errorf("source connector does not accept input schema")
	}

	// For HTTP connectors, we can't know the schema until we make the request
	// Return empty schema - will be inferred during Execute()
	return &types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: make([]string, 0),
	}, nil
}

// ValidateInputSchema validates input schema (source connectors don't accept input)
func (c *HTTPConnector) ValidateInputSchema(schema *types.DataSchema) error {
	// Source connectors don't accept input
	if schema != nil {
		return fmt.Errorf("source connector does not accept input schema")
	}
	return nil
}

// inferSchemaFromHTTPResponse infers schema from HTTP response data
func inferSchemaFromHTTPResponse(records []map[string]interface{}, nodeID string) types.DataSchema {
	schema := types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: []string{nodeID},
	}

	if len(records) == 0 {
		return schema
	}

	fieldMap := make(map[string]types.FieldDefinition)
	for _, record := range records {
		for fieldName, value := range record {
			if _, exists := fieldMap[fieldName]; !exists {
				fieldType := InferFieldType(value)
				fieldMap[fieldName] = types.FieldDefinition{
					Name:       fieldName,
					Type:       fieldType,
					SourceNode: nodeID,
					Nullable:   value == nil,
				}
			} else {
				if value == nil {
					field := fieldMap[fieldName]
					field.Nullable = true
					fieldMap[fieldName] = field
				}
			}
		}
	}

	for _, field := range fieldMap {
		schema.Fields = append(schema.Fields, field)
	}

	return schema
}

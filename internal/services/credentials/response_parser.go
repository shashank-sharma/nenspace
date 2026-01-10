package credentials

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

type TokenUsageParser interface {
	ParseTokensUsed(resp *http.Response) (int64, error)
}

type OpenAIResponseParser struct{}

func (p *OpenAIResponseParser) ParseTokensUsed(resp *http.Response) (int64, error) {
	if resp.Body == nil {
		return 0, nil
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("failed to read response body: %w", err)
	}

	resp.Body = io.NopCloser(strings.NewReader(string(bodyBytes)))

	var data map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &data); err != nil {
		return 0, nil
	}

	if usage, ok := data["usage"].(map[string]interface{}); ok {
		if totalTokens, ok := usage["total_tokens"].(float64); ok {
			return int64(totalTokens), nil
		}
	}

	return 0, nil
}

type ClaudeResponseParser struct{}

func (p *ClaudeResponseParser) ParseTokensUsed(resp *http.Response) (int64, error) {
	if resp.Body == nil {
		return 0, nil
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("failed to read response body: %w", err)
	}

	resp.Body = io.NopCloser(strings.NewReader(string(bodyBytes)))

	var data map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &data); err != nil {
		return 0, nil
	}

	if usage, ok := data["usage"].(map[string]interface{}); ok {
		var inputTokens, outputTokens int64

		if input, ok := usage["input_tokens"].(float64); ok {
			inputTokens = int64(input)
		}
		if output, ok := usage["output_tokens"].(float64); ok {
			outputTokens = int64(output)
		}

		return inputTokens + outputTokens, nil
	}

	return 0, nil
}

type GenericResponseParser struct {
	JSONPath string
}

func (p *GenericResponseParser) ParseTokensUsed(resp *http.Response) (int64, error) {
	if resp.Body == nil || p.JSONPath == "" {
		return 0, nil
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("failed to read response body: %w", err)
	}

	resp.Body = io.NopCloser(strings.NewReader(string(bodyBytes)))

	var data map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &data); err != nil {
		return 0, nil
	}

	parts := strings.Split(p.JSONPath, ".")
	var value interface{} = data

	for _, part := range parts {
		if m, ok := value.(map[string]interface{}); ok {
			value = m[part]
		} else {
			return 0, nil
		}
	}

	switch v := value.(type) {
	case float64:
		return int64(v), nil
	case int:
		return int64(v), nil
	case int64:
		return v, nil
	case string:
		if parsed, err := strconv.ParseInt(v, 10, 64); err == nil {
			return parsed, nil
		}
	}

	return 0, nil
}

func GetParserForService(service string) TokenUsageParser {
	switch service {
	case "openai":
		return &OpenAIResponseParser{}
	case "claude":
		return &ClaudeResponseParser{}
	default:
		return &GenericResponseParser{JSONPath: "usage.total_tokens"}
	}
}

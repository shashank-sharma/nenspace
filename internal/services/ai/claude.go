package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/credentials"
)

const (
	claudeAPIBaseURL = "https://api.anthropic.com/v1"
	defaultTimeout   = 30 * time.Second
)

// ClaudeClient implements the AIClient interface using Anthropic's Claude API
type ClaudeClient struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

func NewClaudeClient(apiKey string, model string) AIClient {
	return NewClaudeClientWithCredential(apiKey, model, "", "")
}

func NewClaudeClientWithCredential(apiKey string, model string, credentialID string, credentialType string) AIClient {
	if model == "" {
		model = "claude-3-sonnet-20240229"
	}

	baseClient := &http.Client{Timeout: defaultTimeout}

	var httpClient *http.Client
	if credentialID != "" && credentialType != "" {
		httpClient = credentials.NewTrackedClient(baseClient, credentialType, credentialID, "claude")
	} else {
		httpClient = credentials.NewTrackedClientWithContext(baseClient)
	}

	return &ClaudeClient{
		apiKey:     apiKey,
		model:      model,
		httpClient: httpClient,
	}
}

type claudeRequest struct {
	Model       string          `json:"model"`
	Messages    []claudeMessage `json:"messages"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
	Temperature float64         `json:"temperature,omitempty"`
	System      string          `json:"system,omitempty"`
}

type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeResponse struct {
	Content []claudeContent `json:"content"`
	Error   *claudeError    `json:"error,omitempty"`
}

type claudeContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type claudeError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

func (c *ClaudeClient) makeClaudeRequest(ctx context.Context, claudeReq claudeRequest) (string, error) {
	reqBody, err := json.Marshal(claudeReq)
	if err != nil {
		return "", fmt.Errorf("failed to marshal Claude request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/messages", claudeAPIBaseURL)
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewBuffer(reqBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	// TODO: Add credential info to context if not already present
	// This allows the tracked client to extract it
	if _, hasCred := credentials.GetCredentialFromContext(ctx); !hasCred {
		// Try to get from request context or use defaults
		// For now, the tracked client will handle it via context or service detection
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Claude API returned error status: %d, body: %s", resp.StatusCode, string(respBody))
	}

	var claudeResp claudeResponse
	if err := json.Unmarshal(respBody, &claudeResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal Claude response: %w", err)
	}

	if claudeResp.Error != nil {
		return "", fmt.Errorf("Claude API error: %s", claudeResp.Error.Message)
	}

	// Extract text from the response
	var respText string
	for _, content := range claudeResp.Content {
		if content.Type == "text" {
			respText += content.Text
		}
	}

	return strings.TrimSpace(respText), nil
}

// Summarize implements the AIClient.Summarize method
func (c *ClaudeClient) Summarize(ctx context.Context, req *SummarizeRequest) (*SummarizeResponse, error) {
	if req.Text == "" {
		return &SummarizeResponse{Summary: ""}, nil
	}

	// Default max length
	maxLength := 150
	if req.MaxLength > 0 {
		maxLength = req.MaxLength
	}

	prompt := fmt.Sprintf(
		"Summarize the following text in a concise, informative way in %d characters or less:\n\n%s",
		maxLength,
		req.Text,
	)

	// Create the Claude request
	claudeReq := claudeRequest{
		Model: c.model,
		Messages: []claudeMessage{
			{
				Role:    "user",
				Content: prompt,
			},
		},
		MaxTokens:   int(float64(maxLength) * 0.5), // Estimate tokens from characters
		Temperature: 0.3,                           // Lower temperature for more focused summaries
	}

	response, err := c.makeClaudeRequest(ctx, claudeReq)
	if err != nil {
		logger.LogError(fmt.Sprintf("Claude summarization error: %v", err))
		return nil, fmt.Errorf("failed to generate summary: %w", err)
	}

	return &SummarizeResponse{
		Summary: response,
	}, nil
}

// SuggestTags implements the AIClient.SuggestTags method
func (c *ClaudeClient) SuggestTags(ctx context.Context, req *TagRequest) (*TagResponse, error) {
	if req.Content == "" && req.Title == "" {
		return &TagResponse{Tags: []string{}}, nil
	}

	// Default max tags
	maxTags := 5
	if req.MaxTags > 0 {
		maxTags = req.MaxTags
	}

	content := req.Content
	if content == "" {
		content = req.Title
	} else if req.Title != "" {
		content = req.Title + "\n\n" + content
	}

	prompt := fmt.Sprintf(
		"Extract up to %d relevant tags from the following content. Return only a JSON array of tag strings, with no explanations:\n\n%s",
		maxTags,
		content,
	)

	claudeReq := claudeRequest{
		Model: c.model,
		Messages: []claudeMessage{
			{
				Role:    "user",
				Content: prompt,
			},
		},
		MaxTokens:   100,
		Temperature: 0.3,
		System:      "You are a tagging assistant. Your job is to extract relevant tags from content. Always return tags as a JSON array of strings.",
	}

	response, err := c.makeClaudeRequest(ctx, claudeReq)
	if err != nil {
		logger.LogError(fmt.Sprintf("Claude tagging error: %v", err))
		return nil, fmt.Errorf("failed to generate tags: %w", err)
	}

	// Parse the JSON response
	tagsContent := strings.TrimSpace(response)

	// Handle case where the AI might include explanation text
	if !strings.HasPrefix(tagsContent, "[") {
		// Try to find JSON array in the response
		startIdx := strings.Index(tagsContent, "[")
		endIdx := strings.LastIndex(tagsContent, "]")
		if startIdx >= 0 && endIdx > startIdx {
			tagsContent = tagsContent[startIdx : endIdx+1]
		} else {
			// Fallback if we can't find JSON
			return &TagResponse{
				Tags: []string{},
			}, nil
		}
	}

	var tags []string
	if err := json.Unmarshal([]byte(tagsContent), &tags); err != nil {
		logger.LogError(fmt.Sprintf("Failed to parse tags JSON: %v, content: %s", err, tagsContent))

		// Try a fallback approach - split by commas and clean up
		tags = []string{}
		for _, tag := range strings.Split(tagsContent, ",") {
			tag = strings.Trim(tag, "\"[] \t\n")
			if tag != "" {
				tags = append(tags, tag)
			}
		}
	}

	// Limit to requested max tags
	if len(tags) > maxTags {
		tags = tags[:maxTags]
	}

	return &TagResponse{
		Tags: tags,
	}, nil
}

// ClassifyContent implements the AIClient.ClassifyContent method
func (c *ClaudeClient) ClassifyContent(ctx context.Context, req *ClassifyRequest) (*ClassifyResponse, error) {
	if (req.Content == "" && req.Title == "") || len(req.Labels) == 0 {
		return &ClassifyResponse{
			Label:       "",
			Confidence:  0,
			OtherLabels: map[string]float64{},
		}, nil
	}

	content := req.Content
	if content == "" {
		content = req.Title
	} else if req.Title != "" {
		content = req.Title + "\n\n" + content
	}

	labelsStr := strings.Join(req.Labels, ", ")
	prompt := fmt.Sprintf(
		"Classify the following content into one of these categories: %s.\nReturn a JSON object with keys: 'label' (string), 'confidence' (float 0-1), and 'otherLabels' (map of label to confidence).\n\nContent:\n%s",
		labelsStr,
		content,
	)

	claudeReq := claudeRequest{
		Model: c.model,
		Messages: []claudeMessage{
			{
				Role:    "user",
				Content: prompt,
			},
		},
		MaxTokens:   150,
		Temperature: 0.2,
		System:      "You are a classification assistant. Your job is to classify content into predefined categories. Always return a JSON object with the structure: {\"label\": string, \"confidence\": float, \"otherLabels\": {string: float}}",
	}

	response, err := c.makeClaudeRequest(ctx, claudeReq)
	if err != nil {
		logger.LogError(fmt.Sprintf("Claude classification error: %v", err))
		return nil, fmt.Errorf("failed to classify content: %w", err)
	}

	respContent := strings.TrimSpace(response)

	// Extract JSON from the response
	startIdx := strings.Index(respContent, "{")
	endIdx := strings.LastIndex(respContent, "}")
	if startIdx >= 0 && endIdx > startIdx {
		respContent = respContent[startIdx : endIdx+1]
	}

	var result ClassifyResponse
	if err := json.Unmarshal([]byte(respContent), &result); err != nil {
		logger.LogError(fmt.Sprintf("Failed to parse classification JSON: %v, content: %s", err, respContent))

		// Fallback to first label with zero confidence
		if len(req.Labels) > 0 {
			return &ClassifyResponse{
				Label:       req.Labels[0],
				Confidence:  0,
				OtherLabels: map[string]float64{},
			}, nil
		}
		return nil, fmt.Errorf("failed to parse classification response: %w", err)
	}

	return &result, nil
}

// RecommendContent implements the AIClient.RecommendContent method
func (c *ClaudeClient) RecommendContent(ctx context.Context, req *RecommendRequest) (*RecommendResponse, error) {
	if req.Item == nil || req.UserID == "" {
		return &RecommendResponse{
			Score:       0,
			Explanation: "Insufficient data for recommendation",
		}, nil
	}

	// Format user metadata
	userMetadataBytes, _ := json.Marshal(req.UserMetadata)
	userMetadataStr := string(userMetadataBytes)

	// Create the prompt
	prompt := fmt.Sprintf(
		"Evaluate how relevant this content is to the user based on the given metadata.\n\nContent Title: %s\nContent Tags: %v\nContent Summary: %s\n\nUser Metadata: %s\n\nReturn a JSON object with keys: 'score' (float 0-1) and 'explanation' (string with brief reason).",
		req.Item.Title,
		req.Item.Tags,
		req.Item.Summary,
		userMetadataStr,
	)

	// Create the Claude request
	claudeReq := claudeRequest{
		Model: c.model,
		Messages: []claudeMessage{
			{
				Role:    "user",
				Content: prompt,
			},
		},
		MaxTokens:   150,
		Temperature: 0.3,
		System:      "You are a recommendation assistant. Your job is to score content relevance for users. Always return a JSON object with the structure: {\"score\": float, \"explanation\": string}",
	}

	response, err := c.makeClaudeRequest(ctx, claudeReq)
	if err != nil {
		logger.LogError(fmt.Sprintf("Claude recommendation error: %v", err))
		return nil, fmt.Errorf("failed to generate recommendation: %w", err)
	}

	// Parse the JSON response
	respContent := strings.TrimSpace(response)

	// Extract JSON from the response
	startIdx := strings.Index(respContent, "{")
	endIdx := strings.LastIndex(respContent, "}")
	if startIdx >= 0 && endIdx > startIdx {
		respContent = respContent[startIdx : endIdx+1]
	}

	var result RecommendResponse
	if err := json.Unmarshal([]byte(respContent), &result); err != nil {
		logger.LogError(fmt.Sprintf("Failed to parse recommendation JSON: %v, content: %s", err, respContent))

		// Fallback to neutral score
		return &RecommendResponse{
			Score:       0.5,
			Explanation: "Error parsing recommendation response",
		}, nil
	}

	return &result, nil
}

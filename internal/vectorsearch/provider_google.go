package vectorsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"

	"github.com/shashank-sharma/backend/internal/logger"
)

// GoogleAIProvider implements the EmbeddingProvider interface using Google's API
type GoogleAIProvider struct {
	client     *http.Client
	model      string
	apiKey     string
	dimensions int
	endpoint   string
	mu         sync.Mutex
	initialized bool
}

// Google API request/response types
type embeddingRequest struct {
	Model string `json:"model"`
	Input struct {
		Text string `json:"text"`
	} `json:"input"`
}

type embeddingResponse struct {
	Embedding []float32 `json:"embedding"`
	Usage     struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
}

func init() {
	// Register the Google AI provider factory
	RegisterProvider("google", NewGoogleAIProvider)
}

// NewGoogleAIProvider creates a new Google AI embedding provider
func NewGoogleAIProvider(options ProviderOptions) (EmbeddingProvider, error) {
	if options.APIKey == "" {
		return nil, fmt.Errorf("Google AI API key is required")
	}

	model := options.Model
	if model == "" {
		model = "text-embedding-004" // Default model
	}

	dimensions := options.Dimensions
	if dimensions == 0 {
		dimensions = 768 // Default dimensions for text-embedding-004
	}

	return &GoogleAIProvider{
		apiKey:     options.APIKey,
		model:      model,
		dimensions: dimensions,
		endpoint:   "https://generativelanguage.googleapis.com/v1beta/models/",
		client:     &http.Client{},
	}, nil
}

// Initialize sets up the Google AI client
func (p *GoogleAIProvider) Initialize() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.initialized {
		return nil
	}

	// No special initialization needed for HTTP client
	p.initialized = true
	return nil
}

// GenerateEmbedding creates an embedding for the provided text
func (p *GoogleAIProvider) GenerateEmbedding(ctx context.Context, text string) ([]float32, error) {
	if !p.initialized || p.client == nil {
		return nil, ErrProviderNotInitialized
	}

	if text == "" {
		return nil, ErrInvalidInput
	}

	// Prepare the request
	reqData := embeddingRequest{
		Model: p.model,
	}
	reqData.Input.Text = text

	jsonData, err := json.Marshal(reqData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s%s:embedText?key=%s", p.endpoint, p.model, p.apiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Send the request
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: request failed: %v", ErrEmbeddingGeneration, err)
	}
	defer resp.Body.Close()

	// Check for non-200 responses
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		logger.LogError("Google AI API error", "status", resp.Status, "body", string(body))
		return nil, fmt.Errorf("%w: API returned status %d", ErrEmbeddingGeneration, resp.StatusCode)
	}

	// Parse the response
	var respData embeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&respData); err != nil {
		return nil, fmt.Errorf("%w: failed to decode response: %v", ErrEmbeddingGeneration, err)
	}

	if len(respData.Embedding) == 0 {
		return nil, fmt.Errorf("%w: empty embedding returned", ErrEmbeddingGeneration)
	}

	return respData.Embedding, nil
}

// BatchGenerateEmbeddings creates embeddings for multiple texts
func (p *GoogleAIProvider) BatchGenerateEmbeddings(ctx context.Context, texts []string) ([][]float32, error) {
	if !p.initialized || p.client == nil {
		return nil, ErrProviderNotInitialized
	}

	if len(texts) == 0 {
		return nil, ErrInvalidInput
	}

	results := make([][]float32, len(texts))
	
	// Process each text individually
	for i, text := range texts {
		embedding, err := p.GenerateEmbedding(ctx, text)
		if err != nil {
			return nil, err
		}
		results[i] = embedding
	}

	return results, nil
}

// Dimensions returns the dimensionality of the embeddings
func (p *GoogleAIProvider) Dimensions() int {
	return p.dimensions
}

// Name returns the provider name
func (p *GoogleAIProvider) Name() string {
	return "google"
} 
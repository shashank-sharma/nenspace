package ai

import (
	"context"
)

// ChatRequest contains parameters for chat operations
type ChatRequest struct {
	Messages      []ChatMessage `json:"messages"`      // Conversation history
	Model         string        `json:"model"`         // Model identifier (e.g., "openai/gpt-4")
	SystemPrompt  string        `json:"system_prompt,omitempty"`
	Temperature   float64       `json:"temperature,omitempty"`
	MaxTokens     int           `json:"max_tokens,omitempty"`
	Stream        bool          `json:"stream,omitempty"`        // Whether to stream response
	StreamID      string        `json:"stream_id,omitempty"`     // Stream identifier for cancellation
}

// ChatMessageContent represents content in a multimodal message
type ChatMessageContent struct {
	Type     string `json:"type"`               // "text" or "image_url"
	Text     string `json:"text,omitempty"`     // Text content (for type="text")
	ImageURL string `json:"image_url,omitempty"` // Image URL (for type="image_url")
}

// ChatMessage represents a single message in a chat conversation
// Supports both simple text content and multimodal content (text + images)
type ChatMessage struct {
	Role       string                 `json:"role"`                  // user, assistant, system
	Content    interface{}            `json:"content"`                // Can be string or []ChatMessageContent for multimodal
	Attachments []map[string]interface{} `json:"attachments,omitempty"` // File attachments metadata
}

// ChatResponse contains the result of a non-streaming chat operation
type ChatResponse struct {
	Content    string                 `json:"content"`              // Generated content
	Model      string                 `json:"model,omitempty"`      // Model used
	Tokens     int                    `json:"tokens,omitempty"`     // Token count
	Metadata   map[string]interface{} `json:"metadata,omitempty"`   // Additional metadata (sources, reasoning, etc.)
}

// ChatChunk represents a streaming chunk of chat response
type ChatChunk struct {
	Content   string                 `json:"content"`              // Chunk content
	Done      bool                   `json:"done"`                 // Whether streaming is complete
	Tokens    int                    `json:"tokens,omitempty"`     // Cumulative token count
	Metadata  map[string]interface{} `json:"metadata,omitempty"`   // Additional metadata
	Error     string                 `json:"error,omitempty"`      // Error message if any
}

// ChatAIClient extends AIClient for chat-specific operations
type ChatAIClient interface {
	AIClient // Inherit existing methods (Summarize, SuggestTags, etc.)
	
	// StreamChat streams a chat response chunk by chunk
	StreamChat(ctx context.Context, req *ChatRequest) (<-chan ChatChunk, error)
	
	// SendChat sends a chat request and returns the complete response (non-streaming)
	SendChat(ctx context.Context, req *ChatRequest) (*ChatResponse, error)
	
	// CancelStream cancels an ongoing stream by stream ID
	CancelStream(ctx context.Context, streamID string) error
	
	// ListModels returns available models from the provider
	ListModels(ctx context.Context) ([]ModelInfo, error)
}

// ModelInfo represents information about an available model
type ModelInfo struct {
	ID          string   `json:"id"`          // Model identifier (e.g., "openai/gpt-4")
	Name        string   `json:"name"`        // Display name
	Provider    string   `json:"provider"`    // Provider name (e.g., "openai", "anthropic")
	MaxTokens   int      `json:"max_tokens,omitempty"`   // Maximum context length
	SupportsStreaming bool `json:"supports_streaming"`   // Whether model supports streaming
	SupportsTools     bool `json:"supports_tools"`       // Whether model supports tool calls
	Pricing     *ModelPricing `json:"pricing,omitempty"` // Pricing information
}

// ModelPricing represents pricing information for a model
type ModelPricing struct {
	InputCostPerToken  float64 `json:"input_cost_per_token,omitempty"`  // Cost per input token
	OutputCostPerToken float64 `json:"output_cost_per_token,omitempty"` // Cost per output token
}

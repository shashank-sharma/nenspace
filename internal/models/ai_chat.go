package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*Conversation)(nil)
var _ core.Model = (*ChatMessage)(nil)
var _ core.Model = (*ModelPreset)(nil)
var _ core.Model = (*ChatSettings)(nil)
var _ core.Model = (*ChatUsageStats)(nil)

// Conversation represents a chat conversation
type Conversation struct {
	BaseModel

	User        string         `db:"user" json:"user"`
	Title       string         `db:"title" json:"title"`
	Model       string         `db:"model" json:"model"` // Model identifier used (e.g., "openai/gpt-4")
	SystemPrompt string         `db:"system_prompt" json:"system_prompt,omitempty"`
	Settings    types.JSONRaw  `db:"settings" json:"settings,omitempty"` // {temperature, max_tokens, etc.}
	IsFavorite  bool           `db:"is_favorite" json:"is_favorite"`
	Tags        types.JSONRaw  `db:"tags" json:"tags"` // Array of strings: ["coding", "writing"]
	Archived    bool           `db:"archived" json:"archived"`
}

// ChatMessage represents a message in a conversation
type ChatMessage struct {
	BaseModel

	ConversationID string         `db:"conversation" json:"conversation"`
	Role           string         `db:"role" json:"role"` // user, assistant, system
	Content        string         `db:"content" json:"content"`
	ModelUsed      string         `db:"model_used" json:"model_used,omitempty"`
	Tokens         int            `db:"tokens" json:"tokens,omitempty"` // Token count for this message
	ParentMessage  string         `db:"parent_message" json:"parent_message,omitempty"` // For branching
	Metadata       types.JSONRaw  `db:"metadata" json:"metadata,omitempty"` // {files, reactions, sources, reasoning}
}

// ModelPreset represents saved model configurations
type ModelPreset struct {
	BaseModel

	User         string  `db:"user" json:"user"`
	Name         string  `db:"name" json:"name"` // "Creative Writer", "Code Helper"
	Model        string  `db:"model" json:"model"`
	Temperature  float64 `db:"temperature" json:"temperature"`
	MaxTokens    int     `db:"max_tokens" json:"max_tokens"`
	SystemPrompt string  `db:"system_prompt" json:"system_prompt,omitempty"`
	IsDefault    bool    `db:"is_default" json:"is_default"`
}

// ChatSettings represents user preferences for chat
type ChatSettings struct {
	BaseModel

	User               string         `db:"user" json:"user"` // Unique per user
	DefaultModel       string         `db:"default_model" json:"default_model"`
	Theme              string         `db:"theme" json:"theme"` // "light" | "dark" | "auto"
	StatusWindowPosition types.JSONRaw `db:"status_window_position" json:"status_window_position,omitempty"` // {x, y} for Tauri
	KeyboardShortcuts  types.JSONRaw  `db:"keyboard_shortcuts" json:"keyboard_shortcuts,omitempty"` // {new_chat: "cmd+k", export: "cmd+e"}
}

// ChatUsageStats represents usage statistics for tracking
type ChatUsageStats struct {
	BaseModel

	User         string         `db:"user" json:"user"`
	Conversation string         `db:"conversation" json:"conversation,omitempty"`
	Date         types.DateTime `db:"date" json:"date"`
	TokensUsed   int            `db:"tokens_used" json:"tokens_used"`
	RequestsCount int           `db:"requests_count" json:"requests_count"`
	Cost         float64        `db:"cost" json:"cost,omitempty"` // If available
	Model        string         `db:"model" json:"model"`
}

func (m *Conversation) TableName() string {
	return "chat_conversations"
}

func (m *ChatMessage) TableName() string {
	return "chat_messages"
}

func (m *ModelPreset) TableName() string {
	return "chat_model_presets"
}

func (m *ChatSettings) TableName() string {
	return "chat_settings"
}

func (m *ChatUsageStats) TableName() string {
	return "chat_usage_stats"
}

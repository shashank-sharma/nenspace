package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/ai"
	"github.com/shashank-sharma/backend/internal/util"
)

// ChatService handles chat operations
type ChatService struct {
	chatClient        ai.ChatAIClient
	attachmentService *AttachmentService
}

// NewChatService creates a new chat service
func NewChatService(chatClient ai.ChatAIClient, attachmentService *AttachmentService) *ChatService {
	return &ChatService{
		chatClient:        chatClient,
		attachmentService: attachmentService,
	}
}

// getOpenRouterAPIKey fetches the user's active OpenRouter API key from the api_keys collection.
// Returns an error if no valid key is found or if all keys are expired.
func getOpenRouterAPIKey(userID string) (string, error) {
	// Try to fetch user's active OpenRouter API key
	apiKeys, err := query.FindAllByFilter[*models.ApiKey](map[string]interface{}{
		"user":      userID,
		"service":   "openrouter",
		"is_active": true,
	})
	if err != nil {
		return "", fmt.Errorf("failed to fetch API keys: %w", err)
	}

	if len(apiKeys) == 0 {
		return "", fmt.Errorf("no OpenRouter API key found for user. Please configure your API key in the frontend")
	}

	// Use the first active key (prefer non-expired keys if available)
	var selectedKey *models.ApiKey
	for _, key := range apiKeys {
		// Prefer non-expired keys
		if key.Expires.IsZero() || key.Expires.Time().After(time.Now()) {
			selectedKey = key
			break
		}
	}

	// If no non-expired key found, use the first one anyway
	if selectedKey == nil {
		selectedKey = apiKeys[0]
	}

	// Check if key is expired
	if !selectedKey.Expires.IsZero() && selectedKey.Expires.Time().Before(time.Now()) {
		return "", fmt.Errorf("user's OpenRouter API key is expired. Please update your API key in the frontend (keyId: %s)", selectedKey.Id)
	}

	logger.LogInfo("Using user's OpenRouter API key", "userId", userID, "keyId", selectedKey.Id, "keyName", selectedKey.Name)
	return selectedKey.Key, nil
}

// getChatClientForUser returns a ChatAIClient for the given user.
// Creates a new OpenRouter client using the user's API key from the collection.
func (s *ChatService) getChatClientForUser(userID string) (ai.ChatAIClient, error) {
	apiKey, err := getOpenRouterAPIKey(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get OpenRouter API key: %w", err)
	}

	return ai.NewOpenRouterClient(apiKey), nil
}

// CreateConversation creates a new conversation
func (s *ChatService) CreateConversation(userID string, title string, model string, systemPrompt string, settings map[string]interface{}) (*models.Conversation, error) {
	conv := &models.Conversation{
		User:         userID,
		Title:        title,
		Model:        model,
		SystemPrompt: systemPrompt,
		IsFavorite:   false,
		Archived:     false,
	}

	if settings != nil {
		settingsJSON, err := json.Marshal(settings)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal settings: %w", err)
		}
		conv.Settings = types.JSONRaw(settingsJSON)
	}

	conv.SetId(util.GenerateRandomId())
	conv.RefreshCreated()
	conv.RefreshUpdated()

	if err := query.SaveRecord(conv); err != nil {
		return nil, fmt.Errorf("failed to save conversation: %w", err)
	}

	return conv, nil
}

// GetConversation retrieves a conversation by ID
func (s *ChatService) GetConversation(conversationID string, userID string) (*models.Conversation, error) {
	conv, err := query.FindById[*models.Conversation](conversationID)
	if err != nil {
		return nil, fmt.Errorf("conversation not found: %w", err)
	}

	if conv.User != userID {
		return nil, fmt.Errorf("unauthorized")
	}

	return conv, nil
}

// ListConversations lists conversations for a user with optional filters
func (s *ChatService) ListConversations(userID string, filters map[string]interface{}, limit int, offset int) ([]*models.Conversation, int64, error) {
	filter := map[string]interface{}{
		"user": userID,
	}

	for k, v := range filters {
		filter[k] = v
	}

	conversations, err := query.FindAllByFilterWithPagination[*models.Conversation](filter, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list conversations: %w", err)
	}

	total, err := query.CountRecords[*models.Conversation](filter)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count conversations: %w", err)
	}

	return conversations, total, nil
}

// UpdateConversation updates a conversation
func (s *ChatService) UpdateConversation(conversationID string, userID string, updates map[string]interface{}) (*models.Conversation, error) {
	conv, err := query.FindById[*models.Conversation](conversationID)
	if err != nil {
		return nil, fmt.Errorf("conversation not found: %w", err)
	}

	if conv.User != userID {
		return nil, fmt.Errorf("unauthorized")
	}

	if title, ok := updates["title"].(string); ok {
		conv.Title = title
	}

	if model, ok := updates["model"].(string); ok {
		conv.Model = model
	}

	if systemPrompt, ok := updates["system_prompt"].(string); ok {
		conv.SystemPrompt = systemPrompt
	}

	if isFavorite, ok := updates["is_favorite"].(bool); ok {
		conv.IsFavorite = isFavorite
	}

	if archived, ok := updates["archived"].(bool); ok {
		conv.Archived = archived
	}

	if tags, ok := updates["tags"].([]string); ok {
		tagsJSON, err := json.Marshal(tags)
		if err == nil {
			conv.Tags = types.JSONRaw(tagsJSON)
		}
	}

	if settings, ok := updates["settings"].(map[string]interface{}); ok {
		settingsJSON, err := json.Marshal(settings)
		if err == nil {
			conv.Settings = types.JSONRaw(settingsJSON)
		}
	}

	conv.RefreshUpdated()

	if err := query.SaveRecord(conv); err != nil {
		return nil, fmt.Errorf("failed to update conversation: %w", err)
	}

	return conv, nil
}

// DeleteConversation deletes a conversation
func (s *ChatService) DeleteConversation(conversationID string, userID string) error {
	conv, err := query.FindById[*models.Conversation](conversationID)
	if err != nil {
		return fmt.Errorf("conversation not found: %w", err)
	}

	if conv.User != userID {
		return fmt.Errorf("unauthorized")
	}

	return query.DeleteById[*models.Conversation](conversationID)
}

// GetMessages retrieves messages for a conversation with pagination
func (s *ChatService) GetMessages(conversationID string, userID string, limit int, offset int) ([]*models.ChatMessage, int64, error) {
	conv, err := query.FindById[*models.Conversation](conversationID)
	if err != nil {
		return nil, 0, fmt.Errorf("conversation not found: %w", err)
	}

	if conv.User != userID {
		return nil, 0, fmt.Errorf("unauthorized")
	}

	filter := map[string]interface{}{
		"conversation": conversationID,
	}

	messages, err := query.FindAllByFilterWithPagination[*models.ChatMessage](filter, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list messages: %w", err)
	}

	total, err := query.CountRecords[*models.ChatMessage](filter)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count messages: %w", err)
	}

	return messages, total, nil
}

// GetAttachmentsForMessages retrieves attachments for multiple messages
func (s *ChatService) GetAttachmentsForMessages(messageIDs []string) (map[string][]*models.ChatMessageAttachment, error) {
	result := make(map[string][]*models.ChatMessageAttachment)
	for _, messageID := range messageIDs {
		attachments, err := s.attachmentService.GetAttachmentsForMessage(messageID)
		if err != nil {
			continue
		}
		result[messageID] = attachments
	}
	return result, nil
}

// CreateMessage creates a new message in a conversation
func (s *ChatService) CreateMessage(conversationID string, userID string, role string, content string, modelUsed string, tokens int, metadata map[string]interface{}) (*models.ChatMessage, error) {
	conv, err := query.FindById[*models.Conversation](conversationID)
	if err != nil {
		return nil, fmt.Errorf("conversation not found: %w", err)
	}

	if conv.User != userID {
		return nil, fmt.Errorf("unauthorized")
	}

	msg := &models.ChatMessage{
		ConversationID: conversationID,
		Role:           role,
		Content:        content,
		ModelUsed:      modelUsed,
		Tokens:         tokens,
	}

	if metadata != nil {
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal metadata: %w", err)
		}
		msg.Metadata = types.JSONRaw(metadataJSON)
	}

	msg.SetId(util.GenerateRandomId())
	msg.RefreshCreated()
	msg.RefreshUpdated()

	if err := query.SaveRecord(msg); err != nil {
		return nil, fmt.Errorf("failed to save message: %w", err)
	}

	conv.RefreshUpdated()
	if err := query.SaveRecord(conv); err != nil {
		logger.LogError("Failed to update conversation timestamp", "error", err)
	}

	return msg, nil
}

// SendMessage sends a message to the AI and streams the response
func (s *ChatService) SendMessage(ctx context.Context, conversationID string, userID string, content string, streamID string, attachmentIDs []string) (<-chan ai.ChatChunk, error) {
	// Get user-specific chat client
	chatClient, err := s.getChatClientForUser(userID)
	if err != nil {
		return nil, fmt.Errorf("AI client not available: %w", err)
	}

	conv, err := query.FindById[*models.Conversation](conversationID)
	if err != nil {
		return nil, fmt.Errorf("conversation not found: %w", err)
	}

	if conv.User != userID {
		return nil, fmt.Errorf("unauthorized")
	}

	messages, _, err := s.GetMessages(conversationID, userID, 100, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages: %w", err)
	}

	chatMessages := make([]ai.ChatMessage, 0, len(messages)+2)

	if conv.SystemPrompt != "" {
		chatMessages = append(chatMessages, ai.ChatMessage{
			Role:    "system",
			Content: conv.SystemPrompt,
		})
	}

	for _, msg := range messages {
		chatMessages = append(chatMessages, ai.ChatMessage{
			Role:    msg.Role,
			Content: msg.Content,
		})
	}

	userMsg, err := s.CreateMessage(conversationID, userID, "user", content, "", 0, nil)
	if err != nil {
		logger.LogError("Failed to create user message", "error", err, "conversationId", conversationID, "userId", userID)
		return nil, fmt.Errorf("failed to create user message: %w", err)
	}

	var dbAttachments []*models.ChatMessageAttachment
	if len(attachmentIDs) > 0 {
		if err := s.attachmentService.LinkAttachmentsToMessage(attachmentIDs, userMsg.Id, userID); err != nil {
			logger.LogError("Failed to link attachments to message", "error", err)
			return nil, fmt.Errorf("failed to link attachments: %w", err)
		}

		dbAttachments, err = s.attachmentService.GetAttachmentsForMessage(userMsg.Id)
		if err != nil {
			logger.LogError("Failed to get attachments for message", "error", err)
		}
	}

	if len(dbAttachments) > 0 {
		contentParts := make([]map[string]interface{}, 0)

		if content != "" {
			contentParts = append(contentParts, map[string]interface{}{
				"type": "text",
				"text": content,
			})
		}

		for _, att := range dbAttachments {
			if strings.HasPrefix(att.MimeType, "image/") {
				dataURL, err := s.attachmentService.GetFileAsBase64(att)
				if err != nil {
					logger.LogWarning("Failed to convert image to base64", "attachmentId", att.Id, "error", err)
					continue
				}
				contentParts = append(contentParts, map[string]interface{}{
					"type": "image_url",
					"image_url": map[string]interface{}{
						"url": dataURL,
					},
				})
			} else {
				fileURL := s.attachmentService.GetFileURL(att)
				fileInfo := fmt.Sprintf("File: %s (%s)", att.Filename, att.MimeType)
				if fileURL != "" {
					fileInfo += fmt.Sprintf(" - %s", fileURL)
				}
				contentParts = append(contentParts, map[string]interface{}{
					"type": "text",
					"text": fileInfo,
				})
			}
		}

		chatMessages = append(chatMessages, ai.ChatMessage{
			Role:    "user",
			Content: contentParts,
		})
	} else {
		chatMessages = append(chatMessages, ai.ChatMessage{
			Role:    "user",
			Content: content,
		})
	}

	var settings map[string]interface{}
	if len(conv.Settings) > 0 {
		if err := json.Unmarshal(conv.Settings, &settings); err != nil {
			settings = nil
		}
	}

	temperature := 0.7
	maxTokens := 2000

	if settings != nil {
		if temp, ok := settings["temperature"].(float64); ok {
			temperature = temp
		}
		if max, ok := settings["max_tokens"].(float64); ok {
			maxTokens = int(max)
		}
	}

	req := &ai.ChatRequest{
		Messages:     chatMessages,
		Model:        conv.Model,
		SystemPrompt: conv.SystemPrompt,
		Temperature:  temperature,
		MaxTokens:    maxTokens,
		Stream:       true,
		StreamID:     streamID,
	}

	chunks, err := chatClient.StreamChat(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to stream chat: %w", err)
	}

	return s.handleStream(ctx, chunks, conversationID, userID, conv.Model, userMsg), nil
}

// handleStream processes streaming chunks and saves them to the database
func (s *ChatService) handleStream(ctx context.Context, chunks <-chan ai.ChatChunk, conversationID string, userID string, model string, userMsg *models.ChatMessage) <-chan ai.ChatChunk {
	resultCh := make(chan ai.ChatChunk, 100)
	var assistantMsg *models.ChatMessage
	var assistantContent strings.Builder
	var totalTokens int

	go func() {
		defer close(resultCh)

		for chunk := range chunks {
			select {
			case <-ctx.Done():
				return
			default:
			}

			if chunk.Error != "" {
				resultCh <- chunk
				break
			}

			// Best practice: Only process content from incremental chunks (delta)
			// Final chunk (done=true) should have empty content and only signal completion
			if chunk.Content != "" && !chunk.Done {
				// Append incremental delta content
				assistantContent.WriteString(chunk.Content)

				if assistantMsg == nil {
					msg, err := s.CreateMessage(conversationID, userID, "assistant", "", model, 0, nil)
					if err != nil {
						logger.LogError("Failed to create assistant message", "error", err)
						resultCh <- chunk
						continue
					}
					assistantMsg = msg
				}

				assistantMsg.Content = assistantContent.String()
				assistantMsg.RefreshUpdated()

				// Update message on each chunk for real-time UI updates
				if err := query.SaveRecord(assistantMsg); err != nil {
					logger.LogError("Failed to update assistant message", "error", err)
				}
			}

			if chunk.Tokens > 0 {
				totalTokens = chunk.Tokens
			}

			resultCh <- chunk

			if chunk.Done {
				if assistantMsg != nil {
					assistantMsg.Tokens = totalTokens
					assistantMsg.RefreshUpdated()

					if err := query.SaveRecord(assistantMsg); err != nil {
						logger.LogError("Failed to save final assistant message", "error", err)
					}

					s.recordUsage(userID, conversationID, model, totalTokens)
				}
				break
			}
		}
	}()

	return resultCh
}

// recordUsage records usage statistics
func (s *ChatService) recordUsage(userID string, conversationID string, model string, tokens int) {
	today := types.NowDateTime()
	todayStr := today.Time().Format("2006-01-02")

	dateTime, err := time.Parse("2006-01-02", todayStr)
	if err != nil {
		logger.LogError("Failed to parse date for usage stats", "error", err)
		return
	}

	var statsDate types.DateTime
	statsDate.Scan(dateTime)

	stats, err := query.FindByFilter[*models.ChatUsageStats](map[string]interface{}{
		"user":  userID,
		"date":  statsDate,
		"model": model,
	})

	if err != nil {
		stats = &models.ChatUsageStats{
			User:          userID,
			Conversation:  conversationID,
			Date:          statsDate,
			TokensUsed:    tokens,
			RequestsCount: 1,
			Model:         model,
		}
		stats.SetId(util.GenerateRandomId())
		stats.RefreshCreated()
		stats.RefreshUpdated()
	} else {
		stats.TokensUsed += tokens
		stats.RequestsCount++
		stats.RefreshUpdated()
	}

	if err := query.SaveRecord(stats); err != nil {
		logger.LogError("Failed to record usage stats", "error", err)
	}
}

// CancelStream cancels an ongoing stream
// Note: This requires the streamID to be associated with a user, or we need to track user->streamID mapping
// TODO: Refactor to accept userID and use getChatClientForUser(userID) instead of fallback client
func (s *ChatService) CancelStream(ctx context.Context, streamID string) error {
	if s.chatClient == nil {
		return fmt.Errorf("stream cancellation not available: requires user-specific API key. This method needs to be refactored to accept userID")
	}

	return s.chatClient.CancelStream(ctx, streamID)
}

// GetChatClientForUser is a public method to get a chat client for a user.
// Useful for route handlers that need to call ListModels with user-specific keys.
func (s *ChatService) GetChatClientForUser(userID string) (ai.ChatAIClient, error) {
	return s.getChatClientForUser(userID)
}

// SearchConversations performs full-text search on conversations and messages
func (s *ChatService) SearchConversations(userID string, queryStr string, limit int, offset int) ([]*models.Conversation, int64, error) {
	filter := map[string]interface{}{
		"user": userID,
	}

	conversations, err := query.FindAllByFilterWithPagination[*models.Conversation](filter, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search conversations: %w", err)
	}

	queryLower := strings.ToLower(queryStr)
	filtered := make([]*models.Conversation, 0)

	for _, conv := range conversations {
		if strings.Contains(strings.ToLower(conv.Title), queryLower) ||
			strings.Contains(strings.ToLower(conv.SystemPrompt), queryLower) {
			filtered = append(filtered, conv)
		}
	}

	return filtered, int64(len(filtered)), nil
}

package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/ai"
	"github.com/shashank-sharma/backend/internal/services/chat"
	"github.com/shashank-sharma/backend/internal/util"
)

// extractTokenFromHeader extracts the JWT token from Authorization header,
// stripping the "Bearer " prefix if present
func extractTokenFromHeader(e *core.RequestEvent) string {
	token := e.Request.Header.Get("Authorization")
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}
	return strings.TrimSpace(token)
}

func RegisterChatRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, chatService *chat.ChatService, chatClient ai.ChatAIClient) {
	chatRouter := apiRouter.Group(path)

	chatRouter.GET("/models", func(e *core.RequestEvent) error {
		return ChatListModelsHandler(chatService, e)
	})

	chatRouter.POST("/conversations", func(e *core.RequestEvent) error {
		return ChatCreateConversationHandler(chatService, e)
	})

	chatRouter.GET("/conversations", func(e *core.RequestEvent) error {
		return ChatListConversationsHandler(chatService, e)
	})

	chatRouter.GET("/conversations/{id}", func(e *core.RequestEvent) error {
		return ChatGetConversationHandler(chatService, e)
	})

	chatRouter.PUT("/conversations/{id}", func(e *core.RequestEvent) error {
		return ChatUpdateConversationHandler(chatService, e)
	})

	chatRouter.DELETE("/conversations/{id}", func(e *core.RequestEvent) error {
		return ChatDeleteConversationHandler(chatService, e)
	})

	chatRouter.GET("/conversations/{id}/messages", func(e *core.RequestEvent) error {
		return ChatGetMessagesHandler(chatService, e)
	})

	chatRouter.POST("/conversations/{id}/messages", func(e *core.RequestEvent) error {
		return ChatSendMessageHandler(chatService, e)
	})

	chatRouter.POST("/stream/{id}/cancel", func(e *core.RequestEvent) error {
		return ChatCancelStreamHandler(chatService, e)
	})

	chatRouter.GET("/search", func(e *core.RequestEvent) error {
		return ChatSearchHandler(chatService, e)
	})

	logger.LogInfo("Chat routes registered", "path", path)
}

// ChatListModelsHandler lists available models from OpenRouter
func ChatListModelsHandler(chatService *chat.ChatService, e *core.RequestEvent) error {
	token := extractTokenFromHeader(e)
	userID, err := util.GetUserId(token)
	if err != nil {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	// Get user-specific chat client (uses user's API key or env fallback)
	chatClient, err := chatService.GetChatClientForUser(userID)
	if err != nil {
		return util.RespondError(e, util.NewBadRequestError("AI client not available: "+err.Error()))
	}

	ctx := context.Background()
	models, err := chatClient.ListModels(ctx)
	if err != nil {
		logger.LogError("Failed to list models", "error", err, "userId", userID)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"models": models,
	})
}

// ChatCreateConversationHandler creates a new conversation
func ChatCreateConversationHandler(chatService *chat.ChatService, e *core.RequestEvent) error {
	token := extractTokenFromHeader(e)
	userID, err := util.GetUserId(token)
	if err != nil {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	var requestData map[string]interface{}
	if err := e.BindBody(&requestData); err != nil {
		return util.RespondError(e, util.NewBadRequestError("Invalid request body"))
	}

	title, ok := requestData["title"].(string)
	if !ok || title == "" {
		title = "New Conversation"
	}

	model, ok := requestData["model"].(string)
	if !ok || model == "" {
		model = "openai/gpt-3.5-turbo"
	}

	systemPrompt, _ := requestData["system_prompt"].(string)
	settings, _ := requestData["settings"].(map[string]interface{})

	conv, err := chatService.CreateConversation(userID, title, model, systemPrompt, settings)
	if err != nil {
		logger.LogError("Failed to create conversation", "error", err, "userId", userID)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	return util.RespondSuccess(e, http.StatusOK, conv)
}

// ChatListConversationsHandler lists conversations for a user
func ChatListConversationsHandler(chatService *chat.ChatService, e *core.RequestEvent) error {
	token := extractTokenFromHeader(e)
	userID, err := util.GetUserId(token)
	if err != nil {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	filters := make(map[string]interface{})

	if archived := e.Request.URL.Query().Get("archived"); archived != "" {
		archivedBool, _ := strconv.ParseBool(archived)
		filters["archived"] = archivedBool
	}

	if favorite := e.Request.URL.Query().Get("favorite"); favorite != "" {
		favoriteBool, _ := strconv.ParseBool(favorite)
		filters["is_favorite"] = favoriteBool
	}

	if model := e.Request.URL.Query().Get("model"); model != "" {
		filters["model"] = model
	}

	page := 1
	if pageStr := e.Request.URL.Query().Get("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	perPage := 20
	if perPageStr := e.Request.URL.Query().Get("perPage"); perPageStr != "" {
		if p, err := strconv.Atoi(perPageStr); err == nil && p > 0 && p <= 100 {
			perPage = p
		}
	}

	offset := (page - 1) * perPage

	conversations, total, err := chatService.ListConversations(userID, filters, perPage, offset)
	if err != nil {
		logger.LogError("Failed to list conversations", "error", err, "userId", userID)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	totalPages := (int(total) + perPage - 1) / perPage

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"items":      conversations,
		"page":       page,
		"perPage":    perPage,
		"totalItems": total,
		"totalPages": totalPages,
	})
}

// ChatGetConversationHandler gets a conversation by ID
func ChatGetConversationHandler(chatService *chat.ChatService, e *core.RequestEvent) error {
	token := extractTokenFromHeader(e)
	userID, err := util.GetUserId(token)
	if err != nil {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	conversationID := e.Request.PathValue("id")
	if conversationID == "" {
		return util.RespondError(e, util.NewBadRequestError("Conversation ID is required"))
	}

	conv, err := chatService.GetConversation(conversationID, userID)
	if err != nil {
		if err.Error() == "conversation not found" {
			return util.RespondError(e, util.ErrNotFound)
		}
		if err.Error() == "unauthorized" {
			return util.RespondError(e, util.ErrUnauthorized)
		}
		logger.LogError("Failed to get conversation", "error", err, "conversationId", conversationID)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	return util.RespondSuccess(e, http.StatusOK, conv)
}

// ChatUpdateConversationHandler updates a conversation
func ChatUpdateConversationHandler(chatService *chat.ChatService, e *core.RequestEvent) error {
	token := extractTokenFromHeader(e)
	userID, err := util.GetUserId(token)
	if err != nil {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	conversationID := e.Request.PathValue("id")
	if conversationID == "" {
		return util.RespondError(e, util.NewBadRequestError("Conversation ID is required"))
	}

	var updates map[string]interface{}
	if err := e.BindBody(&updates); err != nil {
		return util.RespondError(e, util.NewBadRequestError("Invalid request body"))
	}

	conv, err := chatService.UpdateConversation(conversationID, userID, updates)
	if err != nil {
		if err.Error() == "conversation not found" {
			return util.RespondError(e, util.ErrNotFound)
		}
		if err.Error() == "unauthorized" {
			return util.RespondError(e, util.ErrUnauthorized)
		}
		logger.LogError("Failed to update conversation", "error", err, "conversationId", conversationID)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	return util.RespondSuccess(e, http.StatusOK, conv)
}

// ChatDeleteConversationHandler deletes a conversation
func ChatDeleteConversationHandler(chatService *chat.ChatService, e *core.RequestEvent) error {
	token := extractTokenFromHeader(e)
	userID, err := util.GetUserId(token)
	if err != nil {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	conversationID := e.Request.PathValue("id")
	if conversationID == "" {
		return util.RespondError(e, util.NewBadRequestError("Conversation ID is required"))
	}

	err = chatService.DeleteConversation(conversationID, userID)
	if err != nil {
		if err.Error() == "conversation not found" {
			return util.RespondError(e, util.ErrNotFound)
		}
		if err.Error() == "unauthorized" {
			return util.RespondError(e, util.ErrUnauthorized)
		}
		logger.LogError("Failed to delete conversation", "error", err, "conversationId", conversationID)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"message": "Conversation deleted successfully",
	})
}

// ChatGetMessagesHandler gets messages for a conversation
func ChatGetMessagesHandler(chatService *chat.ChatService, e *core.RequestEvent) error {
	token := extractTokenFromHeader(e)
	userID, err := util.GetUserId(token)
	if err != nil {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	conversationID := e.Request.PathValue("id")
	if conversationID == "" {
		return util.RespondError(e, util.NewBadRequestError("Conversation ID is required"))
	}

	page := 1
	if pageStr := e.Request.URL.Query().Get("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	perPage := 50
	if perPageStr := e.Request.URL.Query().Get("perPage"); perPageStr != "" {
		if p, err := strconv.Atoi(perPageStr); err == nil && p > 0 && p <= 100 {
			perPage = p
		}
	}

	offset := (page - 1) * perPage

	messages, total, err := chatService.GetMessages(conversationID, userID, perPage, offset)
	if err != nil {
		if err.Error() == "conversation not found" {
			return util.RespondError(e, util.ErrNotFound)
		}
		if err.Error() == "unauthorized" {
			return util.RespondError(e, util.ErrUnauthorized)
		}
		logger.LogError("Failed to get messages", "error", err, "conversationId", conversationID)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	totalPages := (int(total) + perPage - 1) / perPage

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"items":      messages,
		"page":       page,
		"perPage":    perPage,
		"totalItems": total,
		"totalPages": totalPages,
	})
}

// ChatSendMessageHandler sends a message and streams the response
func ChatSendMessageHandler(chatService *chat.ChatService, e *core.RequestEvent) error {
	token := extractTokenFromHeader(e)
	userID, err := util.GetUserId(token)
	if err != nil {
		logger.LogError("ChatSendMessageHandler: failed to extract user ID", "error", err, "tokenLength", len(token))
		return util.RespondError(e, util.ErrUnauthorized)
	}

	conversationID := e.Request.PathValue("id")
	if conversationID == "" {
		logger.LogError("ChatSendMessageHandler: conversation ID is empty")
		return util.RespondError(e, util.NewBadRequestError("Conversation ID is required"))
	}

	var requestData map[string]interface{}
	if err := e.BindBody(&requestData); err != nil {
		logger.LogError("ChatSendMessageHandler: failed to bind request body", "error", err, "conversationId", conversationID, "userId", userID, "contentType", e.Request.Header.Get("Content-Type"))
		return util.RespondError(e, util.NewBadRequestError("Invalid request body: "+err.Error()))
	}

	content, ok := requestData["content"].(string)
	if !ok {
		content = ""
	}

	var attachmentIDs []string
	if filesData, ok := requestData["attachment_ids"].([]interface{}); ok {
		for _, fileID := range filesData {
			if id, ok := fileID.(string); ok && id != "" {
				attachmentIDs = append(attachmentIDs, id)
			}
		}
	}

	if content == "" && len(attachmentIDs) == 0 {
		return util.RespondError(e, util.NewBadRequestError("Content or attachment_ids are required"))
	}

	streamID, _ := requestData["stream_id"].(string)
	if streamID == "" {
		streamID = fmt.Sprintf("stream_%d_%d", time.Now().Unix(), userID)
	}

	e.Response.Header().Set("Content-Type", "text/event-stream")
	e.Response.Header().Set("Cache-Control", "no-cache")
	e.Response.Header().Set("Connection", "keep-alive")

	ctx := context.Background()
	chunks, err := chatService.SendMessage(ctx, conversationID, userID, content, streamID, attachmentIDs)
	if err != nil {
		// Check for specific error types
		errMsg := err.Error()
		if strings.Contains(errMsg, "conversation not found") {
			return util.RespondError(e, util.ErrNotFound)
		}
		if strings.Contains(errMsg, "unauthorized") {
			return util.RespondError(e, util.ErrUnauthorized)
		}
		if strings.Contains(errMsg, "failed to create user message") {
			logger.LogError("Failed to create user message in SendMessage", "error", err, "conversationId", conversationID, "userId", userID)
			// Return error as JSON (not streaming) since we haven't started streaming yet
			return util.RespondError(e, util.NewBadRequestError("Failed to save message: "+errMsg))
		}
		logger.LogError("Failed to send message", "error", err, "conversationId", conversationID)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	flusher, ok := e.Response.(http.Flusher)
	if !ok {
		// Some ResponseWriter implementations may not advertise http.Flusher.
		// We still continue to stream; chunks will be buffered if flushing isn't supported.
		logger.LogWarning("ChatSendMessageHandler: Response does not implement http.Flusher; proceeding without flush", "conversationId", conversationID, "userId", userID)
	}

	// Explicitly send an OK before streaming chunks.
	e.Response.WriteHeader(http.StatusOK)

	for chunk := range chunks {
		chunkJSON, err := json.Marshal(chunk)
		if err != nil {
			logger.LogError("Failed to marshal chunk", "error", err)
			continue
		}

		fmt.Fprintf(e.Response, "data: %s\n\n", string(chunkJSON))

		if ok {
			flusher.Flush()
		}

		if chunk.Done {
			break
		}
	}

	return nil
}

// ChatCancelStreamHandler cancels an ongoing stream
func ChatCancelStreamHandler(chatService *chat.ChatService, e *core.RequestEvent) error {
	token := extractTokenFromHeader(e)
	userID, err := util.GetUserId(token)
	if err != nil {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	streamID := e.Request.PathValue("id")
	if streamID == "" {
		return util.RespondError(e, util.NewBadRequestError("Stream ID is required"))
	}

	ctx := context.Background()
	err = chatService.CancelStream(ctx, streamID)
	if err != nil {
		logger.LogError("Failed to cancel stream", "error", err, "streamId", streamID, "userId", userID)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"message": "Stream cancelled successfully",
	})
}

// ChatSearchHandler performs full-text search on conversations
func ChatSearchHandler(chatService *chat.ChatService, e *core.RequestEvent) error {
	token := extractTokenFromHeader(e)
	userID, err := util.GetUserId(token)
	if err != nil {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	queryStr := e.Request.URL.Query().Get("q")
	if queryStr == "" {
		return util.RespondError(e, util.NewBadRequestError("Search query is required"))
	}

	page := 1
	if pageStr := e.Request.URL.Query().Get("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	perPage := 20
	if perPageStr := e.Request.URL.Query().Get("perPage"); perPageStr != "" {
		if p, err := strconv.Atoi(perPageStr); err == nil && p > 0 && p <= 100 {
			perPage = p
		}
	}

	offset := (page - 1) * perPage

	conversations, total, err := chatService.SearchConversations(userID, queryStr, perPage, offset)
	if err != nil {
		logger.LogError("Failed to search conversations", "error", err, "userId", userID, "query", queryStr)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	totalPages := (int(total) + perPage - 1) / perPage

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"items":      conversations,
		"page":       page,
		"perPage":    perPage,
		"totalItems": total,
		"totalPages": totalPages,
		"query":      queryStr,
	})
}

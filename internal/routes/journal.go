package routes

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/journal"
	"github.com/shashank-sharma/backend/internal/util"
)

func RegisterJournalRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, journalService *journal.JournalService) {
	journalRouter := apiRouter.Group(path)

	// Note: CRUD endpoints (GET/POST/PUT/DELETE /entries) are not registered because
	// the frontend uses PocketBase SDK directly (pb.collection('stream_entries').create/update/delete).
	// Only AI-related endpoints are needed.

	// Generate AI reflection
	journalRouter.POST("/entries/{id}/ai-reflect", func(e *core.RequestEvent) error {
		return JournalAIReflectionHandler(journalService, e)
	})

	// Ask AI query
	journalRouter.POST("/entries/{id}/ai-query", func(e *core.RequestEvent) error {
		return JournalAIQueryHandler(journalService, e)
	})

	logger.LogInfo("Journal routes registered", "path", path)
}

// JournalAIReflectionHandler generates an AI reflection for an entry
func JournalAIReflectionHandler(js *journal.JournalService, e *core.RequestEvent) error {
	logger.LogInfo("JournalAIReflectionHandler called", "path", e.Request.URL.Path, "method", e.Request.Method)

	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		logger.LogError("JournalAIReflectionHandler: unauthorized - no userId")
		return util.RespondError(e, util.ErrUnauthorized)
	}

	entryId := e.Request.PathValue("id")
	logger.LogInfo("JournalAIReflectionHandler: extracted entry ID", "entryId", entryId, "userId", userId)
	if entryId == "" {
		logger.LogError("JournalAIReflectionHandler: entry ID is empty")
		return util.RespondError(e, util.NewBadRequestError("Entry ID is required"))
	}

	reflection, context, err := js.GenerateAIReflection(entryId, userId)
	if err != nil {
		logger.LogError("JournalAIReflectionHandler: failed to generate reflection", "error", err, "entryId", entryId, "userId", userId)
		if err.Error() == "entry not found" {
			return util.RespondError(e, util.ErrNotFound)
		}
		if err.Error() == "unauthorized" {
			return util.RespondError(e, util.ErrUnauthorized)
		}
		if err.Error() == "AI service not available" {
			return util.RespondError(e, util.NewBadRequestError("AI service is not configured"))
		}
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	logger.LogInfo("JournalAIReflectionHandler: reflection generated successfully", "entryId", entryId)
	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"reflection": reflection,
		"context":    context,
	})
}

// JournalAIQueryHandler generates an AI response to a user query about an entry
func JournalAIQueryHandler(js *journal.JournalService, e *core.RequestEvent) error {
	logger.LogInfo("JournalAIQueryHandler called", "path", e.Request.URL.Path, "method", e.Request.Method)

	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		logger.LogError("JournalAIQueryHandler: unauthorized - no userId")
		return util.RespondError(e, util.ErrUnauthorized)
	}

	entryId := e.Request.PathValue("id")
	logger.LogInfo("JournalAIQueryHandler: extracted entry ID", "entryId", entryId, "userId", userId)
	if entryId == "" {
		logger.LogError("JournalAIQueryHandler: entry ID is empty")
		return util.RespondError(e, util.NewBadRequestError("Entry ID is required"))
	}

	var requestData map[string]interface{}
	if err := e.BindBody(&requestData); err != nil {
		logger.LogError("JournalAIQueryHandler: failed to parse request body", "error", err)
		return util.RespondError(e, util.NewBadRequestError("Invalid request body"))
	}

	userQuery, ok := requestData["query"].(string)
	if !ok || userQuery == "" {
		logger.LogError("JournalAIQueryHandler: query is missing or empty")
		return util.RespondError(e, util.NewBadRequestError("Query is required"))
	}

	// Get thread entries if provided
	var threadEntries []*models.StreamEntry
	if threadIds, ok := requestData["thread_ids"].([]interface{}); ok && len(threadIds) > 0 {
		// Fetch thread entries
		for _, id := range threadIds {
			if idStr, ok := id.(string); ok {
				entry, err := query.FindById[*models.StreamEntry](idStr)
				if err == nil && entry.User == userId {
					threadEntries = append(threadEntries, entry)
				}
			}
		}
	}

	response, context, err := js.GenerateAIQuery(entryId, userId, userQuery, threadEntries)
	if err != nil {
		logger.LogError("JournalAIQueryHandler: failed to generate query response", "error", err, "entryId", entryId, "userId", userId)
		if err.Error() == "entry not found" {
			return util.RespondError(e, util.ErrNotFound)
		}
		if err.Error() == "unauthorized" {
			return util.RespondError(e, util.ErrUnauthorized)
		}
		if err.Error() == "AI service not available" {
			return util.RespondError(e, util.NewBadRequestError("AI service is not configured"))
		}
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	logger.LogInfo("JournalAIQueryHandler: query response generated successfully", "entryId", entryId)
	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"response": response,
		"context":  context,
	})
}

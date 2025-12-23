package journal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/ai"
)

// JournalService handles journal entry operations
type JournalService struct {
	aiClient ai.AIClient
}

// NewJournalService creates a new journal service
func NewJournalService(aiClient ai.AIClient) *JournalService {
	return &JournalService{
		aiClient: aiClient,
	}
}

// Note: CRUD operations (GetEntries, CreateEntry, UpdateEntry, DeleteEntry) are not used.
// The frontend uses PocketBase SDK directly (pb.collection('stream_entries').create/update/delete).
// Only AI-related methods (GenerateAIReflection, GenerateAIQuery) are used via custom API endpoints.

// GenerateAIReflection generates an AI reflection for an entry
func (s *JournalService) GenerateAIReflection(entryId string, userId string) (string, map[string]interface{}, error) {
	if s.aiClient == nil {
		return "", nil, errors.New("AI service not available")
	}

	entry, err := query.FindById[*models.StreamEntry](entryId)
	if err != nil {
		return "", nil, fmt.Errorf("entry not found: %w", err)
	}

	// Verify ownership
	if entry.User != userId {
		return "", nil, errors.New("unauthorized")
	}

	content := entry.Content
	title := entry.Title

	// Create prompt for AI reflection
	prompt := fmt.Sprintf(
		"Reflect on the following journal entry and provide thoughtful insights or questions to deepen the writer's understanding:\n\n%s\n\n%s",
		title,
		content,
	)

	ctx := context.Background()
	summary, err := s.aiClient.Summarize(ctx, &ai.SummarizeRequest{
		Text:      prompt,
		MaxLength: 500,
	})

	if err != nil {
		logger.LogError("Failed to generate AI reflection", "error", err)
		return "", nil, fmt.Errorf("failed to generate reflection: %w", err)
	}

	aiContext := map[string]interface{}{
		"generated_at": time.Now().Format(time.RFC3339),
		"model":        "ai_reflection",
		"entry_id":     entryId,
	}

	return summary.Summary, aiContext, nil
}

// GenerateAIQuery generates an AI response to a user query about an entry
func (s *JournalService) GenerateAIQuery(entryId string, userId string, userQuery string, threadEntries []*models.StreamEntry) (string, map[string]interface{}, error) {
	if s.aiClient == nil {
		return "", nil, errors.New("AI service not available")
	}

	entry, err := query.FindById[*models.StreamEntry](entryId)
	if err != nil {
		return "", nil, fmt.Errorf("entry not found: %w", err)
	}

	// Verify ownership
	if entry.User != userId {
		return "", nil, errors.New("unauthorized")
	}

	// Build context from thread entries
	threadContext := ""
	if len(threadEntries) > 0 {
		threadContext = "\n\nThread context:\n"
		for i, threadEntry := range threadEntries {
			if threadEntry.Id == entryId {
				threadContext += fmt.Sprintf("[Current Entry %d]\n", i+1)
			} else {
				threadContext += fmt.Sprintf("[Entry %d]\n", i+1)
			}
			if threadEntry.Title != "" {
				threadContext += fmt.Sprintf("Title: %s\n", threadEntry.Title)
			}
			threadContext += fmt.Sprintf("Content: %s\n\n", threadEntry.Content)
		}
	}

	// Create prompt for AI query
	prompt := fmt.Sprintf(
		"Journal Entry:\nTitle: %s\nContent: %s%s\n\nUser Question: %s\n\nPlease provide a thoughtful and helpful response to the user's question based on the journal entry and thread context above.",
		entry.Title,
		entry.Content,
		threadContext,
		userQuery,
	)

	ctx := context.Background()
	summary, err := s.aiClient.Summarize(ctx, &ai.SummarizeRequest{
		Text:      prompt,
		MaxLength: 1000,
	})

	if err != nil {
		logger.LogError("Failed to generate AI query response", "error", err)
		return "", nil, fmt.Errorf("failed to generate query response: %w", err)
	}

	aiContext := map[string]interface{}{
		"generated_at": time.Now().Format(time.RFC3339),
		"model":        "ai_query",
		"entry_id":     entryId,
		"user_query":   userQuery,
		"thread_count": len(threadEntries),
	}

	return summary.Summary, aiContext, nil
}

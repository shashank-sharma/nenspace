package routes

import (
	"fmt"
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/util"
)

type BrowserHistoryBatchRequest struct {
	BrowserProfileID string                   `json:"browser_profile_id"`
	Checkpoint       string                   `json:"checkpoint"`
	HistoryItems     []BrowserHistorySyncItem `json:"history_items"`
}

type BrowserHistorySyncItem struct {
	URL            string  `json:"url"`
	Title          string  `json:"title"`
	Domain         string  `json:"domain"`
	VisitTime      string  `json:"visit_time"`
	VisitCount     int     `json:"visit_count"`
	TransitionType string  `json:"transition_type"`
	ReferrerURL    *string `json:"referrer_url"`
}

type BrowserHistoryBatchResponse struct {
	Success              bool         `json:"success"`
	Processed            int          `json:"processed"`
	Created              int          `json:"created"`
	Duplicates           int          `json:"duplicates"`
	Failed               int          `json:"failed"`
	FailedItems          []FailedItem `json:"failed_items,omitempty"`
	Checkpoint           string       `json:"checkpoint"`
	NextBatchRecommended bool         `json:"next_batch_recommended"`
}

func SyncBrowserHistoryBatch(e *core.RequestEvent) error {
	// 1. Get user ID from middleware context (DevTokenAuthMiddleware already validated)
	userID, ok := e.Get("devTokenUserId").(string)
	if !ok || userID == "" {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"success": false,
			"error":   "User ID not found in context",
		})
	}

	// 2. Parse and validate request
	var req BrowserHistoryBatchRequest
	if err := e.BindBody(&req); err != nil {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Invalid request body",
		})
	}

	// 3. Validate batch size (max 500)
	if len(req.HistoryItems) > util.MaxBatchSize {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Batch size exceeds limit",
			"code":    "BAD_REQUEST",
			"message": fmt.Sprintf("Batch size exceeds limit of %d items", util.MaxBatchSize),
		})
	}

	// 4. Verify browser profile belongs to user
	profile, err := e.App.FindRecordById("browser_profiles", req.BrowserProfileID)
	if err != nil || profile.GetString("user") != userID {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"success": false,
			"error":   "Invalid browser profile",
		})
	}

	// 5. Process batch
	response := BrowserHistoryBatchResponse{
		FailedItems: []FailedItem{},
	}

	collection, err := e.App.FindCollectionByNameOrId("browser_history")
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Collection not found",
		})
	}

	for idx, historyItem := range req.HistoryItems {
		// Check for duplicate (idempotency)
		isDupe, err := isDuplicateHistory(e.App, userID, req.BrowserProfileID,
			historyItem.URL, historyItem.VisitTime)
		if err != nil {
			response.Failed++
			response.FailedItems = append(response.FailedItems, FailedItem{
				Index: idx,
				URL:   historyItem.URL,
				Error: "Duplicate check failed",
			})
			continue
		}

		if isDupe {
			response.Duplicates++
			response.Processed++
			continue
		}

		// Create record
		record := core.NewRecord(collection)
		record.Set("user", userID)
		record.Set("browser_profile", req.BrowserProfileID)
		record.Set("url", historyItem.URL)
		record.Set("title", historyItem.Title)
		record.Set("domain", historyItem.Domain)
		record.Set("visit_time", historyItem.VisitTime)
		record.Set("visit_count", historyItem.VisitCount)
		record.Set("transition_type", historyItem.TransitionType)
		if historyItem.ReferrerURL != nil {
			record.Set("referrer_url", *historyItem.ReferrerURL)
		}
		record.Set("sync_source", "browser_history")

		if err := e.App.Save(record); err != nil {
			response.Failed++
			response.FailedItems = append(response.FailedItems, FailedItem{
				Index: idx,
				URL:   historyItem.URL,
				Error: err.Error(),
			})
		} else {
			response.Created++
		}

		response.Processed++
	}

	// 6. Determine success and checkpoint
	response.Success = response.Failed == 0
	response.Checkpoint = req.Checkpoint
	if len(req.HistoryItems) > 0 {
		lastItem := req.HistoryItems[len(req.HistoryItems)-1]
		response.Checkpoint = lastItem.VisitTime
	}
	response.NextBatchRecommended = len(req.HistoryItems) == util.MaxBatchSize

	logger.LogInfo("Browser history batch sync: processed=%d, created=%d, duplicates=%d, failed=%d",
		response.Processed, response.Created, response.Duplicates, response.Failed)

	return e.JSON(http.StatusOK, response)
}

func isDuplicateHistory(app core.App, userID, profileID, url, visitTime string) (bool, error) {
	// Check for exact URL + visit_time match (stricter than activity)
	records, err := app.FindRecordsByFilter(
		"browser_history",
		"user = {:user} && browser_profile = {:profile} && url = {:url} && visit_time = {:visit_time}",
		"-created",
		1,
		0,
		dbx.Params{
			"user":       userID,
			"profile":    profileID,
			"url":        url,
			"visit_time": visitTime,
		},
	)

	return len(records) > 0, err
}

// Register browser history sync routes
func RegisterBrowserHistorySyncRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string) {
	syncRouter := apiRouter.Group(path)
	syncRouter.POST("/browser-history/batch", SyncBrowserHistoryBatch)
}

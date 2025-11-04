package routes

import (
	"fmt"
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/util"
)

type BrowsingActivityBatchRequest struct {
	BrowserProfileID string                     `json:"browser_profile_id"`
	Checkpoint       string                     `json:"checkpoint"`
	Activities       []BrowsingActivitySyncItem `json:"activities"`
}

type BrowsingActivitySyncItem struct {
	URL       string                 `json:"url"`
	Title     string                 `json:"title"`
	Domain    string                 `json:"domain"`
	StartTime string                 `json:"start_time"`
	EndTime   *string                `json:"end_time"`
	Duration  *int                   `json:"duration"`
	TabID     *int                   `json:"tab_id"`
	WindowID  *int                   `json:"window_id"`
	Audible   bool                   `json:"audible"`
	Incognito bool                   `json:"incognito"`
	Metadata  map[string]interface{} `json:"metadata"`
	SessionID string                 `json:"session_id"`
	ClientID  *string                `json:"client_id,omitempty"` // Client-side temporary ID for tracking
}

type BrowsingActivityBatchResponse struct {
	Success              bool         `json:"success"`
	Processed            int          `json:"processed"`
	Created              int          `json:"created"`
	Updated              int          `json:"updated"`
	Duplicates           int          `json:"duplicates"`
	Failed               int          `json:"failed"`
	FailedItems          []FailedItem `json:"failed_items,omitempty"`
	Checkpoint           string       `json:"checkpoint"`
	NextBatchRecommended bool         `json:"next_batch_recommended"`
}

type FailedItem struct {
	Index int    `json:"index"`
	URL   string `json:"url"`
	Error string `json:"error"`
}

func SyncBrowsingActivityBatch(e *core.RequestEvent) error {
	// 1. Get user ID from middleware context (DevTokenAuthMiddleware already validated)
	userID, ok := e.Get("devTokenUserId").(string)
	if !ok || userID == "" {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "User ID not found in context"})
	}

	// 2. Parse and validate request
	var req BrowsingActivityBatchRequest
	if err := e.BindBody(&req); err != nil {
		logger.LogError("Error in parsing request body", "error", err)
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"error":   "Invalid request body",
			"code":    "BAD_REQUEST",
			"message": "Failed to parse request data",
		})
	}

	// 3. Validate batch size (max 500)
	if len(req.Activities) > util.MaxBatchSize {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Batch size exceeds limit",
			"code":    "BAD_REQUEST",
			"message": fmt.Sprintf("Batch size exceeds limit of %d items", util.MaxBatchSize),
		})
	}

	// 4. Verify browser profile belongs to user
	profile, err := query.FindById[*models.BrowserProfile](req.BrowserProfileID)
	if err != nil || profile.User != userID {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"success": false,
			"error":   "Invalid browser profile",
		})
	}

	// 5. Process batch
	response := BrowsingActivityBatchResponse{
		FailedItems: []FailedItem{},
	}

	// Collection validation not needed when using query utilities

	for idx, activity := range req.Activities {
		// Convert string to types.DateTime for StartTime
		startTimeDT := types.DateTime{}
		startTimeDT.Scan(activity.StartTime)

		// Prepare upsert filter
		// Strategy: Match by start_time + url + session_id to identify the same activity
		// For ongoing activities (same page), start_time remains constant and only end_time/duration update
		// This ensures the same activity record gets updated rather than creating duplicates
		upsertFilter := map[string]interface{}{
			"user":            userID,
			"browser_profile": req.BrowserProfileID,
			"session_id":      activity.SessionID,
			"url":             activity.URL,
			"start_time":      startTimeDT, // Primary key for matching - stays constant for same activity
		}

		// Optional: Also match by tab_id if available (adds extra uniqueness check)
		// This helps prevent edge cases where the same start_time might occur
		if activity.TabID != nil {
			upsertFilter["tab_id"] = *activity.TabID
		}

		// Create/update browsing activity record
		browsingActivity := &models.BrowsingActivity{
			User:           userID,
			BrowserProfile: req.BrowserProfileID,
			SessionID:      activity.SessionID,
			URL:            activity.URL,
			Title:          activity.Title,
			Domain:         activity.Domain,
			StartTime:      startTimeDT,
			Audible:        activity.Audible,
			Incognito:      activity.Incognito,
		}

		// Set metadata using helper method (converts map to JSONRaw)
		if err := browsingActivity.SetMetadataMap(activity.Metadata); err != nil {
			response.Failed++
			response.FailedItems = append(response.FailedItems, FailedItem{
				Index: idx,
				URL:   activity.URL,
				Error: "Failed to serialize metadata: " + err.Error(),
			})
			response.Processed++
			continue
		}

		// Set optional fields
		if activity.EndTime != nil {
			endTimeDT := types.DateTime{}
			endTimeDT.Scan(*activity.EndTime)
			browsingActivity.EndTime = &endTimeDT
		}
		if activity.Duration != nil {
			browsingActivity.Duration = activity.Duration
		}
		if activity.TabID != nil {
			browsingActivity.TabID = activity.TabID
		}
		if activity.WindowID != nil {
			browsingActivity.WindowID = activity.WindowID
		}

		// Check if record already exists (to determine if this is create or update)
		_, findErr := query.FindByFilter[*models.BrowsingActivity](upsertFilter)

		// Use upsert to create or update the record
		// end_time and duration will be updated each sync, allowing continuous tracking
		err := query.UpsertRecord[*models.BrowsingActivity](browsingActivity, upsertFilter)
		if err != nil {
			response.Failed++
			response.FailedItems = append(response.FailedItems, FailedItem{
				Index: idx,
				URL:   activity.URL,
				Error: err.Error(),
			})
		} else {
			// Determine if this was a create or update
			if findErr == nil {
				response.Updated++
			} else {
				response.Created++
			}
		}

		response.Processed++
	}

	// 6. Determine success and checkpoint
	response.Success = response.Failed == 0
	response.Checkpoint = req.Checkpoint
	if len(req.Activities) > 0 {
		lastActivity := req.Activities[len(req.Activities)-1]
		if lastActivity.EndTime != nil {
			response.Checkpoint = *lastActivity.EndTime
		} else {
			response.Checkpoint = lastActivity.StartTime
		}
	}
	response.NextBatchRecommended = len(req.Activities) == util.MaxBatchSize

	logger.LogInfo("Browsing activity batch sync: processed=%d, created=%d, updated=%d, duplicates=%d, failed=%d",
		response.Processed, response.Created, response.Updated, response.Duplicates, response.Failed)

	return e.JSON(http.StatusOK, response)
}

// Register browsing activity sync routes
func RegisterBrowsingActivitySyncRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string) {
	syncRouter := apiRouter.Group(path)
	syncRouter.POST("/browsing-activity/batch", SyncBrowsingActivityBatch)
}

package routes

import (
	"net/http"
	"strconv"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/credentials"
	"github.com/shashank-sharma/backend/internal/util"
)

// RegisterCredentialUsageRoutes registers API endpoints for credential usage tracking
func RegisterCredentialUsageRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string) {
	usageRouter := apiRouter.Group(path)

	usageRouter.GET("/:type/:id", GetCredentialUsage)
	usageRouter.GET("/:type/:id/stats", GetCredentialUsageStats)
	usageRouter.GET("/:type/:id/timeline", GetCredentialUsageTimeline)
	usageRouter.GET("/stats", GetAllCredentialStats)

	logger.LogInfo("Credential usage routes registered")
}

// GetCredentialUsage returns usage logs for a specific credential
func GetCredentialUsage(e *core.RequestEvent) error {
	userID, ok := util.GetUserIDFromRequest(e)
	if !ok {
		if devTokenUserID, ok := e.Get("devTokenUserId").(string); ok {
			userID = devTokenUserID
		} else {
			return util.RespondError(e, util.ErrUnauthorized)
		}
	}

	credentialType := e.Request.PathValue("type")
	credentialID := e.Request.PathValue("id")

	if credentialType == "" || credentialID == "" {
		return util.RespondError(e, util.NewBadRequestError("Missing credential type or ID"))
	}

	page, _ := strconv.Atoi(e.Request.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	perPage, _ := strconv.Atoi(e.Request.URL.Query().Get("perPage"))
	if perPage < 1 {
		perPage = 50
	}
	if perPage > 100 {
		perPage = 100
	}

	collection, err := e.App.FindCollectionByNameOrId("credential_usage")
	if err != nil {
		return e.JSON(http.StatusOK, map[string]interface{}{
			"items":      []interface{}{},
			"page":       page,
			"perPage":    perPage,
			"totalItems": 0,
			"totalPages": 0,
		})
	}
	if collection == nil {
		return e.JSON(http.StatusOK, map[string]interface{}{
			"items":      []interface{}{},
			"page":       page,
			"perPage":    perPage,
			"totalItems": 0,
			"totalPages": 0,
		})
	}

	filter := "credential_type = '" + credentialType + "' && credential_id = '" + credentialID + "' && user = '" + userID + "'"

	records, err := e.App.FindRecordsByFilter(collection.Id, filter, "-timestamp", perPage, (page-1)*perPage)
	if err != nil {
		logger.LogError("Error fetching credential usage: %v", err)
		return util.RespondError(e, util.ErrInternalServer)
	}

	totalCount, _ := e.App.FindRecordsByFilter(collection.Id, filter, "", 0, 0)

	items := make([]map[string]interface{}, len(records))
	for i, record := range records {
		items[i] = map[string]interface{}{
			"id":                  record.Id,
			"credential_type":     record.GetString("credential_type"),
			"credential_id":       record.GetString("credential_id"),
			"service":             record.GetString("service"),
			"endpoint":            record.GetString("endpoint"),
			"method":              record.GetString("method"),
			"status_code":         record.GetInt("status_code"),
			"response_time_ms":    record.GetInt("response_time_ms"),
			"tokens_used":         record.GetInt("tokens_used"),
			"request_size_bytes":  record.GetInt("request_size_bytes"),
			"response_size_bytes": record.GetInt("response_size_bytes"),
			"error_type":          record.GetString("error_type"),
			"error_message":       record.GetString("error_message"),
			"timestamp":           record.GetDateTime("timestamp"),
			"metadata":            record.Get("metadata"),
		}
	}

	totalItems := len(totalCount)
	totalPages := (totalItems + perPage - 1) / perPage

	return e.JSON(http.StatusOK, map[string]interface{}{
		"items":      items,
		"page":       page,
		"perPage":    perPage,
		"totalItems": totalItems,
		"totalPages": totalPages,
	})
}

func GetCredentialUsageStats(e *core.RequestEvent) error {
	userID, ok := util.GetUserIDFromRequest(e)
	if !ok {
		if devTokenUserID, ok := e.Get("devTokenUserId").(string); ok {
			userID = devTokenUserID
		} else {
			return util.RespondError(e, util.ErrUnauthorized)
		}
	}

	credentialType := e.Request.PathValue("type")
	credentialID := e.Request.PathValue("id")

	if credentialType == "" || credentialID == "" {
		return util.RespondError(e, util.NewBadRequestError("Missing credential type or ID"))
	}

	if !verifyCredentialOwnership(e, credentialType, credentialID, userID) {
		return util.RespondError(e, util.ErrForbidden)
	}

	statsService := credentials.NewStatsService()
	stats, err := statsService.AggregateStats(e.Request.Context(), credentialType, credentialID)
	if err != nil {
		logger.LogError("Error aggregating credential stats: %v", err)
		return util.RespondError(e, util.ErrInternalServer)
	}

	return e.JSON(http.StatusOK, stats)
}

func GetCredentialUsageTimeline(e *core.RequestEvent) error {
	userID, ok := util.GetUserIDFromRequest(e)
	if !ok {
		if devTokenUserID, ok := e.Get("devTokenUserId").(string); ok {
			userID = devTokenUserID
		} else {
			return util.RespondError(e, util.ErrUnauthorized)
		}
	}

	credentialType := e.Request.PathValue("type")
	credentialID := e.Request.PathValue("id")

	if credentialType == "" || credentialID == "" {
		return util.RespondError(e, util.NewBadRequestError("Missing credential type or ID"))
	}

	startDate := e.Request.URL.Query().Get("startDate")
	endDate := e.Request.URL.Query().Get("endDate")

	if startDate == "" {
		startDate = time.Now().AddDate(0, 0, -30).Format(time.RFC3339)
	}
	if endDate == "" {
		endDate = time.Now().Format(time.RFC3339)
	}

	collection, err := e.App.FindCollectionByNameOrId("credential_usage")
	if err != nil {
		return e.JSON(http.StatusOK, map[string]interface{}{
			"timeline": []interface{}{},
		})
	}

	filter := "credential_type = '" + credentialType + "' && credential_id = '" + credentialID + "' && user = '" + userID + "'"
	if startDate != "" {
		filter += " && timestamp >= '" + startDate + "'"
	}
	if endDate != "" {
		filter += " && timestamp <= '" + endDate + "'"
	}

	records, err := e.App.FindRecordsByFilter(collection.Id, filter, "timestamp", 10000, 0)
	if err != nil {
		logger.LogError("Error fetching credential usage timeline: %v", err)
		return util.RespondError(e, util.ErrInternalServer)
	}

	timelineMap := make(map[string]map[string]interface{})

	for _, record := range records {
		timestamp := record.GetDateTime("timestamp")
		if timestamp.IsZero() {
			continue
		}

		dateKey := timestamp.Time().Format("2006-01-02")

		dayStats, exists := timelineMap[dateKey]
		if !exists {
			dayStats = map[string]interface{}{
				"date":              dateKey,
				"total_requests":    0,
				"success_count":     0,
				"failure_count":     0,
				"total_tokens":      0,
				"avg_response_time": 0.0,
			}
			timelineMap[dateKey] = dayStats
		}

		dayStats["total_requests"] = dayStats["total_requests"].(int) + 1

		statusCode := record.GetInt("status_code")
		if statusCode >= 200 && statusCode < 400 {
			dayStats["success_count"] = dayStats["success_count"].(int) + 1
		} else {
			dayStats["failure_count"] = dayStats["failure_count"].(int) + 1
		}

		dayStats["total_tokens"] = dayStats["total_tokens"].(int) + record.GetInt("tokens_used")
	}

	timeline := make([]map[string]interface{}, 0, len(timelineMap))
	for _, dayStats := range timelineMap {
		timeline = append(timeline, dayStats)
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"timeline": timeline,
	})
}

func GetAllCredentialStats(e *core.RequestEvent) error {
	userID, ok := util.GetUserIDFromRequest(e)
	if !ok {
		if devTokenUserID, ok := e.Get("devTokenUserId").(string); ok {
			userID = devTokenUserID
		} else {
			return util.RespondError(e, util.ErrUnauthorized)
		}
	}

	statsService := credentials.NewStatsService()
	statsMap, err := statsService.AggregateAllUserStats(e.Request.Context(), userID)
	if err != nil {
		logger.LogError("Error aggregating all credential stats: %v", err)
		return util.RespondError(e, util.ErrInternalServer)
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"stats": statsMap,
	})
}

func verifyCredentialOwnership(e *core.RequestEvent, credentialType, credentialID, userID string) bool {
	collectionName := credentials.GetCollectionName(credentialType)
	if collectionName == "" {
		return false
	}

	record, err := e.App.FindRecordById(collectionName, credentialID)
	if err != nil {
		return false
	}

	recordUserID := record.GetString("user")
	return recordUserID == userID
}

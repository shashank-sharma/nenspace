package routes

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/services/logging"
)

type LoggingRoutes struct {
	service *logging.LoggingService
}

func RegisterLoggingRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, service *logging.LoggingService) {
	r := &LoggingRoutes{service: service}

	var group *router.RouterGroup[*core.RequestEvent]
	if path != "" {
		group = apiRouter.Group(path)
	} else {
		group = apiRouter
	}

	group.POST("/ingest", r.Ingest)
}

type IngestRequest struct {
	logging.LogEntry
	Logs []logging.LogEntry `json:"logs"`
}

func (r *LoggingRoutes) Ingest(e *core.RequestEvent) error {
	projectId, ok := e.Get("loggingProjectId").(string)
	if !ok || projectId == "" {
		return e.JSON(http.StatusForbidden, map[string]interface{}{"message": "Project ID not found in context"})
	}

	var req IngestRequest
	if err := e.BindBody(&req); err != nil {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{"error": "Invalid request body"})
	}

	var entries []logging.LogEntry
	if len(req.Logs) > 0 {
		entries = req.Logs
	} else if req.Message != "" {
		entries = []logging.LogEntry{req.LogEntry}
	} else {
		return e.JSON(http.StatusUnprocessableEntity, map[string]interface{}{"error": "No logs provided"})
	}

	result, err := r.service.IngestLogs(e.Request.Context(), projectId, entries)
	if err != nil {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
	}

	status := http.StatusOK
	if result.Failed > 0 {
		status = http.StatusMultiStatus
	}

	return e.JSON(status, result)
}

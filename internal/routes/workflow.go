package routes

import (
	"encoding/json"
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/workflow"
	"github.com/shashank-sharma/backend/internal/services/workflow/connectors"
	"github.com/shashank-sharma/backend/internal/util"
)

// RegisterWorkflowRoutes registers the workflow-related API endpoints
func RegisterWorkflowRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, engine *workflow.WorkflowEngine) {
	workflowRouter := apiRouter.Group(path)
	// Create a new registry
	connRegistry := workflow.NewConnectorRegistryImpl()

	// Register connectors directly
	connectors.RegisterAllConnectors(connRegistry)
	workflow.RegisterLocalConnectors(connRegistry)

	// Get available connectors
	workflowRouter.GET("/connectors", func(e *core.RequestEvent) error {
		// Get connector IDs
		connectorIDs := connRegistry.GetAvailableConnectors()

		// Convert to richer metadata format
		results := make([]map[string]interface{}, 0, len(connectorIDs))

		for _, id := range connectorIDs {
			connector := connRegistry.Get(id)
			if connector != nil {
				results = append(results, map[string]interface{}{
					"id":           connector.ID(),
					"name":         connector.Name(),
					"type":         connector.Type(),
					"configSchema": connector.GetConfigSchema(),
				})
			}
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"connectors": results,
		})
	})

	workflowRouter.POST("/{id}/execute", func(e *core.RequestEvent) error {
		workflowId := e.Request.PathValue("id")
		if workflowId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing workflow ID"))
		}

		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		// Use typed filter for workflow query
		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   workflowId,
				User: userId,
			},
		}
		workflow, err := query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		ctx := util.WithUserID(e.Request.Context(), userId)

		// Execute the workflow with user context
		execution, err := engine.ExecuteWorkflow(ctx, workflow.Id)
		if err != nil {
			logger.LogError("Failed to execute workflow", "error", err, "workflowId", workflow.Id, "userId", userId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to execute workflow"), err)
		}

		return util.RespondSuccess(e, http.StatusAccepted, execution)
	})

	// Get execution status
	workflowRouter.GET("/executions/{id}", func(e *core.RequestEvent) error {
		executionId := e.Request.PathValue("id")
		if executionId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing execution ID"))
		}

		// Get user ID from token
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		// Get the execution record to check access using typed filter
		executionFilter := &query.WorkflowExecutionFilter{
			BaseFilter: query.BaseFilter{
				ID: executionId,
			},
		}
		execution, err := query.FindByFilter[*models.WorkflowExecution](executionFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		// Get the associated workflow to check access using typed filter
		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   execution.WorkflowID,
				User: userId,
			},
		}
		_, err = query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrForbidden)
		}

		// Get the execution status
		status, err := engine.GetExecutionStatus(executionId)
		if err != nil {
			logger.LogError("Failed to get execution status", "error", err, "executionId", executionId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to get execution status"), err)
		}

		return util.RespondSuccess(e, http.StatusOK, status)
	})

	// Register webhook triggers for workflows
	workflowRouter.POST("/{id}/webhook", func(e *core.RequestEvent) error {
		workflowId := e.Request.PathValue("id")
		if workflowId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing workflow ID"))
		}

		// Get user ID from token (workflow routes don't use AuthMiddleware)
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		// Load the workflow to check if it exists and user has access using typed filter
		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   workflowId,
				User: userId,
			},
		}
		workflow, err := query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		// Parse the webhook payload
		var payload map[string]interface{}
		decoder := json.NewDecoder(e.Request.Body)
		if err := decoder.Decode(&payload); err != nil {
			return util.RespondError(e, util.NewBadRequestError("Invalid payload format"))
		}

		// Create context with user ID
		ctx := util.WithUserID(e.Request.Context(), userId)

		// Execute the workflow with the webhook payload and user context
		execution, err := engine.ExecuteWorkflow(ctx, workflow.Id)
		if err != nil {
			logger.LogError("Failed to execute workflow", "error", err, "workflowId", workflow.Id, "userId", userId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to execute workflow"), err)
		}

		return util.RespondSuccess(e, http.StatusAccepted, execution)
	})
}

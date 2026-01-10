package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/workflow"
	"github.com/shashank-sharma/backend/internal/services/workflow/types"
	"github.com/shashank-sharma/backend/internal/util"
)

func RegisterWorkflowRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, engine *workflow.WorkflowEngine) {
	workflowRouter := apiRouter.Group(path)

	workflowRouter.GET("/connectors", func(e *core.RequestEvent) error {
		registry := engine.GetRegistry()
		connectorIDs := registry.GetAvailableConnectors()

		results := make([]map[string]interface{}, 0, len(connectorIDs))

		for _, id := range connectorIDs {
			connector := registry.Get(id)
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

	workflowRouter.GET("/workflow/{id}/executions", func(e *core.RequestEvent) error {
		workflowId := e.Request.PathValue("id")
		if workflowId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing workflow ID"))
		}

		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   workflowId,
				User: userId,
			},
		}
		_, err = query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		limit := 10
		if limitStr := e.Request.URL.Query().Get("limit"); limitStr != "" {
			if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
				limit = parsedLimit
			}
		}

		var executions []*models.WorkflowExecution
		queryBuilder := query.BaseQuery[*models.WorkflowExecution]()
		queryBuilder = queryBuilder.AndWhere(dbx.HashExp{"workflow_id": workflowId})
		queryBuilder = queryBuilder.OrderBy("start_time DESC")
		queryBuilder = queryBuilder.Limit(int64(limit))
		err = queryBuilder.All(&executions)
		if err != nil {
			logger.LogError("Failed to load workflow executions", "error", err, "workflowId", workflowId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to load workflow executions"), err)
		}

		return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
			"executions": executions,
		})
	})

	workflowRouter.GET("/executions/{id}", func(e *core.RequestEvent) error {
		executionId := e.Request.PathValue("id")
		if executionId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing execution ID"))
		}

		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		executionFilter := &query.WorkflowExecutionFilter{
			BaseFilter: query.BaseFilter{
				ID: executionId,
			},
		}
		execution, err := query.FindByFilter[*models.WorkflowExecution](executionFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

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

		status, err := engine.GetExecutionStatus(executionId)
		if err != nil {
			logger.LogError("Failed to get execution status", "error", err, "executionId", executionId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to get execution status"), err)
		}

		return util.RespondSuccess(e, http.StatusOK, status)
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

		// Create a background context that won't be cancelled when the HTTP request completes
		// The workflow execution runs in a goroutine and needs a context that persists
		ctx := context.Background()
		ctx = util.WithUserID(ctx, userId)

		// Execute the workflow with user context
		execution, err := engine.ExecuteWorkflow(ctx, workflow.Id)
		if err != nil {
			logger.LogError("Failed to execute workflow", "error", err, "workflowId", workflow.Id, "userId", userId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to execute workflow"), err)
		}

		return util.RespondSuccess(e, http.StatusAccepted, execution)
	})

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

		// Create a background context that won't be cancelled when the HTTP request completes
		// The workflow execution runs in a goroutine and needs a context that persists
		ctx := context.Background()
		ctx = util.WithUserID(ctx, userId)

		// Execute the workflow with the webhook payload and user context
		execution, err := engine.ExecuteWorkflow(ctx, workflow.Id)
		if err != nil {
			logger.LogError("Failed to execute workflow", "error", err, "workflowId", workflow.Id, "userId", userId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to execute workflow"), err)
		}

		return util.RespondSuccess(e, http.StatusAccepted, execution)
	})

	workflowRouter.POST("/{id}/validate", func(e *core.RequestEvent) error {
		workflowId := e.Request.PathValue("id")
		if workflowId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing workflow ID"))
		}

		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   workflowId,
				User: userId,
			},
		}
		_, err = query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		validationResult, err := engine.ValidateWorkflow(workflowId)
		if err != nil {
			logger.LogError("Failed to validate workflow", "error", err, "workflowId", workflowId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to validate workflow"), err)
		}

		return util.RespondSuccess(e, http.StatusOK, validationResult)
	})

	workflowRouter.PUT("/workflow/{id}/graph", func(e *core.RequestEvent) error {
		workflowId := e.Request.PathValue("id")
		if workflowId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing workflow ID"))
		}

		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   workflowId,
				User: userId,
			},
		}
		_, err = query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		var requestBody struct {
			Nodes       []*workflow.Node `json:"nodes"`
			Connections []*workflow.Edge `json:"connections"`
		}

		decoder := json.NewDecoder(e.Request.Body)
		if err := decoder.Decode(&requestBody); err != nil {
			return util.RespondError(e, util.NewBadRequestError("Invalid request body format"))
		}

		validationResult, savedNodes, savedConnections, err := engine.SaveWorkflowGraph(workflowId, requestBody.Nodes, requestBody.Connections)
		if err != nil {
			logger.LogError("Failed to save workflow graph", "error", err, "workflowId", workflowId, "userId", userId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to save workflow graph"), err)
		}

		responseData := map[string]interface{}{
			"validation": validationResult,
		}

		if savedNodes != nil {
			responseData["nodes"] = savedNodes
		} else {
			responseData["nodes"] = []interface{}{}
		}

		if savedConnections != nil {
			responseData["connections"] = savedConnections
		} else {
			responseData["connections"] = []interface{}{}
		}

		if !validationResult.Valid {
			return util.RespondSuccess(e, http.StatusBadRequest, responseData)
		}

		return util.RespondSuccess(e, http.StatusOK, responseData)
	})

	workflowRouter.GET("/workflow/{id}/graph", func(e *core.RequestEvent) error {
		workflowId := e.Request.PathValue("id")
		if workflowId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing workflow ID"))
		}

		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   workflowId,
				User: userId,
			},
		}
		_, err = query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		nodes, err := query.FindAllByFilter[*models.WorkflowNode](map[string]interface{}{
			"workflow_id": workflowId,
		})
		if err != nil {
			logger.LogError("Failed to load workflow nodes", "error", err, "workflowId", workflowId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to load workflow nodes"), err)
		}

		connections, err := query.FindAllByFilter[*models.WorkflowConnection](map[string]interface{}{
			"workflow_id": workflowId,
		})
		if err != nil {
			logger.LogError("Failed to load workflow connections", "error", err, "workflowId", workflowId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to load workflow connections"), err)
		}

		return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
			"nodes":       nodes,
			"connections": connections,
		})
	})

	// PocketBase collection endpoints
	pocketbaseRouter := workflowRouter.Group("/pocketbase")

	pocketbaseRouter.GET("/collections", func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		_, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		// Get all collections by querying _collections table using DB directly
		pb := e.App.(*pocketbase.PocketBase)
		var collections []*core.Collection
		// Use DB query to get collections
		err = pb.DB().NewQuery("SELECT * FROM _collections WHERE type = {:type}").Bind(dbx.Params{"type": "base"}).All(&collections)
		if err != nil {
			logger.LogError("Failed to fetch collections", "error", err)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to fetch collections"), err)
		}

		// Filter out private/system collections (starting with _)
		publicCollections := make([]map[string]interface{}, 0)
		for _, collection := range collections {
			if len(collection.Name) > 0 && collection.Name[0] != '_' {
				publicCollections = append(publicCollections, map[string]interface{}{
					"id":   collection.Id,
					"name": collection.Name,
					"type": collection.Type,
				})
			}
		}

		return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
			"collections": publicCollections,
		})
	})

	pocketbaseRouter.GET("/collections/{collectionName}/schema", func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		_, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		collectionName := e.Request.PathValue("collectionName")
		if collectionName == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing collection name"))
		}

		collection, err := e.App.FindCollectionByNameOrId(collectionName)
		if err != nil {
			logger.LogError("Collection not found", "error", err, "collection", collectionName)
			return util.RespondError(e, util.ErrNotFound)
		}

		// Extract field information from collection schema
		fields := make([]map[string]interface{}, 0)
		for _, field := range collection.Fields {
			// Access field properties - PocketBase fields are typically accessed via their map representation
			// or we can marshal to JSON and unmarshal to get the structure
			fieldJSON, _ := json.Marshal(field)
			var fieldMap map[string]interface{}
			if err := json.Unmarshal(fieldJSON, &fieldMap); err == nil {
				fieldInfo := map[string]interface{}{
					"name":     fieldMap["name"],
					"type":     fieldMap["type"],
					"required": fieldMap["required"],
				}

				// Add default value if available
				if defaultValue, ok := fieldMap["options"]; ok {
					if optionsMap, ok := defaultValue.(map[string]interface{}); ok {
						if defVal, ok := optionsMap["default"]; ok {
							fieldInfo["default"] = defVal
						}
					}
				}

				fields = append(fields, fieldInfo)
			}
		}

		return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
			"collection": collectionName,
			"fields":     fields,
		})
	})

	pocketbaseRouter.GET("/collections/{collectionName}/count", func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		collectionName := e.Request.PathValue("collectionName")
		if collectionName == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing collection name"))
		}

		collection, err := e.App.FindCollectionByNameOrId(collectionName)
		if err != nil {
			logger.LogError("Collection not found", "error", err, "collection", collectionName)
			return util.RespondError(e, util.ErrNotFound)
		}

		// Get count of records in the collection
		// Filter by user if the collection has a user field
		pb := e.App.(*pocketbase.PocketBase)
		var count int64

		// Check if collection has a user field (common pattern: user, userId, owner, etc.)
		hasUserField := false
		for _, field := range collection.Fields {
			fieldJSON, _ := json.Marshal(field)
			var fieldMap map[string]interface{}
			if err := json.Unmarshal(fieldJSON, &fieldMap); err == nil {
				fieldName, _ := fieldMap["name"].(string)
				if fieldName == "user" || fieldName == "userId" || fieldName == "owner" || fieldName == "ownerId" {
					hasUserField = true
					break
				}
			}
		}

		query := pb.DB().Select("count(*)").From(collectionName)

		// If collection has a user field, filter by current user
		if hasUserField {
			// Try common user field names
			userFields := []string{"user", "userId", "owner", "ownerId"}
			for _, userField := range userFields {
				// Check if this field exists in the collection
				for _, field := range collection.Fields {
					fieldJSON, _ := json.Marshal(field)
					var fieldMap map[string]interface{}
					if err := json.Unmarshal(fieldJSON, &fieldMap); err == nil {
						if fieldMap["name"] == userField {
							query = query.AndWhere(dbx.HashExp{userField: userId})
							break
						}
					}
				}
			}
		}

		err = query.Row(&count)
		if err != nil {
			logger.LogError("Failed to count records", "error", err, "collection", collectionName)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to count records"), err)
		}

		return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
			"collection": collectionName,
			"count":      count,
		})
	})

	// Schema introspection endpoints
	workflowRouter.GET("/workflow/{id}/schema", func(e *core.RequestEvent) error {
		workflowId := e.Request.PathValue("id")
		if workflowId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing workflow ID"))
		}

		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   workflowId,
				User: userId,
			},
		}
		_, err = query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		schema, err := engine.GetWorkflowSchema(workflowId)
		if err != nil {
			logger.LogError("Failed to get workflow schema", "error", err, "workflowId", workflowId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to get workflow schema"), err)
		}

		return util.RespondSuccess(e, http.StatusOK, schema)
	})

	workflowRouter.GET("/workflow/{id}/nodes/{nodeId}/schema/output", func(e *core.RequestEvent) error {
		workflowId := e.Request.PathValue("id")
		nodeId := e.Request.PathValue("nodeId")
		if workflowId == "" || nodeId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing workflow ID or node ID"))
		}

		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   workflowId,
				User: userId,
			},
		}
		_, err = query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		schema, err := engine.GetNodeOutputSchema(workflowId, nodeId)
		if err != nil {
			logger.LogError("Failed to get node output schema", "error", err, "workflowId", workflowId, "nodeId", nodeId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to get node output schema"), err)
		}

		return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
			"node_id":       nodeId,
			"workflow_id":   workflowId,
			"output_schema": schema,
		})
	})

	workflowRouter.GET("/workflow/{id}/nodes/{nodeId}/schema/input", func(e *core.RequestEvent) error {
		workflowId := e.Request.PathValue("id")
		nodeId := e.Request.PathValue("nodeId")
		if workflowId == "" || nodeId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing workflow ID or node ID"))
		}

		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   workflowId,
				User: userId,
			},
		}
		_, err = query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		nodes, err := query.FindAllByFilter[*models.WorkflowNode](map[string]interface{}{
			"workflow_id": workflowId,
		})
		if err != nil {
			return util.RespondWithError(e, util.NewBadRequestError("Failed to load workflow nodes"), err)
		}

		targetNode, err := query.FindById[*models.WorkflowNode](nodeId)
		if err != nil {
			return util.RespondError(e, util.NewBadRequestError("Node not found"))
		}

		if targetNode.Type == "source" {
			return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
				"node_id":      nodeId,
				"workflow_id":  workflowId,
				"input_schema": nil,
			})
		}

		upstreamConnections, err := query.FindAllByFilter[*models.WorkflowConnection](map[string]interface{}{
			"workflow_id": workflowId,
			"target_id":   nodeId,
		})
		if err != nil {
			return util.RespondWithError(e, util.NewBadRequestError("Failed to load connections"), err)
		}

		inputSchemas := make([]types.DataSchema, 0, len(upstreamConnections))
		nodeLabels := make(map[string]string)

		for _, node := range nodes {
			nodeLabels[node.Id] = node.Label
		}

		for _, conn := range upstreamConnections {
			upstreamSchema, err := engine.GetNodeOutputSchema(workflowId, conn.SourceID)
			if err != nil {
				logger.LogError("Failed to get upstream schema", "error", err, "upstreamNodeId", conn.SourceID)
				continue // Skip this upstream node
			}
			inputSchemas = append(inputSchemas, *upstreamSchema)
		}

		var inputSchema *types.DataSchema
		if len(inputSchemas) == 0 {
			inputSchema = &types.DataSchema{
				Fields:      make([]types.FieldDefinition, 0),
				SourceNodes: make([]string, 0),
			}
		} else if len(inputSchemas) == 1 {
			inputSchema = &inputSchemas[0]
		} else {
			// Use the mergeSchemas function from workflow package
			// Since it's not exported, we'll merge manually here
			merged := types.DataSchema{
				Fields:      make([]types.FieldDefinition, 0),
				SourceNodes: make([]string, 0),
			}

			// Collect all source nodes
			sourceNodeSet := make(map[string]bool)
			for _, schema := range inputSchemas {
				for _, nodeID := range schema.SourceNodes {
					sourceNodeSet[nodeID] = true
				}
			}
			for nodeID := range sourceNodeSet {
				merged.SourceNodes = append(merged.SourceNodes, nodeID)
			}

			// Count field occurrences
			fieldCounts := make(map[string]int)
			for _, schema := range inputSchemas {
				for _, field := range schema.Fields {
					fieldCounts[field.Name]++
				}
			}

			// Identify conflicts
			conflictFields := make(map[string]bool)
			for fieldName, count := range fieldCounts {
				if count > 1 {
					conflictFields[fieldName] = true
				}
			}

			// Merge fields with conflict resolution
			addedFields := make(map[string]bool)
			for _, schema := range inputSchemas {
				for _, field := range schema.Fields {
					mergedField := field

					// Prefix conflicting fields
					if conflictFields[field.Name] && field.SourceNode != "" {
						prefix := nodeLabels[field.SourceNode]
						if prefix == "" {
							prefix = field.SourceNode
							if len(prefix) > 8 {
								prefix = prefix[:8]
							}
						}
						mergedField.Name = fmt.Sprintf("%s_%s", prefix, field.Name)
						if mergedField.Description == "" {
							mergedField.Description = fmt.Sprintf("%s (from %s)", field.Name, prefix)
						}
					}

					// Avoid duplicates
					if !addedFields[mergedField.Name] {
						merged.Fields = append(merged.Fields, mergedField)
						addedFields[mergedField.Name] = true
					}
				}
			}

			inputSchema = &merged
		}

		return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
			"node_id":      nodeId,
			"workflow_id":  workflowId,
			"input_schema": inputSchema,
		})
	})

	workflowRouter.GET("/workflow/{id}/nodes/{nodeId}/sample", func(e *core.RequestEvent) error {
		workflowId := e.Request.PathValue("id")
		nodeId := e.Request.PathValue("nodeId")
		if workflowId == "" || nodeId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing workflow ID or node ID"))
		}

		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   workflowId,
				User: userId,
			},
		}
		_, err = query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		// Get limit from query parameter (default 20, max 100)
		limit := 20
		if limitStr := e.Request.URL.Query().Get("limit"); limitStr != "" {
			if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
				if parsedLimit > 100 {
					limit = 100
				} else {
					limit = parsedLimit
				}
			}
		}

		sampleData, err := engine.GetNodeSampleData(workflowId, nodeId, limit)
		if err != nil {
			logger.LogError("Failed to get node sample data", "error", err, "workflowId", workflowId, "nodeId", nodeId, "userId", userId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to get node sample data: "+err.Error()), err)
		}

		return util.RespondSuccess(e, http.StatusOK, sampleData)
	})

	workflowRouter.POST("/workflow/{id}/validate-schema", func(e *core.RequestEvent) error {
		workflowId := e.Request.PathValue("id")
		if workflowId == "" {
			return util.RespondError(e, util.NewBadRequestError("Missing workflow ID"))
		}

		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		workflowFilter := &query.WorkflowFilter{
			BaseFilter: query.BaseFilter{
				ID:   workflowId,
				User: userId,
			},
		}
		_, err = query.FindByFilter[*models.Workflow](workflowFilter.ToMap())
		if err != nil {
			return util.RespondError(e, util.ErrNotFound)
		}

		// Get workflow schema and validate
		schema, err := engine.GetWorkflowSchema(workflowId)
		if err != nil {
			logger.LogError("Failed to get workflow schema for validation", "error", err, "workflowId", workflowId)
			return util.RespondWithError(e, util.NewBadRequestError("Failed to validate workflow schema"), err)
		}

		// Basic validation: check if all nodes have valid schemas
		errors := make([]string, 0)
		warnings := make([]string, 0)

		if nodeSchemas, ok := schema["node_schemas"].(map[string]interface{}); ok {
			for nodeID, nodeSchemaData := range nodeSchemas {
				if nodeSchemaMap, ok := nodeSchemaData.(map[string]interface{}); ok {
					if errMsg, hasError := nodeSchemaMap["error"].(string); hasError {
						errors = append(errors, fmt.Sprintf("Node %s: %s", nodeID, errMsg))
					}
				}
			}
		}

		valid := len(errors) == 0

		return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
			"valid":    valid,
			"errors":   errors,
			"warnings": warnings,
			"schema":   schema,
		})
	})
}

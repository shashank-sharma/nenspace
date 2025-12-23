package workflow

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase"
	pbTypes "github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	wfModels "github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/workflow/connectors"
	"github.com/shashank-sharma/backend/internal/services/workflow/types"
	"github.com/shashank-sharma/backend/internal/util"
)

// Node represents a node in a workflow graph
type Node struct {
	ID       string                 `json:"id"`                // Unique identifier for the node
	Name     string                 `json:"name"`              // Display name of the node
	Type     string                 `json:"type"`              // Category of the node: "source", "processor", or "destination"
	NodeType string                 `json:"node_type"`         // Specific connector type (e.g., "pocketbase_source", "pb_to_csv_converter")
	Config   map[string]interface{} `json:"config"`            // Configuration parameters for the node
	Inputs   []string               `json:"inputs,omitempty"`  // IDs of nodes that feed into this node
	Outputs  []string               `json:"outputs,omitempty"` // IDs of nodes that this node feeds into
	Position struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	} `json:"position"` // Visual position of the node in the workflow editor
}

// Edge represents a connection between nodes
type Edge struct {
	ID     string `json:"id"`     // Unique identifier for the edge
	Source string `json:"source"` // ID of the source node
	Target string `json:"target"` // ID of the target node
}

// WorkflowData represents the structure of a workflow
type WorkflowData struct {
	Nodes []*Node `json:"nodes"` // List of nodes in the workflow
	Edges []*Edge `json:"edges"` // List of connections between nodes
}

// Graph represents the workflow execution graph
type Graph struct {
	Nodes map[string]*Node // Map of node ID to node
	Edges []*Edge          // List of connections between nodes
}

type WorkflowEngine struct {
	dao         *pocketbase.PocketBase
	registry    types.ConnectorRegistry
	schemaCache *SchemaCache
}

func (e *WorkflowEngine) GetRegistry() types.ConnectorRegistry {
	return e.registry
}

type executionState struct {
	logs        []map[string]interface{}
	logBuffer   []map[string]interface{}
	lastLogTime time.Time
	logMutex    sync.Mutex
}

// NewWorkflowEngine creates a new workflow engine
func NewWorkflowEngine(pb *pocketbase.PocketBase) *WorkflowEngine {
	registry := NewConnectorRegistryImpl()

	// Register all connectors using the centralized function
	RegisterConnectors(registry)

	// Log all available connectors for debugging
	availableConnectors := registry.GetAvailableConnectors()
	logger.LogInfo("Available workflow connectors: %v", availableConnectors)

	return &WorkflowEngine{
		dao:         pb,
		registry:    registry,
		schemaCache: NewSchemaCache(5*time.Minute, 1000), // 5 minute TTL, max 1000 entries
	}
}

func (e *WorkflowEngine) ExecuteWorkflow(ctx context.Context, workflowID string) (*wfModels.WorkflowExecution, error) {
	workflow, err := query.FindById[*wfModels.Workflow](workflowID)
	if err != nil {
		return nil, fmt.Errorf("workflow not found: %w", err)
	}

	if !workflow.Active {
		return nil, fmt.Errorf("workflow is not active")
	}

	timeout := workflow.Timeout
	if timeout <= 0 {
		timeout = 3600
	}

	// Create context with timeout for the workflow execution
	// Note: We don't defer cancel() here because the goroutine needs the context to stay alive
	// The context will be automatically cancelled when the timeout expires
	if timeout > 0 {
		ctx, _ = context.WithTimeout(ctx, time.Duration(timeout)*time.Second)
	}

	workflowExecution := &wfModels.WorkflowExecution{
		WorkflowID: workflowID,
		Status:     "running",
		StartTime:  pbTypes.NowDateTime(),
		Logs:       "[]",
		Results:    "{}",
	}

	err = query.UpsertRecord[*wfModels.WorkflowExecution](workflowExecution, map[string]interface{}{
		"workflow_id": workflowID,
		"status":      "running",
		"start_time":  pbTypes.NowDateTime(),
		"logs":        "[]",
		"results":     "{}",
	})

	if err != nil {
		logger.Error.Println("Failed updating record", err)
	}

	go func() {
		e.runWorkflow(ctx, workflow, workflowExecution.Id)
	}()

	return workflowExecution, nil
}

// GetExecutionStatus retrieves the status of a workflow execution
func (e *WorkflowEngine) GetExecutionStatus(executionID string) (map[string]interface{}, error) {
	execution, err := query.FindById[*wfModels.WorkflowExecution](executionID)
	if err != nil {
		return nil, fmt.Errorf("execution not found: %w", err)
	}

	status := map[string]interface{}{
		"id":              execution.Id,
		"workflow_id":     execution.WorkflowID,
		"status":          execution.Status,
		"start_time":      execution.StartTime,
		"end_time":        execution.EndTime,
		"duration":        execution.Duration,
		"error_message":   execution.ErrorMessage,
		"result_file_ids": execution.ResultFileIDs,
	}

	// Parse logs if not empty
	if execution.Logs != "" && execution.Logs != "[]" {
		var logs []interface{}
		if err := json.Unmarshal([]byte(execution.Logs), &logs); err == nil {
			status["logs"] = logs
		} else {
			status["logs"] = []interface{}{}
		}
	} else {
		status["logs"] = []interface{}{}
	}

	// Parse results if not empty
	if execution.Results != "" && execution.Results != "{}" {
		var results map[string]interface{}
		if err := json.Unmarshal([]byte(execution.Results), &results); err == nil {
			status["results"] = results
		} else {
			status["results"] = map[string]interface{}{}
		}
	} else {
		status["results"] = map[string]interface{}{}
	}

	return status, nil
}

func (e *WorkflowEngine) runWorkflow(ctx context.Context, workflow *wfModels.Workflow, executionID string) {
	startTime := time.Now()
	state := &executionState{
		logs:        make([]map[string]interface{}, 0),
		logBuffer:   make([]map[string]interface{}, 0),
		lastLogTime: time.Now(),
	}

	e.addLog(state, "info", fmt.Sprintf("Starting workflow execution %s", executionID), nil)
	e.flushLogs(executionID, state)

	select {
	case <-ctx.Done():
		if ctx.Err() == context.DeadlineExceeded {
			e.addLog(state, "error", "Workflow execution timed out", nil)
			e.updateExecutionStatus(executionID, "failed", NewTimeoutError(workflow.Timeout).Error(), startTime, state.logs, nil)
		} else {
			e.addLog(state, "error", "Workflow execution was cancelled", nil)
			e.updateExecutionStatus(executionID, "cancelled", NewCancellationError().Error(), startTime, state.logs, nil)
		}
		return
	default:
	}

	nodes, err := query.FindAllByFilter[*wfModels.WorkflowNode](map[string]interface{}{
		"workflow_id": workflow.Id,
	})
	if err != nil {
		e.addLog(state, "error", fmt.Sprintf("Failed to load workflow nodes: %v", err), nil)
		e.updateExecutionStatus(executionID, "failed", err.Error(), startTime, state.logs, nil)
		return
	}

	connections, err := query.FindAllByFilter[*wfModels.WorkflowConnection](map[string]interface{}{
		"workflow_id": workflow.Id,
	})
	if err != nil {
		e.addLog(state, "error", fmt.Sprintf("Failed to load workflow connections: %v", err), nil)
		e.updateExecutionStatus(executionID, "failed", err.Error(), startTime, state.logs, nil)
		return
	}

	e.addLog(state, "info", fmt.Sprintf("Loaded %d nodes and %d connections", len(nodes), len(connections)), nil)
	e.flushLogs(executionID, state)

	graph, err := e.buildGraph(nodes, connections)
	if err != nil {
		e.addLog(state, "error", fmt.Sprintf("Failed to build execution graph: %v", err), nil)
		e.updateExecutionStatus(executionID, "failed", err.Error(), startTime, state.logs, nil)
		return
	}

	validationResult := e.validateGraph(graph)
	if !validationResult.Valid {
		errorMsg := fmt.Sprintf("Workflow validation failed: %v", validationResult.Errors)
		e.addLog(state, "error", errorMsg, nil)
		e.updateExecutionStatus(executionID, "failed", errorMsg, startTime, state.logs, nil)
		return
	}

	for _, warning := range validationResult.Warnings {
		e.addLog(state, "warn", warning, nil)
	}

	for _, node := range graph.Nodes {
		if err := e.validateNodeConfig(node); err != nil {
			e.addLog(state, "error", fmt.Sprintf("Node %s validation failed: %v", node.ID, err), nil)
			e.updateExecutionStatus(executionID, "failed", err.Error(), startTime, state.logs, nil)
			return
		}
	}

	e.addLog(state, "info", "Built and validated execution graph", nil)
	e.flushLogs(executionID, state)

	results, nodeResults, err := e.executeGraph(ctx, graph, workflow, state, executionID)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			e.addLog(state, "error", "Workflow execution timed out", nil)
			e.updateExecutionStatus(executionID, "failed", NewTimeoutError(workflow.Timeout).Error(), startTime, state.logs, nodeResults)
		} else if ctx.Err() == context.Canceled {
			e.addLog(state, "error", "Workflow execution was cancelled", nil)
			e.updateExecutionStatus(executionID, "cancelled", NewCancellationError().Error(), startTime, state.logs, nodeResults)
		} else {
			e.addLog(state, "error", fmt.Sprintf("Error executing workflow: %v", err), nil)
			e.updateExecutionStatus(executionID, "failed", err.Error(), startTime, state.logs, nodeResults)
		}
		return
	}

	e.addLog(state, "info", "Workflow execution completed successfully", nil)
	e.flushLogs(executionID, state)
	e.updateExecutionStatus(executionID, "completed", "", startTime, state.logs, results)
}

func (e *WorkflowEngine) buildGraph(nodes []*wfModels.WorkflowNode, connections []*wfModels.WorkflowConnection) (*Graph, error) {
	graph := &Graph{
		Nodes: make(map[string]*Node),
		Edges: make([]*Edge, 0, len(connections)),
	}

	for _, node := range nodes {
		var config map[string]interface{}
		if node.Config != "" {
			if err := json.Unmarshal([]byte(node.Config), &config); err != nil {
				return nil, fmt.Errorf("invalid config for node %s: %w", node.Id, err)
			}
		} else {
			config = make(map[string]interface{})
		}

		graph.Nodes[node.Id] = &Node{
			ID:       node.Id,
			Name:     node.Label,
			Type:     node.Type,
			NodeType: node.NodeType,
			Config:   config,
			Inputs:   []string{},
			Outputs:  []string{},
			Position: struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
			}{
				X: float64(node.PositionX),
				Y: float64(node.PositionY),
			},
		}
	}

	for _, conn := range connections {
		sourceID := conn.SourceID
		targetID := conn.TargetID

		if _, exists := graph.Nodes[sourceID]; !exists {
			return nil, fmt.Errorf("source node %s not found", sourceID)
		}

		if _, exists := graph.Nodes[targetID]; !exists {
			return nil, fmt.Errorf("target node %s not found", targetID)
		}

		edge := &Edge{
			ID:     conn.Id,
			Source: sourceID,
			Target: targetID,
		}

		graph.Edges = append(graph.Edges, edge)
		graph.Nodes[sourceID].Outputs = append(graph.Nodes[sourceID].Outputs, targetID)
		graph.Nodes[targetID].Inputs = append(graph.Nodes[targetID].Inputs, sourceID)
	}

	return graph, nil
}

func (e *WorkflowEngine) executeGraph(ctx context.Context, graph *Graph, workflow *wfModels.Workflow, state *executionState, executionID string) (map[string]interface{}, map[string]interface{}, error) {
	e.addLog(state, "info", fmt.Sprintf("Starting graph execution with %d total nodes", len(graph.Nodes)), nil)
	e.flushLogs(executionID, state)

	nodeResults := make(map[string]interface{})
	nodeResultsMutex := sync.Mutex{}

	sourceNodes := make([]*Node, 0)
	for _, node := range graph.Nodes {
		if len(node.Inputs) == 0 && node.Type == "source" {
			sourceNodes = append(sourceNodes, node)
		}
	}

	if len(sourceNodes) == 0 {
		e.addLog(state, "error", "No source nodes found in workflow", nil)
		e.flushLogs(executionID, state)
		return nil, nodeResults, fmt.Errorf("no source nodes found in workflow")
	}

	e.addLog(state, "info", fmt.Sprintf("Found %d source node(s) to start execution", len(sourceNodes)), nil)
	for i, sourceNode := range sourceNodes {
		e.addLog(state, "info", fmt.Sprintf("Source node %d: %s (ID: %s, Connector: %s)", i+1, sourceNode.Name, sourceNode.ID, sourceNode.NodeType), map[string]interface{}{"node_id": sourceNode.ID})
	}
	e.flushLogs(executionID, state)

	visited := make(map[string]bool)
	visitedMutex := sync.Mutex{}
	readyNodes := make(chan *Node, len(graph.Nodes))
	errorChan := make(chan error, 1)
	var wg sync.WaitGroup

	for _, sourceNode := range sourceNodes {
		readyNodes <- sourceNode
	}

	maxParallel := 10
	semaphore := make(chan struct{}, maxParallel)

	processorDone := make(chan struct{})
	go func() {
		defer close(processorDone)
		for {
			select {
			case <-ctx.Done():
				return
			case node, ok := <-readyNodes:
				if !ok {
					return
				}

				select {
				case <-ctx.Done():
					return
				case semaphore <- struct{}{}:
					wg.Add(1)

					go func(n *Node) {
						defer func() {
							<-semaphore
							wg.Done()
						}()

						select {
						case <-ctx.Done():
							return
						default:
						}

						visitedMutex.Lock()
						if visited[n.ID] {
							visitedMutex.Unlock()
							e.addLog(state, "info", fmt.Sprintf("Node %s (%s) already executed, skipping", n.Name, n.ID), map[string]interface{}{"node_id": n.ID})
							e.flushLogs(executionID, state)
							return
						}
						visitedMutex.Unlock()

						var input map[string]interface{}
						if len(n.Inputs) > 0 {
							e.addLog(state, "info", fmt.Sprintf("Aggregating inputs for node %s (%s) from %d source node(s)", n.Name, n.ID, len(n.Inputs)), map[string]interface{}{"node_id": n.ID, "input_count": len(n.Inputs)})
							e.flushLogs(executionID, state)
							nodeResultsMutex.Lock()
							// Build node labels map for conflict resolution
							nodeLabels := make(map[string]string)
							for nodeID, node := range graph.Nodes {
								nodeLabels[nodeID] = node.Name
							}
							var err error
							input, err = aggregateNodeInputs(nodeResults, n.Inputs, nodeLabels)
							nodeResultsMutex.Unlock()
							if err != nil {
								e.addLog(state, "error", fmt.Sprintf("Failed to aggregate inputs for node %s: %v", n.ID, err), map[string]interface{}{"node_id": n.ID})
								e.flushLogs(executionID, state)
								select {
								case errorChan <- fmt.Errorf("failed to aggregate inputs for node %s: %w", n.ID, err):
								default:
								}
								return
							}
							inputSize := 0
							if input != nil {
								inputJSON, _ := json.Marshal(input)
								inputSize = len(inputJSON)
							}
							e.addLog(state, "info", fmt.Sprintf("Input aggregated for node %s (%s), size: %d bytes", n.Name, n.ID, inputSize), map[string]interface{}{"node_id": n.ID})
							e.flushLogs(executionID, state)
						} else {
							e.addLog(state, "info", fmt.Sprintf("Node %s (%s) has no inputs (source node)", n.Name, n.ID), map[string]interface{}{"node_id": n.ID})
							e.flushLogs(executionID, state)
						}

						e.addLog(state, "info", fmt.Sprintf("Executing node: %s (ID: %s, Type: %s, Connector: %s)", n.Name, n.ID, n.Type, n.NodeType), map[string]interface{}{"node_id": n.ID, "node_name": n.Name, "node_type": n.Type, "connector": n.NodeType})
						e.flushLogs(executionID, state)

						result, err := e.executeNodeWithRetry(ctx, n, input, workflow, state, executionID)
						if err != nil {
							e.addLog(state, "error", fmt.Sprintf("Node %s (%s) execution failed: %v", n.Name, n.ID, err), map[string]interface{}{"node_id": n.ID, "error": err.Error()})
							e.flushLogs(executionID, state)
							select {
							case errorChan <- fmt.Errorf("failed to execute node %s: %w", n.ID, err):
							default:
							}
							return
						}

						resultSize := 0
						if result != nil {
							resultJSON, _ := json.Marshal(result)
							resultSize = len(resultJSON)
						}
						e.addLog(state, "info", fmt.Sprintf("Node %s (%s) executed successfully, output size: %d bytes", n.Name, n.ID, resultSize), map[string]interface{}{"node_id": n.ID, "status": "success", "output_size": resultSize})
						e.flushLogs(executionID, state)

						nodeResultsMutex.Lock()
						nodeResults[n.ID] = result
						nodeResultsMutex.Unlock()

						visitedMutex.Lock()
						visited[n.ID] = true
						visitedMutex.Unlock()

						if len(n.Outputs) > 0 {
							e.addLog(state, "info", fmt.Sprintf("Node %s (%s) completed, checking %d downstream node(s)", n.Name, n.ID, len(n.Outputs)), map[string]interface{}{"node_id": n.ID, "downstream_count": len(n.Outputs)})
							e.flushLogs(executionID, state)
						}

						for _, targetID := range n.Outputs {
							targetNode := graph.Nodes[targetID]
							visitedMutex.Lock()
							allInputsReady := true
							readyInputs := 0
							for _, inputID := range targetNode.Inputs {
								if visited[inputID] {
									readyInputs++
								} else {
									allInputsReady = false
								}
							}
							visitedMutex.Unlock()

							if allInputsReady {
								e.addLog(state, "info", fmt.Sprintf("All inputs ready for node %s (%s), queuing for execution", targetNode.Name, targetID), map[string]interface{}{"node_id": targetID, "node_name": targetNode.Name})
								e.flushLogs(executionID, state)
								select {
								case <-ctx.Done():
									return
								case readyNodes <- targetNode:
								}
							} else {
								e.addLog(state, "info", fmt.Sprintf("Node %s (%s) waiting for inputs: %d/%d ready", targetNode.Name, targetID, readyInputs, len(targetNode.Inputs)), map[string]interface{}{"node_id": targetID, "ready_inputs": readyInputs, "total_inputs": len(targetNode.Inputs)})
								e.flushLogs(executionID, state)
							}
						}
					}(node)
				}
			}
		}
	}()

	done := make(chan struct{})
	go func() {
		// Wait for all worker goroutines to complete
		wg.Wait()

		// Give a small delay to ensure all visited flags are set
		time.Sleep(10 * time.Millisecond)

		// Now close readyNodes to signal processor to exit
		close(readyNodes)

		// Wait for processor to finish
		<-processorDone

		close(done)
	}()

	select {
	case <-ctx.Done():
		// Don't close readyNodes here - let the processor handle it
		return nil, nodeResults, ctx.Err()
	case err := <-errorChan:
		// Don't close readyNodes here - let the processor handle it
		return nil, nodeResults, err
	case <-done:
		// All nodes have been processed
		e.addLog(state, "info", "All node execution goroutines completed", nil)
		e.flushLogs(executionID, state)
	}

	// Ensure we have the final visited count after all workers complete
	visitedMutex.Lock()
	visitedCount := len(visited)
	e.addLog(state, "info", fmt.Sprintf("Final visited count: %d/%d nodes", visitedCount, len(graph.Nodes)), nil)
	e.flushLogs(executionID, state)

	finalResults := make(map[string]interface{})
	destinationCount := 0
	for id, node := range graph.Nodes {
		if node.Type == "destination" && visited[id] {
			destinationCount++
			if result, exists := nodeResults[id]; exists {
				finalResults[id] = result
				resultSize := 0
				if result != nil {
					resultJSON, _ := json.Marshal(result)
					resultSize = len(resultJSON)
				}
				e.addLog(state, "info", fmt.Sprintf("Destination node %s (%s) completed with result size: %d bytes", node.Name, id, resultSize), map[string]interface{}{"node_id": id, "node_name": node.Name})
			}
		}
	}
	visitedMutex.Unlock()

	e.addLog(state, "info", fmt.Sprintf("Graph execution completed: %d/%d nodes executed, %d destination node(s) completed", visitedCount, len(graph.Nodes), destinationCount), map[string]interface{}{"visited_count": visitedCount, "total_nodes": len(graph.Nodes), "destination_count": destinationCount})
	e.flushLogs(executionID, state)

	return finalResults, nodeResults, nil
}

func (e *WorkflowEngine) executeNodeWithRetry(ctx context.Context, node *Node, input map[string]interface{}, workflow *wfModels.Workflow, state *executionState, executionID string) (map[string]interface{}, error) {
	maxRetries := workflow.MaxRetries
	if maxRetries <= 0 {
		maxRetries = 0
	}

	retryDelay := workflow.RetryDelay
	if retryDelay <= 0 {
		retryDelay = 1
	}

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		if attempt > 0 {
			delay := time.Duration(retryDelay*attempt) * time.Second
			e.addLog(state, "info", fmt.Sprintf("Retrying node %s (%s), attempt %d/%d after %d second(s)", node.Name, node.ID, attempt, maxRetries, retryDelay*attempt), map[string]interface{}{"node_id": node.ID, "attempt": attempt, "max_retries": maxRetries})
			e.flushLogs(executionID, state)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		} else if maxRetries > 0 {
			e.addLog(state, "info", fmt.Sprintf("Node %s (%s) execution attempt 1/%d", node.Name, node.ID, maxRetries+1), map[string]interface{}{"node_id": node.ID, "max_retries": maxRetries})
			e.flushLogs(executionID, state)
		}

		result, err := e.executeNode(ctx, node, input, state, executionID)
		if err == nil {
			if attempt > 0 {
				e.addLog(state, "info", fmt.Sprintf("Node %s (%s) succeeded on attempt %d", node.Name, node.ID, attempt+1), map[string]interface{}{"node_id": node.ID, "attempt": attempt + 1})
				e.flushLogs(executionID, state)
			}
			return result, nil
		}

		lastErr = err
		if attempt < maxRetries {
			e.addLog(state, "warn", fmt.Sprintf("Node %s (%s) attempt %d failed: %v", node.Name, node.ID, attempt+1, err), map[string]interface{}{"node_id": node.ID, "attempt": attempt + 1, "error": err.Error()})
			e.flushLogs(executionID, state)
		}
	}

	return nil, fmt.Errorf("node %s failed after %d retries: %w", node.ID, maxRetries, lastErr)
}

func (e *WorkflowEngine) executeNode(ctx context.Context, node *Node, input map[string]interface{}, state *executionState, executionID string) (map[string]interface{}, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	if node.NodeType == "" {
		return nil, NewValidationError("node type is empty", node.ID)
	}

	e.addLog(state, "info", fmt.Sprintf("Creating connector instance: %s for node %s", node.NodeType, node.ID), map[string]interface{}{"node_id": node.ID, "connector": node.NodeType})
	e.flushLogs(executionID, state)

	connector, err := e.registry.Create(node.NodeType)
	if err != nil {
		e.addLog(state, "error", fmt.Sprintf("Failed to create connector %s for node %s: %v", node.NodeType, node.ID, err), map[string]interface{}{"node_id": node.ID, "connector": node.NodeType, "error": err.Error()})
		e.flushLogs(executionID, state)
		return nil, NewExecutionError(fmt.Sprintf("failed to create connector: %s", node.NodeType), node.ID, err)
	}

	e.addLog(state, "info", fmt.Sprintf("Configuring connector %s for node %s", node.NodeType, node.ID), map[string]interface{}{"node_id": node.ID, "connector": node.NodeType})
	e.flushLogs(executionID, state)

	if err := connector.Configure(node.Config); err != nil {
		e.addLog(state, "error", fmt.Sprintf("Failed to configure connector %s for node %s: %v", node.NodeType, node.ID, err), map[string]interface{}{"node_id": node.ID, "connector": node.NodeType, "error": err.Error()})
		e.flushLogs(executionID, state)
		return nil, NewExecutionError("failed to configure connector", node.ID, err)
	}

	e.addLog(state, "info", fmt.Sprintf("Running connector %s execution for node %s", node.NodeType, node.ID), map[string]interface{}{"node_id": node.ID, "connector": node.NodeType})
	e.flushLogs(executionID, state)

	// Validate input schema compatibility
	if input != nil {
		inputEnvelope := types.FromMap(input)
		if len(inputEnvelope.Metadata.Schema.Fields) > 0 {
			if err := ValidateSchemaCompatibility(connector, node.ID, &inputEnvelope.Metadata.Schema); err != nil {
				e.addLog(state, "warn", fmt.Sprintf("Input schema validation warning for node %s: %v", node.ID, err), map[string]interface{}{"node_id": node.ID, "warning": err.Error()})
				e.flushLogs(executionID, state)
				// Don't fail on validation warnings, just log them
			}
		}
	}

	startTime := time.Now()
	result, err := connector.Execute(ctx, input)
	duration := time.Since(startTime)

	if err != nil {
		e.addLog(state, "error", fmt.Sprintf("Connector %s execution failed for node %s after %v: %v", node.NodeType, node.ID, duration, err), map[string]interface{}{"node_id": node.ID, "connector": node.NodeType, "duration_ms": duration.Milliseconds(), "error": err.Error()})
		e.flushLogs(executionID, state)
		return nil, NewExecutionError("connector execution failed", node.ID, err)
	}

	// Ensure result is in envelope format and set metadata
	resultEnvelope := types.FromMap(result)
	resultEnvelope.Metadata.NodeID = node.ID
	resultEnvelope.Metadata.NodeType = node.NodeType
	resultEnvelope.Metadata.ExecutionTimeMs = duration.Milliseconds()

	// If schema is empty, try to infer from data
	if len(resultEnvelope.Metadata.Schema.Fields) == 0 && len(resultEnvelope.Data) > 0 {
		resultEnvelope.Metadata.Schema = inferSchemaFromData(resultEnvelope.Data)
	}

	e.addLog(state, "info", fmt.Sprintf("Connector %s execution completed for node %s in %v", node.NodeType, node.ID, duration), map[string]interface{}{"node_id": node.ID, "connector": node.NodeType, "duration_ms": duration.Milliseconds(), "record_count": resultEnvelope.Metadata.RecordCount, "field_count": len(resultEnvelope.Metadata.Schema.Fields)})
	e.flushLogs(executionID, state)

	return resultEnvelope.ToMap(), nil
}

func (e *WorkflowEngine) updateExecutionStatus(
	executionID string,
	status string,
	errorMessage string,
	startTime time.Time,
	logs []map[string]interface{},
	results map[string]interface{},
) {
	execution, err := query.FindById[*wfModels.WorkflowExecution](executionID)
	if err != nil {
		logger.Error.Printf("Failed to find execution record %s: %v", executionID, err)
		return
	}

	endTime := time.Now()
	duration := int(endTime.Sub(startTime).Milliseconds())

	execution.Status = status
	execution.EndTime = pbTypes.NowDateTime()
	execution.Duration = duration

	if errorMessage != "" {
		execution.ErrorMessage = errorMessage
	}

	if logs != nil {
		logsJSON, err := json.Marshal(logs)
		if err == nil {
			execution.Logs = string(logsJSON)
		}
	}

	if results != nil {
		resultsJSON, err := json.Marshal(results)
		if err == nil {
			execution.Results = string(resultsJSON)
		}
	}

	// Save the record
	if err := query.SaveRecord(execution); err != nil {
		logger.Error.Printf("Failed to update execution record %s: %v", executionID, err)
	}
}

func (e *WorkflowEngine) addLog(state *executionState, level, message string, metadata map[string]interface{}) {
	state.logMutex.Lock()
	defer state.logMutex.Unlock()

	logEntry := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"level":     level,
		"message":   message,
	}

	if metadata != nil {
		for k, v := range metadata {
			logEntry[k] = v
		}
	}

	state.logs = append(state.logs, logEntry)
	state.logBuffer = append(state.logBuffer, logEntry)
	state.lastLogTime = time.Now()
}

func (e *WorkflowEngine) flushLogs(executionID string, state *executionState) {
	state.logMutex.Lock()
	defer state.logMutex.Unlock()

	if len(state.logBuffer) == 0 {
		return
	}

	if time.Since(state.lastLogTime) < 2*time.Second && len(state.logBuffer) < 10 {
		return
	}

	execution, err := query.FindById[*wfModels.WorkflowExecution](executionID)
	if err != nil {
		logger.Error.Printf("Failed to find execution record %s: %v", executionID, err)
		state.logBuffer = make([]map[string]interface{}, 0)
		return
	}

	logsJSON, err := json.Marshal(state.logs)
	if err != nil {
		logger.Error.Printf("Failed to marshal logs for execution %s: %v", executionID, err)
		state.logBuffer = make([]map[string]interface{}, 0)
		return
	}

	execution.Logs = string(logsJSON)

	if err := query.SaveRecord(execution); err != nil {
		logger.Error.Printf("Failed to update logs for execution %s: %v", executionID, err)
	}

	state.logBuffer = make([]map[string]interface{}, 0)
}

func (e *WorkflowEngine) ValidateWorkflow(workflowID string) (*ValidationResult, error) {
	workflow, err := query.FindById[*wfModels.Workflow](workflowID)
	if err != nil {
		return nil, fmt.Errorf("workflow not found: %w", err)
	}

	nodes, err := query.FindAllByFilter[*wfModels.WorkflowNode](map[string]interface{}{
		"workflow_id": workflow.Id,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to load workflow nodes: %w", err)
	}

	connections, err := query.FindAllByFilter[*wfModels.WorkflowConnection](map[string]interface{}{
		"workflow_id": workflow.Id,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to load workflow connections: %w", err)
	}

	graph, err := e.buildGraph(nodes, connections)
	if err != nil {
		return &ValidationResult{
			Valid:  false,
			Errors: []string{err.Error()},
		}, nil
	}

	validationResult := e.validateGraph(graph)

	for _, node := range graph.Nodes {
		if err := e.validateNodeConfig(node); err != nil {
			validationResult.Valid = false
			validationResult.Errors = append(validationResult.Errors, err.Error())
		}
	}

	return validationResult, nil
}

func (e *WorkflowEngine) SaveWorkflowGraph(workflowId string, nodes []*Node, edges []*Edge) (*ValidationResult, []*wfModels.WorkflowNode, []*wfModels.WorkflowConnection, error) {
	graph := &Graph{
		Nodes: make(map[string]*Node),
		Edges: make([]*Edge, 0, len(edges)),
	}

	for _, node := range nodes {
		graph.Nodes[node.ID] = node
	}

	for _, edge := range edges {
		graph.Edges = append(graph.Edges, edge)
		if sourceNode, exists := graph.Nodes[edge.Source]; exists {
			sourceNode.Outputs = append(sourceNode.Outputs, edge.Target)
		}
		if targetNode, exists := graph.Nodes[edge.Target]; exists {
			targetNode.Inputs = append(targetNode.Inputs, edge.Source)
		}
	}

	validationResult := e.validateGraph(graph)

	for _, node := range graph.Nodes {
		if err := e.validateNodeConfig(node); err != nil {
			validationResult.Valid = false
			validationResult.Errors = append(validationResult.Errors, err.Error())
		}
	}

	if !validationResult.Valid {
		return validationResult, nil, nil, nil
	}

	existingNodes, err := query.FindAllByFilter[*wfModels.WorkflowNode](map[string]interface{}{
		"workflow_id": workflowId,
	})
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to load existing nodes: %w", err)
	}

	existingConnections, err := query.FindAllByFilter[*wfModels.WorkflowConnection](map[string]interface{}{
		"workflow_id": workflowId,
	})
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to load existing connections: %w", err)
	}

	existingNodeMap := make(map[string]*wfModels.WorkflowNode)
	for _, node := range existingNodes {
		existingNodeMap[node.Id] = node
	}

	existingConnectionMap := make(map[string]*wfModels.WorkflowConnection)
	for _, conn := range existingConnections {
		existingConnectionMap[conn.Id] = conn
	}

	newNodeMap := make(map[string]*Node)
	for _, node := range nodes {
		newNodeMap[node.ID] = node
	}

	newConnectionMap := make(map[string]*Edge)
	for _, edge := range edges {
		newConnectionMap[edge.ID] = edge
	}

	for _, existingConn := range existingConnections {
		if _, exists := newConnectionMap[existingConn.Id]; !exists {
			if err := query.DeleteById[*wfModels.WorkflowConnection](existingConn.Id); err != nil {
				return nil, nil, nil, fmt.Errorf("failed to delete connection %s: %w", existingConn.Id, err)
			}
		}
	}

	for _, existingNode := range existingNodes {
		if _, exists := newNodeMap[existingNode.Id]; !exists {
			if err := query.DeleteById[*wfModels.WorkflowNode](existingNode.Id); err != nil {
				return nil, nil, nil, fmt.Errorf("failed to delete node %s: %w", existingNode.Id, err)
			}
		}
	}

	// Create a map from temporary node IDs to new backend IDs
	nodeIDMap := make(map[string]string)
	
	savedNodes := make([]*wfModels.WorkflowNode, 0, len(nodes))
	for _, node := range nodes {
		var workflowNode *wfModels.WorkflowNode
		if existingNode, exists := existingNodeMap[node.ID]; exists {
			configJSON, err := json.Marshal(node.Config)
			if err != nil {
				return nil, nil, nil, fmt.Errorf("failed to marshal config for node %s: %w", node.ID, err)
			}

			existingNode.Type = node.Type
			existingNode.NodeType = node.NodeType
			existingNode.Label = node.Name
			existingNode.Config = string(configJSON)
			existingNode.PositionX = int(node.Position.X)
			existingNode.PositionY = int(node.Position.Y)
			existingNode.MarkAsNotNew()

			if err := query.SaveRecord(existingNode); err != nil {
				return nil, nil, nil, fmt.Errorf("failed to update node %s: %w", node.ID, err)
			}
			workflowNode = existingNode
		} else {
			configJSON, err := json.Marshal(node.Config)
			if err != nil {
				return nil, nil, nil, fmt.Errorf("failed to marshal config for node %s: %w", node.ID, err)
			}

			newNode := &wfModels.WorkflowNode{
				WorkflowID: workflowId,
				Type:       node.Type,
				NodeType:   node.NodeType,
				Label:      node.Name,
				Config:     string(configJSON),
				PositionX:  int(node.Position.X),
				PositionY:  int(node.Position.Y),
			}

			// Only use the provided ID if it's a valid backend ID (not a temporary frontend ID)
			// Temporary IDs follow the pattern: node_<timestamp>_<random>
			isTemporaryID := node.ID != "" && len(node.ID) > 10 && node.ID[:5] == "node_"
			
			if node.ID != "" && !isTemporaryID {
				// Use provided ID only if it looks like a valid backend ID
				newNode.SetId(node.ID)
			} else {
				// Generate a new ID for new nodes or nodes with temporary IDs
				newNode.SetId(util.GenerateRandomId())
			}

			if err := query.SaveRecord(newNode); err != nil {
				return nil, nil, nil, fmt.Errorf("failed to create node %s: %w", node.ID, err)
			}
			workflowNode = newNode
			
			// Map temporary ID to new backend ID
			if isTemporaryID {
				nodeIDMap[node.ID] = workflowNode.Id
				logger.LogInfo("Mapped temporary node ID to backend ID", "tempId", node.ID, "backendId", workflowNode.Id)
			}
		}
		savedNodes = append(savedNodes, workflowNode)
	}

	savedConnections := make([]*wfModels.WorkflowConnection, 0, len(edges))
	for _, edge := range edges {
		if _, exists := existingConnectionMap[edge.ID]; exists {
			if err := query.DeleteById[*wfModels.WorkflowConnection](edge.ID); err != nil {
				return nil, nil, nil, fmt.Errorf("failed to delete existing connection %s: %w", edge.ID, err)
			}
		}

		// Map source and target IDs if they were temporary
		sourceID := edge.Source
		if mappedID, exists := nodeIDMap[edge.Source]; exists {
			sourceID = mappedID
		}
		
		targetID := edge.Target
		if mappedID, exists := nodeIDMap[edge.Target]; exists {
			targetID = mappedID
		}

		newConnection := &wfModels.WorkflowConnection{
			WorkflowID: workflowId,
			SourceID:   sourceID,
			TargetID:   targetID,
		}

		// Only use the provided ID if it's a valid backend ID (not a temporary frontend ID)
		// Temporary IDs follow the pattern: edge_<timestamp>_<random>
		isTemporaryID := edge.ID != "" && len(edge.ID) > 10 && edge.ID[:5] == "edge_"
		
		if edge.ID != "" && !isTemporaryID {
			// Use provided ID only if it looks like a valid backend ID
			newConnection.SetId(edge.ID)
		} else {
			// Generate a new ID for new connections or connections with temporary IDs
			newConnection.SetId(util.GenerateRandomId())
		}

		if err := query.SaveRecord(newConnection); err != nil {
			return nil, nil, nil, fmt.Errorf("failed to create connection %s: %w", edge.ID, err)
		}
		savedConnections = append(savedConnections, newConnection)
	}

	// Invalidate schema cache for this workflow since nodes/configs may have changed
	e.schemaCache.InvalidateWorkflow(workflowId)

	return validationResult, savedNodes, savedConnections, nil
}

// GetNodeOutputSchema returns the output schema for a specific node
// This is used for schema introspection at design time
// Now includes caching for performance
func (e *WorkflowEngine) GetNodeOutputSchema(workflowID string, nodeID string) (*types.DataSchema, error) {
	// Load workflow to verify it exists
	_, err := query.FindById[*wfModels.Workflow](workflowID)
	if err != nil {
		return nil, fmt.Errorf("workflow not found: %w", err)
	}

	// Load the specific node
	node, err := query.FindById[*wfModels.WorkflowNode](nodeID)
	if err != nil {
		return nil, fmt.Errorf("node not found: %w", err)
	}

	if node.WorkflowID != workflowID {
		return nil, fmt.Errorf("node does not belong to workflow")
	}

	// Parse node config
	var config map[string]interface{}
	if node.Config != "" {
		if err := json.Unmarshal([]byte(node.Config), &config); err != nil {
			return nil, fmt.Errorf("invalid node config: %w", err)
		}
	} else {
		config = make(map[string]interface{})
	}

	// Compute config hash for caching
	configHash := computeConfigHash(config)

	// Get input node hashes for cache validation
	var inputHashes []string
	if node.Type != "source" {
		// Load all nodes and connections to build the graph
		allNodes, err := query.FindAllByFilter[*wfModels.WorkflowNode](map[string]interface{}{
			"workflow_id": workflowID,
		})
		if err == nil {
			allConnections, err := query.FindAllByFilter[*wfModels.WorkflowConnection](map[string]interface{}{
				"workflow_id": workflowID,
			})
			if err == nil {
				graph, err := e.buildGraph(allNodes, allConnections)
				if err == nil {
					if graphNode, exists := graph.Nodes[nodeID]; exists && len(graphNode.Inputs) > 0 {
						// Compute hashes for all input nodes
						for _, inputNodeID := range graphNode.Inputs {
							if inputNode, err := query.FindById[*wfModels.WorkflowNode](inputNodeID); err == nil {
								var inputConfig map[string]interface{}
								if inputNode.Config != "" {
									json.Unmarshal([]byte(inputNode.Config), &inputConfig)
								}
								inputHashes = append(inputHashes, computeConfigHash(inputConfig))
							}
						}
					}
				}
			}
		}
	}

	// Check cache first
	if cachedSchema, found := e.schemaCache.Get(nodeID, configHash, inputHashes); found {
		return cachedSchema, nil
	}

	// Create connector instance
	connector, err := e.registry.Create(node.NodeType)
	if err != nil {
		return nil, fmt.Errorf("failed to create connector: %w", err)
	}

	// Configure connector
	if err := connector.Configure(config); err != nil {
		return nil, fmt.Errorf("failed to configure connector: %w", err)
	}

	// Get input schema if node has inputs
	var inputSchema *types.DataSchema
	if schemaAware, ok := connector.(types.SchemaAwareConnector); ok {
		// For source nodes, inputSchema is nil
		// For processor/destination nodes, compute input schema from upstream nodes
		if node.Type != "source" {
			// Load all nodes and connections to build the graph
			allNodes, err := query.FindAllByFilter[*wfModels.WorkflowNode](map[string]interface{}{
				"workflow_id": workflowID,
			})
			if err == nil {
				allConnections, err := query.FindAllByFilter[*wfModels.WorkflowConnection](map[string]interface{}{
					"workflow_id": workflowID,
				})
				if err == nil {
					graph, err := e.buildGraph(allNodes, allConnections)
					if err == nil {
						if graphNode, exists := graph.Nodes[nodeID]; exists && len(graphNode.Inputs) > 0 {
							// Build node labels for conflict resolution
							nodeLabels := make(map[string]string)
							for nodeID, node := range graph.Nodes {
								nodeLabels[nodeID] = node.Name
							}
							
							// Compute input schemas from all upstream nodes
							inputSchemas := make([]types.DataSchema, 0, len(graphNode.Inputs))
							for _, inputNodeID := range graphNode.Inputs {
								if upstreamSchema, err := e.GetNodeOutputSchema(workflowID, inputNodeID); err == nil {
									inputSchemas = append(inputSchemas, *upstreamSchema)
								}
							}
							
							// Merge input schemas if multiple inputs
							if len(inputSchemas) > 0 {
								if len(inputSchemas) == 1 {
									inputSchema = &inputSchemas[0]
								} else {
									merged := mergeSchemas(inputSchemas, nodeLabels)
									inputSchema = &merged
								}
							}
						}
					}
				}
			}
		}
		
		outputSchema, err := schemaAware.GetOutputSchema(inputSchema)
		if err != nil {
			return nil, fmt.Errorf("failed to get output schema: %w", err)
		}
		
		// Cache the result
		e.schemaCache.Set(nodeID, outputSchema, configHash, inputHashes)
		
		return outputSchema, nil
	}

	// Connector doesn't implement SchemaAwareConnector
	// Return empty schema
	emptySchema := &types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: make([]string, 0),
	}
	
	// Cache empty schema too
	e.schemaCache.Set(nodeID, emptySchema, configHash, inputHashes)
	
	return emptySchema, nil
}

// GetNodeSampleData executes a node in preview mode and returns sample data
// This is used for UI preview without persisting execution
func (e *WorkflowEngine) GetNodeSampleData(workflowID string, nodeID string, limit int) (map[string]interface{}, error) {
	return e.getNodeSampleDataRecursive(workflowID, nodeID, limit, make(map[string]bool))
}

// getNodeSampleDataRecursive is the internal recursive implementation with cycle detection
func (e *WorkflowEngine) getNodeSampleDataRecursive(workflowID string, nodeID string, limit int, visited map[string]bool) (map[string]interface{}, error) {
	// Prevent infinite recursion
	if visited[nodeID] {
		return nil, fmt.Errorf("circular dependency detected at node %s", nodeID)
	}
	visited[nodeID] = true
	defer delete(visited, nodeID)

	if limit <= 0 {
		limit = 20 // Default limit
	}
	if limit > 100 {
		limit = 100 // Max limit for safety
	}

	// Load workflow to verify it exists
	workflow, err := query.FindById[*wfModels.Workflow](workflowID)
	if err != nil {
		return nil, fmt.Errorf("workflow not found: %w", err)
	}

	// Load nodes and connections
	nodes, err := query.FindAllByFilter[*wfModels.WorkflowNode](map[string]interface{}{
		"workflow_id": workflowID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to load workflow nodes: %w", err)
	}

	connections, err := query.FindAllByFilter[*wfModels.WorkflowConnection](map[string]interface{}{
		"workflow_id": workflowID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to load workflow connections: %w", err)
	}

	// Build graph
	graph, err := e.buildGraph(nodes, connections)
	if err != nil {
		return nil, fmt.Errorf("failed to build graph: %w", err)
	}

	// Find the target node
	targetNode, exists := graph.Nodes[nodeID]
	if !exists {
		return nil, fmt.Errorf("node not found: %s", nodeID)
	}

	// Create a context for preview execution
	ctx := context.Background()
	ctx = util.WithUserID(ctx, workflow.User)

	// Execute upstream nodes to get input data
	nodeResults := make(map[string]interface{})

	// If node has inputs, execute upstream nodes
	if len(targetNode.Inputs) > 0 {
		for _, inputNodeID := range targetNode.Inputs {
			if _, exists := graph.Nodes[inputNodeID]; !exists {
				continue
			}

			// Recursively get sample data from upstream nodes
			upstreamSample, err := e.getNodeSampleDataRecursive(workflowID, inputNodeID, limit, visited)
			if err != nil {
				// If upstream fails, continue with empty data
				continue
			}

			// Extract envelope from upstream
			envelope := types.FromMap(upstreamSample)
			// Limit the data to requested limit
			if len(envelope.Data) > limit {
				envelope.Data = envelope.Data[:limit]
				envelope.Metadata.RecordCount = limit
			}
			nodeResults[inputNodeID] = envelope.ToMap()
		}
	}

	// Aggregate inputs if multiple
	var input map[string]interface{}
	if len(targetNode.Inputs) > 0 {
		nodeLabels := make(map[string]string)
		for nodeID, node := range graph.Nodes {
			nodeLabels[nodeID] = node.Name
		}
		var err error
		input, err = aggregateNodeInputs(nodeResults, targetNode.Inputs, nodeLabels)
		if err != nil {
			return nil, fmt.Errorf("failed to aggregate inputs: %w", err)
		}
	}

	// Parse node config
	var config map[string]interface{}
	if targetNode.Config != nil {
		config = targetNode.Config
	} else {
		config = make(map[string]interface{})
	}

	// Create and configure connector
	connector, err := e.registry.Create(targetNode.NodeType)
	if err != nil {
		return nil, fmt.Errorf("failed to create connector: %w", err)
	}

	if err := connector.Configure(config); err != nil {
		return nil, fmt.Errorf("failed to configure connector: %w", err)
	}

	// Execute connector with limited context (no execution state)
	startTime := time.Now()
	result, err := connector.Execute(ctx, input)
	duration := time.Since(startTime)

	if err != nil {
		return nil, fmt.Errorf("connector execution failed: %w", err)
	}

	// Ensure result is in envelope format
	resultEnvelope := types.FromMap(result)
	resultEnvelope.Metadata.NodeID = targetNode.ID
	resultEnvelope.Metadata.NodeType = targetNode.NodeType
	resultEnvelope.Metadata.ExecutionTimeMs = duration.Milliseconds()

	// Limit the data to requested limit
	if len(resultEnvelope.Data) > limit {
		resultEnvelope.Data = resultEnvelope.Data[:limit]
		resultEnvelope.Metadata.RecordCount = limit
	}

	// If schema is empty, try to infer from data
	if len(resultEnvelope.Metadata.Schema.Fields) == 0 && len(resultEnvelope.Data) > 0 {
		resultEnvelope.Metadata.Schema = inferSchemaFromData(resultEnvelope.Data)
	}

	return resultEnvelope.ToMap(), nil
}

// GetWorkflowSchema returns the complete schema flow for a workflow
// This shows how data flows through the workflow with schemas at each node
func (e *WorkflowEngine) GetWorkflowSchema(workflowID string) (map[string]interface{}, error) {
	workflow, err := query.FindById[*wfModels.Workflow](workflowID)
	if err != nil {
		return nil, fmt.Errorf("workflow not found: %w", err)
	}

	nodes, err := query.FindAllByFilter[*wfModels.WorkflowNode](map[string]interface{}{
		"workflow_id": workflow.Id,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to load workflow nodes: %w", err)
	}

	connections, err := query.FindAllByFilter[*wfModels.WorkflowConnection](map[string]interface{}{
		"workflow_id": workflow.Id,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to load workflow connections: %w", err)
	}

	graph, err := e.buildGraph(nodes, connections)
	if err != nil {
		return nil, fmt.Errorf("failed to build graph: %w", err)
	}

	// Build schema map for each node
	nodeSchemas := make(map[string]interface{})
	for nodeID, node := range graph.Nodes {
		schema, err := e.GetNodeOutputSchema(workflowID, nodeID)
		if err != nil {
			// Log error but continue
			logger.LogError("Failed to get schema for node", "error", err, "node_id", nodeID)
			nodeSchemas[nodeID] = map[string]interface{}{
				"error": err.Error(),
			}
			continue
		}

		nodeSchemas[nodeID] = map[string]interface{}{
			"node_id":      nodeID,
			"node_name":    node.Name,
			"node_type":    node.NodeType,
			"output_schema": schema,
		}
	}

	return map[string]interface{}{
		"workflow_id":  workflowID,
		"node_schemas": nodeSchemas,
	}, nil
}

// RegisterConnectors registers all available connectors with the registry
// This is exported for use by the application to get available connectors
func RegisterConnectors(registry types.ConnectorRegistry) {
	// Register built-in connectors from the workflow package
	registry.Register("file_source", NewFileSourceConnector)
	// transform_processor is now registered in connectors package
	registry.Register("log_destination", NewLogDestinationConnector)

	// Register connectors from the connectors package
	connectors.RegisterAllConnectors(registry)
}

package workflow

import "fmt"

type ValidationResult struct {
	Valid    bool
	Errors   []string
	Warnings []string
}

func (e *WorkflowEngine) validateGraph(graph *Graph) *ValidationResult {
	result := &ValidationResult{
		Valid:    true,
		Errors:   make([]string, 0),
		Warnings: make([]string, 0),
	}

	if len(graph.Nodes) == 0 {
		result.Valid = false
		result.Errors = append(result.Errors, "workflow has no nodes")
		return result
	}

	hasSource := false
	hasDestination := false
	disconnectedNodes := make(map[string]bool)

	for id := range graph.Nodes {
		disconnectedNodes[id] = true
	}

	for _, edge := range graph.Edges {
		disconnectedNodes[edge.Source] = false
		disconnectedNodes[edge.Target] = false
	}

	for id, node := range graph.Nodes {
		if node.Type == "source" {
			hasSource = true
		}
		if node.Type == "destination" {
			hasDestination = true
		}

		if disconnectedNodes[id] && len(node.Inputs) == 0 && len(node.Outputs) == 0 {
			result.Warnings = append(result.Warnings, fmt.Sprintf("node %s is disconnected", id))
		}

		if node.NodeType == "" {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("node %s has no connector type", id))
		} else {
			connector := e.registry.Get(node.NodeType)
			if connector == nil {
				result.Valid = false
				result.Errors = append(result.Errors, fmt.Sprintf("node %s uses unknown connector type: %s", id, node.NodeType))
			} else {
				expectedType := string(connector.Type())
				if node.Type != expectedType && !(node.Type == "processor" && expectedType == "processor") {
					result.Valid = false
					result.Errors = append(result.Errors, fmt.Sprintf("node %s type mismatch: expected %s, got %s", id, expectedType, node.Type))
				}
			}
		}
	}

	if !hasSource {
		result.Valid = false
		result.Errors = append(result.Errors, "workflow must have at least one source node")
	}

	if !hasDestination {
		result.Valid = false
		result.Errors = append(result.Errors, "workflow must have at least one destination node")
	}

	if e.hasCircularDependency(graph) {
		result.Valid = false
		result.Errors = append(result.Errors, "workflow contains circular dependencies")
	}

	reachableNodes := e.findReachableNodes(graph)
	if len(reachableNodes) < len(graph.Nodes) {
		for id := range graph.Nodes {
			if !reachableNodes[id] {
				result.Warnings = append(result.Warnings, fmt.Sprintf("node %s is not reachable from any source node", id))
			}
		}
	}

	return result
}

func (e *WorkflowEngine) hasCircularDependency(graph *Graph) bool {
	visited := make(map[string]bool)
	recStack := make(map[string]bool)

	for id := range graph.Nodes {
		if !visited[id] {
			if e.detectCycle(graph, id, visited, recStack) {
				return true
			}
		}
	}

	return false
}

func (e *WorkflowEngine) detectCycle(graph *Graph, nodeID string, visited, recStack map[string]bool) bool {
	visited[nodeID] = true
	recStack[nodeID] = true

	node := graph.Nodes[nodeID]
	for _, targetID := range node.Outputs {
		if !visited[targetID] {
			if e.detectCycle(graph, targetID, visited, recStack) {
				return true
			}
		} else if recStack[targetID] {
			return true
		}
	}

	recStack[nodeID] = false
	return false
}

func (e *WorkflowEngine) findReachableNodes(graph *Graph) map[string]bool {
	reachable := make(map[string]bool)

	var dfs func(nodeID string)
	dfs = func(nodeID string) {
		if reachable[nodeID] {
			return
		}
		reachable[nodeID] = true
		node := graph.Nodes[nodeID]
		for _, targetID := range node.Outputs {
			dfs(targetID)
		}
	}

	for id, node := range graph.Nodes {
		if node.Type == "source" && len(node.Inputs) == 0 {
			dfs(id)
		}
	}

	return reachable
}

func (e *WorkflowEngine) validateNodeConfig(node *Node) error {
	if node.NodeType == "" {
		return NewValidationError("node type is empty", node.ID)
	}

	connector := e.registry.Get(node.NodeType)
	if connector == nil {
		return NewValidationError(fmt.Sprintf("unknown connector type: %s", node.NodeType), node.ID)
	}

	schema := connector.GetConfigSchema()
	if schema == nil {
		return nil
	}

	required, ok := schema["required"].([]interface{})
	if !ok {
		return nil
	}

	for _, reqField := range required {
		fieldName, ok := reqField.(string)
		if !ok {
			continue
		}
		if _, exists := node.Config[fieldName]; !exists {
			return NewValidationError(fmt.Sprintf("required configuration field missing: %s", fieldName), node.ID)
		}
	}

	return nil
}

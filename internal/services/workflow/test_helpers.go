package workflow

import (
	"context"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

type MockConnector struct {
	types.BaseConnector
	OutputSchema      *types.DataSchema
	OutputData        []map[string]interface{}
	ExecuteFunc       func(ctx context.Context, input map[string]interface{}) (map[string]interface{}, error)
	ValidateInputFunc func(schema *types.DataSchema) error
}

func NewMockConnector(id string, connType types.ConnectorType) *MockConnector {
	return &MockConnector{
		BaseConnector: types.BaseConnector{
			ConnID:       id,
			ConnName:     "Mock " + id,
			ConnType:     connType,
			ConfigSchema: make(map[string]interface{}),
			Config:       make(map[string]interface{}),
		},
		OutputData: make([]map[string]interface{}, 0),
	}
}

func (m *MockConnector) Execute(ctx context.Context, input map[string]interface{}) (map[string]interface{}, error) {
	if m.ExecuteFunc != nil {
		return m.ExecuteFunc(ctx, input)
	}

	nodeID := m.ID()
	schema := m.OutputSchema
	if schema == nil {
		schema = &types.DataSchema{
			Fields:      make([]types.FieldDefinition, 0),
			SourceNodes: []string{nodeID},
		}
	}

	envelope := &types.DataEnvelope{
		Data: m.OutputData,
		Metadata: types.Metadata{
			NodeID:      nodeID,
			NodeType:    m.ConnID,
			RecordCount: len(m.OutputData),
			Schema:      *schema,
			Sources:     []string{nodeID},
		},
	}

	return envelope.ToMap(), nil
}

func (m *MockConnector) GetOutputSchema(inputSchema *types.DataSchema) (*types.DataSchema, error) {
	if m.OutputSchema != nil {
		return m.OutputSchema, nil
	}
	return &types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: make([]string, 0),
	}, nil
}

func (m *MockConnector) ValidateInputSchema(schema *types.DataSchema) error {
	if m.ValidateInputFunc != nil {
		return m.ValidateInputFunc(schema)
	}
	return nil
}

func (m *MockConnector) WithOutputSchema(schema *types.DataSchema) *MockConnector {
	m.OutputSchema = schema
	return m
}

func (m *MockConnector) WithOutputData(data []map[string]interface{}) *MockConnector {
	m.OutputData = data
	return m
}

type MockRegistry struct {
	connectors map[string]func() types.Connector
}

func NewMockRegistry() *MockRegistry {
	return &MockRegistry{
		connectors: make(map[string]func() types.Connector),
	}
}

func (r *MockRegistry) Register(id string, factory func() types.Connector) error {
	r.connectors[id] = factory
	return nil
}

func (r *MockRegistry) Get(id string) (types.Connector, error) {
	factory, exists := r.connectors[id]
	if !exists {
		return nil, NewConfigurationError("connector not found", "", id)
	}
	return factory(), nil
}

func (r *MockRegistry) List() []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(r.connectors))
	for id, factory := range r.connectors {
		conn := factory()
		result = append(result, map[string]interface{}{
			"id":            id,
			"name":          conn.Name(),
			"type":          conn.Type(),
			"config_schema": conn.GetConfigSchema(),
		})
	}
	return result
}

func CreateTestWorkflow(nodes []*Node, edges []*Edge) *Graph {
	nodeMap := make(map[string]*Node)

	for _, node := range nodes {
		nodeMap[node.ID] = node
	}

	return &Graph{
		Nodes: nodeMap,
		Edges: edges,
	}
}

func findSourceNodes(nodes map[string]*Node, edges []*Edge) []*Node {
	hasIncoming := make(map[string]bool)
	for _, edge := range edges {
		hasIncoming[edge.Target] = true
	}
	
	sources := make([]*Node, 0)
	for _, node := range nodes {
		if !hasIncoming[node.ID] {
			sources = append(sources, node)
		}
	}
	return sources
}

func findDestinationNodes(nodes map[string]*Node, edges []*Edge) []*Node {
	hasOutgoing := make(map[string]bool)
	for _, edge := range edges {
		hasOutgoing[edge.Source] = true
	}
	
	destinations := make([]*Node, 0)
	for _, node := range nodes {
		if !hasOutgoing[node.ID] {
			destinations = append(destinations, node)
		}
	}
	return destinations
}

func CreateTestSchema(fields []types.FieldDefinition, sourceNodes []string) types.DataSchema {
	return types.DataSchema{
		Fields:      fields,
		SourceNodes: sourceNodes,
	}
}

func CreateTestField(name string, fieldType string, sourceNode string) types.FieldDefinition {
	return types.FieldDefinition{
		Name:       name,
		Type:       fieldType,
		SourceNode: sourceNode,
		Nullable:   true,
	}
}

func CreateTestEnvelope(nodeID string, data []map[string]interface{}, schema types.DataSchema) *types.DataEnvelope {
	return &types.DataEnvelope{
		Data: data,
		Metadata: types.Metadata{
			NodeID:      nodeID,
			RecordCount: len(data),
			Schema:      schema,
			Sources:     schema.SourceNodes,
		},
	}
}

func AssertSchemaEqual(expected, actual types.DataSchema) bool {
	if len(expected.Fields) != len(actual.Fields) {
		return false
	}

	if len(expected.SourceNodes) != len(actual.SourceNodes) {
		return false
	}

	fieldMap := make(map[string]types.FieldDefinition)
	for _, field := range actual.Fields {
		fieldMap[field.Name] = field
	}

	for _, expectedField := range expected.Fields {
		actualField, exists := fieldMap[expectedField.Name]
		if !exists {
			return false
		}
		if actualField.Type != expectedField.Type {
			return false
		}
		if actualField.SourceNode != expectedField.SourceNode {
			return false
		}
	}

	return true
}

func CreateTestNode(id string, connectorID string, connectorType types.ConnectorType, config map[string]interface{}) *Node {
	if config == nil {
		config = make(map[string]interface{})
	}
	return &Node{
		ID:       id,
		Name:     id,
		Type:     string(connectorType),
		NodeType: connectorID,
		Config:   config,
		Position: struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
		}{X: 0, Y: 0},
	}
}

func CreateTestEdge(id string, sourceID string, targetID string) *Edge {
	return &Edge{
		ID:     id,
		Source: sourceID,
		Target: targetID,
	}
}


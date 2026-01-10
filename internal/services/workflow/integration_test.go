package workflow

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

func TestMultiSourceSchemaMerging(t *testing.T) {
	logger.Info.Println("=== TestMultiSourceSchemaMerging ===")
	
	registry := NewConnectorRegistryImpl()
	RegisterConnectors(registry)
	
	engine := &WorkflowEngine{
		registry: registry,
	}

	usersSchema := types.DataSchema{
		Fields: []types.FieldDefinition{
			{Name: "id", Type: "string", SourceNode: "users_source", Nullable: false},
			{Name: "name", Type: "string", SourceNode: "users_source", Nullable: false},
			{Name: "email", Type: "string", SourceNode: "users_source", Nullable: false},
		},
		SourceNodes: []string{"users_source"},
	}

	tasksSchema := types.DataSchema{
		Fields: []types.FieldDefinition{
			{Name: "id", Type: "string", SourceNode: "tasks_source", Nullable: false},
			{Name: "title", Type: "string", SourceNode: "tasks_source", Nullable: false},
			{Name: "user_id", Type: "string", SourceNode: "tasks_source", Nullable: false},
		},
		SourceNodes: []string{"tasks_source"},
	}

	usersEnvelope := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"id": "u1", "name": "Alice", "email": "alice@example.com"},
			{"id": "u2", "name": "Bob", "email": "bob@example.com"},
		},
		Metadata: types.Metadata{
			NodeID:      "users_source",
			NodeType:    "pocketbase_source",
			Schema:      usersSchema,
			RecordCount: 2,
			Sources:     []string{"users_source"},
		},
	}

	tasksEnvelope := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"id": "t1", "title": "Task 1", "user_id": "u1"},
			{"id": "t2", "title": "Task 2", "user_id": "u2"},
		},
		Metadata: types.Metadata{
			NodeID:      "tasks_source",
			NodeType:    "pocketbase_source",
			Schema:      tasksSchema,
			RecordCount: 2,
			Sources:     []string{"tasks_source"},
		},
	}

	nodeResults := map[string]interface{}{
		"users_source": usersEnvelope.ToMap(),
		"tasks_source": tasksEnvelope.ToMap(),
	}

	nodeLabels := map[string]string{
		"users_source": "Users",
		"tasks_source": "Tasks",
	}

	logger.Info.Println("=== Before aggregateNodeInputs ===")
	logger.Info.Printf("Users schema fields: %d", len(usersSchema.Fields))
	logger.Info.Printf("Tasks schema fields: %d", len(tasksSchema.Fields))
	
	inputNodeIDs := []string{"users_source", "tasks_source"}
	mergedInput, err := aggregateNodeInputs(nodeResults, inputNodeIDs, nodeLabels)
	if err != nil {
		t.Fatalf("aggregateNodeInputs failed: %v", err)
	}

	logger.Info.Println("=== After aggregateNodeInputs ===")
	
	mergedEnvelope := types.FromMap(mergedInput)
	
	logger.Info.Printf("Merged data records: %d", len(mergedEnvelope.Data))
	logger.Info.Printf("Merged schema fields: %d", len(mergedEnvelope.Metadata.Schema.Fields))
	logger.Info.Printf("Merged source nodes: %v", mergedEnvelope.Metadata.Schema.SourceNodes)

	if len(mergedEnvelope.Data) != 4 {
		t.Errorf("Expected 4 merged records, got %d", len(mergedEnvelope.Data))
	}

	expectedFieldCount := 6
	if len(mergedEnvelope.Metadata.Schema.Fields) != expectedFieldCount {
		t.Errorf("Expected %d fields in merged schema, got %d", expectedFieldCount, len(mergedEnvelope.Metadata.Schema.Fields))
		for i, field := range mergedEnvelope.Metadata.Schema.Fields {
			logger.Info.Printf("  Field %d: %s (type: %s, source: %s)", i, field.Name, field.Type, field.SourceNode)
		}
	}

	fieldNames := make(map[string]bool)
	for _, field := range mergedEnvelope.Metadata.Schema.Fields {
		fieldNames[field.Name] = true
		if field.SourceNode == "" {
			t.Errorf("Field %s has no source_node", field.Name)
		}
	}

	expectedFields := []string{"Users_id", "name", "email", "Tasks_id", "title", "user_id"}
	for _, expectedField := range expectedFields {
		if !fieldNames[expectedField] {
			t.Errorf("Expected field %s not found in merged schema", expectedField)
			logger.Info.Println("Available fields:")
			for fname := range fieldNames {
				logger.Info.Printf("  - %s", fname)
			}
		}
	}

	logger.Info.Println("=== Test Complete ===")
}

func TestSingleSourcePassthrough(t *testing.T) {
	registry := NewConnectorRegistryImpl()
	RegisterConnectors(registry)

	usersSchema := types.DataSchema{
		Fields: []types.FieldDefinition{
			{Name: "id", Type: "string", SourceNode: "users_source", Nullable: false},
			{Name: "name", Type: "string", SourceNode: "users_source", Nullable: false},
		},
		SourceNodes: []string{"users_source"},
	}

	usersEnvelope := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"id": "u1", "name": "Alice"},
		},
		Metadata: types.Metadata{
			NodeID:      "users_source",
			Schema:      usersSchema,
			RecordCount: 1,
			Sources:     []string{"users_source"},
		},
	}

	nodeResults := map[string]interface{}{
		"users_source": usersEnvelope.ToMap(),
	}

	nodeLabels := map[string]string{
		"users_source": "Users",
	}

	inputNodeIDs := []string{"users_source"}
	mergedInput, err := aggregateNodeInputs(nodeResults, inputNodeIDs, nodeLabels)
	if err != nil {
		t.Fatalf("aggregateNodeInputs failed: %v", err)
	}

	mergedEnvelope := types.FromMap(mergedInput)

	if len(mergedEnvelope.Metadata.Schema.Fields) != 2 {
		t.Errorf("Expected 2 fields for single source, got %d", len(mergedEnvelope.Metadata.Schema.Fields))
	}

	for _, field := range mergedEnvelope.Metadata.Schema.Fields {
		if field.SourceNode == "" {
			t.Errorf("Field %s has no source_node", field.Name)
		}
	}
}

func TestSchemaConflictResolution(t *testing.T) {
	source1Schema := types.DataSchema{
		Fields: []types.FieldDefinition{
			{Name: "id", Type: "string", SourceNode: "source1", Nullable: false},
			{Name: "value", Type: "number", SourceNode: "source1", Nullable: false},
		},
		SourceNodes: []string{"source1"},
	}

	source2Schema := types.DataSchema{
		Fields: []types.FieldDefinition{
			{Name: "id", Type: "string", SourceNode: "source2", Nullable: false},
			{Name: "description", Type: "string", SourceNode: "source2", Nullable: false},
		},
		SourceNodes: []string{"source2"},
	}

	envelope1 := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"id": "1", "value": 100},
		},
		Metadata: types.Metadata{
			NodeID:  "source1",
			Schema:  source1Schema,
			Sources: []string{"source1"},
		},
	}

	envelope2 := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"id": "2", "description": "Item 2"},
		},
		Metadata: types.Metadata{
			NodeID:  "source2",
			Schema:  source2Schema,
			Sources: []string{"source2"},
		},
	}

	nodeResults := map[string]interface{}{
		"source1": envelope1.ToMap(),
		"source2": envelope2.ToMap(),
	}

	nodeLabels := map[string]string{
		"source1": "Source1",
		"source2": "Source2",
	}

	inputNodeIDs := []string{"source1", "source2"}
	mergedInput, err := aggregateNodeInputs(nodeResults, inputNodeIDs, nodeLabels)
	if err != nil {
		t.Fatalf("aggregateNodeInputs failed: %v", err)
	}

	mergedEnvelope := types.FromMap(mergedInput)

	fieldNames := make(map[string]bool)
	for _, field := range mergedEnvelope.Metadata.Schema.Fields {
		fieldNames[field.Name] = true
	}

	if !fieldNames["Source1_id"] || !fieldNames["Source2_id"] {
		t.Errorf("Conflicting 'id' fields not prefixed properly")
		logger.Info.Println("Merged fields:")
		for fname := range fieldNames {
			logger.Info.Printf("  - %s", fname)
		}
	}

	if !fieldNames["value"] {
		t.Errorf("Unique field 'value' should be preserved")
	}

	if !fieldNames["description"] {
		t.Errorf("Unique field 'description' should be preserved")
	}
}

func TestMergeEnvelopesLogic(t *testing.T) {
	envelope1 := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"id": "1", "name": "Alice"},
		},
		Metadata: types.Metadata{
			NodeID: "node1",
			Schema: types.DataSchema{
				Fields: []types.FieldDefinition{
					{Name: "id", Type: "string", SourceNode: "node1"},
					{Name: "name", Type: "string", SourceNode: "node1"},
				},
				SourceNodes: []string{"node1"},
			},
			Sources: []string{"node1"},
		},
	}

	envelope2 := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"id": "2", "title": "Task"},
		},
		Metadata: types.Metadata{
			NodeID: "node2",
			Schema: types.DataSchema{
				Fields: []types.FieldDefinition{
					{Name: "id", Type: "string", SourceNode: "node2"},
					{Name: "title", Type: "string", SourceNode: "node2"},
				},
				SourceNodes: []string{"node2"},
			},
			Sources: []string{"node2"},
		},
	}

	nodeLabels := map[string]string{
		"node1": "Node1",
		"node2": "Node2",
	}

	merged := mergeEnvelopes([]*types.DataEnvelope{envelope1, envelope2}, nodeLabels)

	if len(merged.Data) != 2 {
		t.Errorf("Expected 2 data records, got %d", len(merged.Data))
	}

	if len(merged.Metadata.Schema.Fields) != 4 {
		t.Errorf("Expected 4 fields (2 prefixed id + name + title), got %d", len(merged.Metadata.Schema.Fields))
		for i, field := range merged.Metadata.Schema.Fields {
			t.Logf("Field %d: %s (source: %s)", i, field.Name, field.SourceNode)
		}
	}

	fieldMap := make(map[string]types.FieldDefinition)
	for _, field := range merged.Metadata.Schema.Fields {
		fieldMap[field.Name] = field
	}

	if _, exists := fieldMap["Node1_id"]; !exists {
		t.Error("Expected Node1_id field for conflict resolution")
	}

	if _, exists := fieldMap["Node2_id"]; !exists {
		t.Error("Expected Node2_id field for conflict resolution")
	}

	if _, exists := fieldMap["name"]; !exists {
		t.Error("Expected name field (no conflict)")
	}

	if _, exists := fieldMap["title"]; !exists {
		t.Error("Expected title field (no conflict)")
	}
}

func TestEndToEndMultiSourceWorkflow(t *testing.T) {
	logger.Info.Println("=== TestEndToEndMultiSourceWorkflow ===")
	
	registry := NewMockRegistry()
	
	usersData := []map[string]interface{}{
		{"id": "u1", "name": "Alice", "email": "alice@example.com"},
		{"id": "u2", "name": "Bob", "email": "bob@example.com"},
	}
	usersSchema := CreateTestSchema([]types.FieldDefinition{
		CreateTestField("id", "string", "users_source"),
		CreateTestField("name", "string", "users_source"),
		CreateTestField("email", "string", "users_source"),
	}, []string{"users_source"})
	
	usersConnector := NewMockConnector("users_source", types.SourceConnector).
		WithOutputSchema(&usersSchema).
		WithOutputData(usersData)
	
	tasksData := []map[string]interface{}{
		{"id": "t1", "title": "Task 1", "user_id": "u1"},
		{"id": "t2", "title": "Task 2", "user_id": "u2"},
	}
	tasksSchema := CreateTestSchema([]types.FieldDefinition{
		CreateTestField("id", "string", "tasks_source"),
		CreateTestField("title", "string", "tasks_source"),
		CreateTestField("user_id", "string", "tasks_source"),
	}, []string{"tasks_source"})
	
	tasksConnector := NewMockConnector("tasks_source", types.SourceConnector).
		WithOutputSchema(&tasksSchema).
		WithOutputData(tasksData)
	
	registry.Register("users_mock", func() types.Connector { return usersConnector })
	registry.Register("tasks_mock", func() types.Connector { return tasksConnector })
	
	nodes := []*Node{
		CreateTestNode("users_source", "users_mock", types.SourceConnector, nil),
		CreateTestNode("tasks_source", "tasks_mock", types.SourceConnector, nil),
	}
	
	edges := []*Edge{}
	
	graph := CreateTestWorkflow(nodes, edges)
	
	ctx := context.Background()
	
	usersResult, err := usersConnector.Execute(ctx, make(map[string]interface{}))
	if err != nil {
		t.Fatalf("Users connector failed: %v", err)
	}
	
	tasksResult, err := tasksConnector.Execute(ctx, make(map[string]interface{}))
	if err != nil {
		t.Fatalf("Tasks connector failed: %v", err)
	}
	
	nodeResults := map[string]interface{}{
		"users_source": usersResult,
		"tasks_source": tasksResult,
	}
	
	nodeLabels := map[string]string{
		"users_source": "Users",
		"tasks_source": "Tasks",
	}
	
	mergedInput, err := aggregateNodeInputs(nodeResults, []string{"users_source", "tasks_source"}, nodeLabels)
	if err != nil {
		t.Fatalf("Failed to aggregate inputs: %v", err)
	}
	
	mergedEnvelope := types.FromMap(mergedInput)
	
	if len(mergedEnvelope.Data) != 4 {
		t.Errorf("Expected 4 records in merged output, got %d", len(mergedEnvelope.Data))
	}
	
	if len(mergedEnvelope.Metadata.Schema.Fields) != 6 {
		t.Errorf("Expected 6 fields (with prefixed IDs), got %d", len(mergedEnvelope.Metadata.Schema.Fields))
	}
	
	fieldNames := make(map[string]bool)
	for _, field := range mergedEnvelope.Metadata.Schema.Fields {
		fieldNames[field.Name] = true
	}
	
	requiredFields := []string{"Users_id", "name", "email", "Tasks_id", "title", "user_id"}
	for _, field := range requiredFields {
		if !fieldNames[field] {
			t.Errorf("Required field '%s' not found in merged schema", field)
		}
	}
	
	logger.Info.Printf("✓ End-to-end test passed: %d nodes, %d records, %d fields", 
		len(graph.Nodes), len(mergedEnvelope.Data), len(mergedEnvelope.Metadata.Schema.Fields))
}

func printSchema(schema types.DataSchema) {
	logger.Info.Printf("Schema: %d fields, %d source nodes", len(schema.Fields), len(schema.SourceNodes))
	for i, field := range schema.Fields {
		logger.Info.Printf("  [%d] %s (type: %s, source: %s, nullable: %v)",
			i, field.Name, field.Type, field.SourceNode, field.Nullable)
	}
	logger.Info.Printf("  Source nodes: %v", schema.SourceNodes)
}

func printEnvelope(name string, envelope *types.DataEnvelope) {
	logger.Info.Printf("=== %s ===", name)
	logger.Info.Printf("Records: %d", len(envelope.Data))
	if len(envelope.Data) > 0 {
		dataJSON, _ := json.MarshalIndent(envelope.Data[0], "  ", "  ")
		logger.Info.Printf("Sample record: %s", string(dataJSON))
	}
	printSchema(envelope.Metadata.Schema)
}


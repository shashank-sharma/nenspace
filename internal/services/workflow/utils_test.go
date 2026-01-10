package workflow

import (
	"testing"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

func TestMergeSchemas(t *testing.T) {
	schema1 := types.DataSchema{
		Fields: []types.FieldDefinition{
			{Name: "field1", Type: "string", SourceNode: "node1"},
			{Name: "field2", Type: "number", SourceNode: "node1"},
		},
		SourceNodes: []string{"node1"},
	}
	
	schema2 := types.DataSchema{
		Fields: []types.FieldDefinition{
			{Name: "field3", Type: "boolean", SourceNode: "node2"},
			{Name: "field4", Type: "string", SourceNode: "node2"},
		},
		SourceNodes: []string{"node2"},
	}
	
	nodeLabels := map[string]string{
		"node1": "Source1",
		"node2": "Source2",
	}
	
	merged := mergeSchemas([]types.DataSchema{schema1, schema2}, nodeLabels)
	
	if len(merged.Fields) != 4 {
		t.Errorf("Expected 4 fields, got %d", len(merged.Fields))
	}
	
	if len(merged.SourceNodes) != 2 {
		t.Errorf("Expected 2 source nodes, got %d", len(merged.SourceNodes))
	}
}

func TestMergeSchemas_ConflictResolution(t *testing.T) {
	schema1 := types.DataSchema{
		Fields: []types.FieldDefinition{
			{Name: "id", Type: "string", SourceNode: "node1"},
			{Name: "name", Type: "string", SourceNode: "node1"},
		},
		SourceNodes: []string{"node1"},
	}
	
	schema2 := types.DataSchema{
		Fields: []types.FieldDefinition{
			{Name: "id", Type: "number", SourceNode: "node2"},
			{Name: "email", Type: "string", SourceNode: "node2"},
		},
		SourceNodes: []string{"node2"},
	}
	
	nodeLabels := map[string]string{
		"node1": "Users",
		"node2": "Customers",
	}
	
	merged := mergeSchemas([]types.DataSchema{schema1, schema2}, nodeLabels)
	
	idFields := 0
	for _, field := range merged.Fields {
		if field.Name == "id" || field.Name == "Users_id" || field.Name == "Customers_id" {
			idFields++
		}
	}
	
	if idFields < 2 {
		t.Errorf("Expected at least 2 id fields (with prefixes), got %d", idFields)
	}
	
	hasName := false
	hasEmail := false
	for _, field := range merged.Fields {
		if field.Name == "name" {
			hasName = true
		}
		if field.Name == "email" {
			hasEmail = true
		}
	}
	
	if !hasName {
		t.Error("Expected 'name' field to be present")
	}
	if !hasEmail {
		t.Error("Expected 'email' field to be present")
	}
}

func TestAggregateNodeInputs_SingleInput(t *testing.T) {
	nodeResults := map[string]interface{}{
		"node1": map[string]interface{}{
			"data": []map[string]interface{}{
				{"field1": "value1"},
			},
			"metadata": map[string]interface{}{
				"schema": map[string]interface{}{
					"fields": []map[string]interface{}{
						{"name": "field1", "type": "string"},
					},
				},
			},
		},
	}
	
	nodeLabels := map[string]string{"node1": "Source1"}
	
	result, err := aggregateNodeInputs(nodeResults, []string{"node1"}, nodeLabels)
	if err != nil {
		t.Fatalf("aggregateNodeInputs failed: %v", err)
	}
	
	envelope := types.FromMap(result)
	if len(envelope.Data) != 1 {
		t.Errorf("Expected 1 record, got %d", len(envelope.Data))
	}
}

func TestAggregateNodeInputs_MultipleInputs(t *testing.T) {
	nodeResults := map[string]interface{}{
		"node1": map[string]interface{}{
			"data": []map[string]interface{}{
				{"field1": "value1"},
			},
			"metadata": map[string]interface{}{
				"schema": map[string]interface{}{
					"fields": []map[string]interface{}{
						{"name": "field1", "type": "string", "source_node": "node1"},
					},
				},
			},
		},
		"node2": map[string]interface{}{
			"data": []map[string]interface{}{
				{"field2": "value2"},
			},
			"metadata": map[string]interface{}{
				"schema": map[string]interface{}{
					"fields": []map[string]interface{}{
						{"name": "field2", "type": "string", "source_node": "node2"},
					},
				},
			},
		},
	}
	
	nodeLabels := map[string]string{
		"node1": "Source1",
		"node2": "Source2",
	}
	
	result, err := aggregateNodeInputs(nodeResults, []string{"node1", "node2"}, nodeLabels)
	if err != nil {
		t.Fatalf("aggregateNodeInputs failed: %v", err)
	}
	
	envelope := types.FromMap(result)
	if len(envelope.Data) < 2 {
		t.Errorf("Expected at least 2 records, got %d", len(envelope.Data))
	}
	
	if len(envelope.Metadata.Schema.Fields) < 2 {
		t.Errorf("Expected at least 2 fields, got %d", len(envelope.Metadata.Schema.Fields))
	}
}

func TestMergeEnvelopes(t *testing.T) {
	envelope1 := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"id": "1", "name": "Alice"},
			{"id": "2", "name": "Bob"},
		},
		Metadata: types.Metadata{
			NodeID:      "node1",
			RecordCount: 2,
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
			{"id": "10", "title": "Task 1"},
			{"id": "20", "title": "Task 2"},
		},
		Metadata: types.Metadata{
			NodeID:      "node2",
			RecordCount: 2,
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
		"node1": "Users",
		"node2": "Tasks",
	}

	merged := mergeEnvelopes([]*types.DataEnvelope{envelope1, envelope2}, nodeLabels)

	if len(merged.Data) != 4 {
		t.Errorf("Expected 4 data records, got %d", len(merged.Data))
	}

	if len(merged.Metadata.Schema.Fields) != 4 {
		t.Errorf("Expected 4 fields (Users_id, name, Tasks_id, title), got %d", len(merged.Metadata.Schema.Fields))
		for i, field := range merged.Metadata.Schema.Fields {
			t.Logf("  Field %d: %s (source: %s)", i, field.Name, field.SourceNode)
		}
	}

	fieldNames := make(map[string]bool)
	for _, field := range merged.Metadata.Schema.Fields {
		fieldNames[field.Name] = true
	}

	if !fieldNames["Users_id"] && !fieldNames["node1_id"] {
		t.Error("Expected Users_id or node1_id field for conflict resolution")
	}

	if !fieldNames["Tasks_id"] && !fieldNames["node2_id"] {
		t.Error("Expected Tasks_id or node2_id field for conflict resolution")
	}

	if !fieldNames["name"] {
		t.Error("Expected name field (no conflict)")
	}

	if !fieldNames["title"] {
		t.Error("Expected title field (no conflict)")
	}

	if len(merged.Metadata.Sources) != 2 {
		t.Errorf("Expected 2 source nodes, got %d", len(merged.Metadata.Sources))
	}
}

func TestInferSchemaFromData(t *testing.T) {
	data := []map[string]interface{}{
		{
			"name":    "Alice",
			"age":     30,
			"active":  true,
			"balance": 1000.50,
		},
		{
			"name":    "Bob",
			"age":     25,
			"active":  false,
			"balance": 500.0,
		},
	}

	schema := inferSchemaFromData(data)

	if len(schema.Fields) != 4 {
		t.Errorf("Expected 4 fields, got %d", len(schema.Fields))
	}

	fieldTypes := make(map[string]string)
	for _, field := range schema.Fields {
		fieldTypes[field.Name] = field.Type
	}

	if fieldTypes["name"] != "string" {
		t.Errorf("Expected name to be string, got %s", fieldTypes["name"])
	}

	if fieldTypes["age"] != "number" {
		t.Errorf("Expected age to be number, got %s", fieldTypes["age"])
	}

	if fieldTypes["active"] != "boolean" {
		t.Errorf("Expected active to be boolean, got %s", fieldTypes["active"])
	}

	if fieldTypes["balance"] != "number" {
		t.Errorf("Expected balance to be number, got %s", fieldTypes["balance"])
	}
}

func TestInferSchemaFromData_WithNullValues(t *testing.T) {
	data := []map[string]interface{}{
		{
			"name":  "Alice",
			"email": "alice@example.com",
		},
		{
			"name":  "Bob",
			"email": nil,
		},
	}

	schema := inferSchemaFromData(data)

	for _, field := range schema.Fields {
		if field.Name == "email" {
			if !field.Nullable {
				t.Error("Expected email field to be nullable")
			}
		}
	}
}

func TestGetNodeLabel(t *testing.T) {
	nodeLabels := map[string]string{
		"node1": "Users",
		"node2": "Products",
	}

	label := getNodeLabel("node1", nodeLabels)
	if label != "Users" {
		t.Errorf("Expected 'Users', got '%s'", label)
	}

	label = getNodeLabel("node3", nodeLabels)
	if label == "" {
		t.Error("Expected fallback label for unknown node")
	}
}

func TestMergeEnvelopes_EmptyInput(t *testing.T) {
	nodeLabels := make(map[string]string)
	merged := mergeEnvelopes([]*types.DataEnvelope{}, nodeLabels)

	if len(merged.Data) != 0 {
		t.Errorf("Expected 0 data records for empty input, got %d", len(merged.Data))
	}

	if len(merged.Metadata.Schema.Fields) != 0 {
		t.Errorf("Expected 0 fields for empty input, got %d", len(merged.Metadata.Schema.Fields))
	}
}

func TestMergeEnvelopes_PreservesSourceNodeMetadata(t *testing.T) {
	envelope1 := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"field1": "value1"},
		},
		Metadata: types.Metadata{
			NodeID: "node1",
			Schema: types.DataSchema{
				Fields: []types.FieldDefinition{
					{Name: "field1", Type: "string", SourceNode: "node1"},
				},
				SourceNodes: []string{"node1"},
			},
			Sources: []string{"node1"},
		},
	}

	nodeLabels := map[string]string{"node1": "Source1"}
	merged := mergeEnvelopes([]*types.DataEnvelope{envelope1}, nodeLabels)

	if len(merged.Metadata.Schema.Fields) != 1 {
		t.Fatalf("Expected 1 field, got %d", len(merged.Metadata.Schema.Fields))
	}

	field := merged.Metadata.Schema.Fields[0]
	if field.SourceNode != "node1" {
		t.Errorf("Expected SourceNode 'node1', got '%s'", field.SourceNode)
	}

	if len(merged.Metadata.Schema.SourceNodes) != 1 {
		t.Errorf("Expected 1 source node, got %d", len(merged.Metadata.Schema.SourceNodes))
	}

	if merged.Metadata.Schema.SourceNodes[0] != "node1" {
		t.Errorf("Expected source node 'node1', got '%s'", merged.Metadata.Schema.SourceNodes[0])
	}
}

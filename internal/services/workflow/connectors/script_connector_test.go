package connectors

import (
	"context"
	"testing"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

func TestScriptConnector_ExecutePerRecord(t *testing.T) {
	connector := NewScriptConnector().(*ScriptConnector)
	
	// Configure with a simple script
	if err := connector.Configure(map[string]interface{}{
		"script": `
			record.newField = record.oldField * 2;
			return record;
		`,
		"mode": "per_record",
	}); err != nil {
		t.Fatalf("Failed to configure connector: %v", err)
	}
	
	// Create input envelope
	inputEnvelope := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"oldField": 5, "name": "test1"},
			{"oldField": 10, "name": "test2"},
		},
		Metadata: types.Metadata{
			Schema: types.DataSchema{
				Fields: []types.FieldDefinition{
					{Name: "oldField", Type: "number"},
					{Name: "name", Type: "string"},
				},
			},
		},
	}
	
	// Execute
	result, err := connector.Execute(context.Background(), inputEnvelope.ToMap())
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	
	// Verify result
	resultEnvelope := types.FromMap(result)
	if len(resultEnvelope.Data) != 2 {
		t.Errorf("Expected 2 records, got %d", len(resultEnvelope.Data))
	}
	
	// Check first record
	firstRecord := resultEnvelope.Data[0]
	if newField, ok := firstRecord["newField"].(float64); ok {
		if newField != 10 {
			t.Errorf("Expected newField to be 10, got %v", newField)
		}
	} else {
		t.Error("newField not found or wrong type in first record")
	}
}

func TestScriptConnector_ErrorHandling(t *testing.T) {
	connector := NewScriptConnector().(*ScriptConnector)
	
	// Configure with invalid script
	if err := connector.Configure(map[string]interface{}{
		"script": `invalid javascript syntax {`,
		"mode":   "per_record",
	}); err != nil {
		t.Fatalf("Failed to configure connector: %v", err)
	}
	
	inputEnvelope := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"field": "value"},
		},
		Metadata: types.Metadata{
			Schema: types.DataSchema{
				Fields: []types.FieldDefinition{
					{Name: "field", Type: "string"},
				},
			},
		},
	}
	
	// Execute should return error
	_, err := connector.Execute(context.Background(), inputEnvelope.ToMap())
	if err == nil {
		t.Error("Expected error for invalid script, but got none")
	}
}

func TestScriptConnector_SchemaInference(t *testing.T) {
	connector := NewScriptConnector().(*ScriptConnector)
	
	// Configure script that adds new fields
	if err := connector.Configure(map[string]interface{}{
		"script": `
			record.computed = record.value * 2;
			record.status = "processed";
			return record;
		`,
		"mode": "per_record",
	}); err != nil {
		t.Fatalf("Failed to configure connector: %v", err)
	}
	
	inputEnvelope := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"value": 5},
		},
		Metadata: types.Metadata{
			Schema: types.DataSchema{
				Fields: []types.FieldDefinition{
					{Name: "value", Type: "number"},
				},
			},
		},
	}
	
	// Execute
	result, err := connector.Execute(context.Background(), inputEnvelope.ToMap())
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	
	// Verify schema is inferred
	resultEnvelope := types.FromMap(result)
	if len(resultEnvelope.Metadata.Schema.Fields) < 3 {
		t.Errorf("Expected at least 3 fields in output schema, got %d", len(resultEnvelope.Metadata.Schema.Fields))
	}
}


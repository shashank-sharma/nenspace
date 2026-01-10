package connectors

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

func TestCSVConnector_SchemaPropagation(t *testing.T) {
	// Test that CSV source connector infers schema from headers
	sourceConnector := NewCSVSourceConnector().(*CSVConnector)

	// Create a temporary CSV file with headers
	tmpDir := t.TempDir()
	csvFile := filepath.Join(tmpDir, "test.csv")

	csvContent := "name,age,email\nJohn,30,john@example.com\nJane,25,jane@example.com\n"
	if err := os.WriteFile(csvFile, []byte(csvContent), 0644); err != nil {
		t.Fatalf("Failed to create test CSV file: %v", err)
	}

	// Configure connector
	if err := sourceConnector.Configure(map[string]interface{}{
		"file_path":  csvFile,
		"has_header": true,
		"delimiter":  ",",
	}); err != nil {
		t.Fatalf("Failed to configure connector: %v", err)
	}

	// Test GetOutputSchema
	schema, err := sourceConnector.GetOutputSchema(nil)
	if err != nil {
		t.Fatalf("GetOutputSchema failed: %v", err)
	}

	if len(schema.Fields) != 3 {
		t.Errorf("Expected 3 fields, got %d", len(schema.Fields))
	}

	// Verify field names
	fieldNames := make(map[string]bool)
	for _, field := range schema.Fields {
		fieldNames[field.Name] = true
	}

	expectedFields := []string{"name", "age", "email"}
	for _, expected := range expectedFields {
		if !fieldNames[expected] {
			t.Errorf("Expected field %s not found in schema", expected)
		}
	}
}

func TestCSVConnector_DestinationPreservesSchema(t *testing.T) {
	// Test that CSV destination connector preserves input schema
	destConnector := NewCSVDestinationConnector().(*CSVConnector)

	inputSchema := &types.DataSchema{
		Fields: []types.FieldDefinition{
			{Name: "field1", Type: "string", Nullable: false},
			{Name: "field2", Type: "number", Nullable: true},
		},
		SourceNodes: []string{"source1"},
	}

	// Test GetOutputSchema for destination
	outputSchema, err := destConnector.GetOutputSchema(inputSchema)
	if err != nil {
		t.Fatalf("GetOutputSchema failed: %v", err)
	}

	if outputSchema == nil {
		t.Fatal("Output schema should not be nil")
	}

	// Schema should be preserved
	if len(outputSchema.Fields) != len(inputSchema.Fields) {
		t.Errorf("Expected %d fields, got %d", len(inputSchema.Fields), len(outputSchema.Fields))
	}

	// Verify field names match
	for i, field := range outputSchema.Fields {
		if field.Name != inputSchema.Fields[i].Name {
			t.Errorf("Field name mismatch: expected %s, got %s", inputSchema.Fields[i].Name, field.Name)
		}
	}
}

func TestCSVConnector_ExecutePreservesSchema(t *testing.T) {
	// Test that Execute method preserves schema in output envelope
	destConnector := NewCSVDestinationConnector().(*CSVConnector)

	tmpDir := t.TempDir()
	outputFile := filepath.Join(tmpDir, "output.csv")

	// Configure connector
	if err := destConnector.Configure(map[string]interface{}{
		"file_path":      outputFile,
		"include_header": true,
		"delimiter":      ",",
	}); err != nil {
		t.Fatalf("Failed to configure connector: %v", err)
	}

	// Create input envelope with schema
	inputEnvelope := &types.DataEnvelope{
		Data: []map[string]interface{}{
			{"name": "John", "age": 30},
			{"name": "Jane", "age": 25},
		},
		Metadata: types.Metadata{
			Schema: types.DataSchema{
				Fields: []types.FieldDefinition{
					{Name: "name", Type: "string"},
					{Name: "age", Type: "number"},
				},
			},
		},
	}

	// Execute
	result, err := destConnector.Execute(context.Background(), inputEnvelope.ToMap())
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	// Verify result envelope preserves schema
	resultEnvelope := types.FromMap(result)
	if len(resultEnvelope.Metadata.Schema.Fields) == 0 {
		t.Error("Output envelope should preserve schema, but schema is empty")
	}

	// Verify file was created
	if _, err := os.Stat(outputFile); os.IsNotExist(err) {
		t.Error("Output CSV file was not created")
	}
}

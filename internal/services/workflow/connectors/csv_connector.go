package connectors

import (
	"context"
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
	"github.com/shashank-sharma/backend/internal/store"
)

// CSVConnector is a connector for reading and writing CSV files
type CSVConnector struct {
	types.BaseConnector
}

// NewCSVSourceConnector creates a new CSV source connector
func NewCSVSourceConnector() types.Connector {
	configSchema := map[string]interface{}{
		"file_path": map[string]interface{}{
			"type":        "string",
			"title":       "File Path",
			"description": "Path to the CSV file (uploads/{filename}.csv for uploaded files)",
			"required":    true,
		},
		"has_header": map[string]interface{}{
			"type":        "boolean",
			"title":       "Has Header",
			"description": "Whether the CSV file has a header row",
			"default":     true,
			"required":    false,
		},
		"delimiter": map[string]interface{}{
			"type":        "string",
			"title":       "Delimiter",
			"description": "Field delimiter (comma, semicolon, tab, etc.)",
			"default":     ",",
			"required":    false,
		},
		"comment": map[string]interface{}{
			"type":        "string",
			"title":       "Comment Character",
			"description": "Character that marks the start of a comment line",
			"required":    false,
		},
	}

	connector := &CSVConnector{
		BaseConnector: types.BaseConnector{
			ConnID:       "csv_source",
			ConnName:     "CSV Source",
			ConnType:     types.SourceConnector,
			ConfigSchema: configSchema,
			Config:       make(map[string]interface{}),
		},
	}

	return connector
}

// NewCSVDestinationConnector creates a new CSV destination connector
func NewCSVDestinationConnector() types.Connector {
	configSchema := map[string]interface{}{
		"file_path": map[string]interface{}{
			"type":        "string",
			"title":       "File Path",
			"description": "Path to the CSV file (uploads/{filename}.csv for uploaded files)",
			"required":    true,
		},
		"delimiter": map[string]interface{}{
			"type":        "string",
			"title":       "Delimiter",
			"description": "Field delimiter (comma, semicolon, tab, etc.)",
			"default":     ",",
			"required":    false,
		},
		"include_header": map[string]interface{}{
			"type":        "boolean",
			"title":       "Include Header",
			"description": "Whether to include a header row in the CSV file",
			"default":     true,
			"required":    false,
		},
	}

	connector := &CSVConnector{
		BaseConnector: types.BaseConnector{
			ConnID:       "csv_destination",
			ConnName:     "CSV Destination",
			ConnType:     types.DestinationConnector,
			ConfigSchema: configSchema,
			Config:       make(map[string]interface{}),
		},
	}

	return connector
}

// Execute runs the CSV connector operation and returns the result
func (c *CSVConnector) Execute(ctx context.Context, input map[string]interface{}) (map[string]interface{}, error) {
	config := c.Config
	
	filePath, ok := config["file_path"].(string)
	if !ok {
		return nil, fmt.Errorf("file path is required")
	}
	
	if c.Type() == types.SourceConnector {
		return c.readCSV(filePath, config)
	} else if c.Type() == types.DestinationConnector {
		return c.writeCSV(filePath, config, input)
	}
	
	return nil, fmt.Errorf("unsupported connector type: %s", c.Type())
}

// resolveFilePath resolves the file path based on the storage path
func (c *CSVConnector) resolveFilePath(filePath string) string {
	pb := store.GetDao()
	
	// If it's an uploaded file path that starts with "uploads/"
	if strings.HasPrefix(filePath, "uploads/") {
		return filepath.Join(pb.DataDir(), filePath)
	}
	
	// For destination files, store in the workflow results directory
	if c.Type() == types.DestinationConnector {
		resultsDir := filepath.Join(pb.DataDir(), "storage", "workflow_results")
		
		if err := os.MkdirAll(resultsDir, 0755); err != nil {
			return filePath
		}
		
		return filepath.Join(resultsDir, filePath)
	}
	
	return filePath
}

// readCSV reads data from a CSV file and returns envelope format
func (c *CSVConnector) readCSV(filePath string, config map[string]interface{}) (map[string]interface{}, error) {
	resolvedPath := c.resolveFilePath(filePath)
	
	file, err := os.Open(resolvedPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open CSV file: %w", err)
	}
	defer file.Close()
	
	reader := csv.NewReader(file)
	
	if delimiter, ok := config["delimiter"].(string); ok && len(delimiter) > 0 {
		reader.Comma = rune(delimiter[0])
	}
	
	if comment, ok := config["comment"].(string); ok && len(comment) > 0 {
		reader.Comment = rune(comment[0])
	}
	
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV data: %w", err)
	}
	
	// Convert to map or array based on header setting
	hasHeader, _ := config["has_header"].(bool)
	
	var result []map[string]interface{}
	var schema types.DataSchema
	schema.Fields = make([]types.FieldDefinition, 0)
	schema.SourceNodes = make([]string, 0)
	
	if len(records) == 0 {
		envelope := &types.DataEnvelope{
			Data: make([]map[string]interface{}, 0),
			Metadata: types.Metadata{
				NodeType:        c.ConnID,
				RecordCount:      0,
				ExecutionTimeMs:  0,
				Schema:          schema,
				Sources:         make([]string, 0),
				Custom: map[string]interface{}{
					"file_path": resolvedPath,
				},
			},
		}
		return envelope.ToMap(), nil
	}
	
	if hasHeader && len(records) > 0 {
		headers := records[0]
		
		// Build schema from headers (all fields are strings from CSV)
		for _, header := range headers {
			schema.Fields = append(schema.Fields, types.FieldDefinition{
				Name:     header,
				Type:     "string",
				Nullable: true, // CSV values can be empty
			})
		}
		
		for i := 1; i < len(records); i++ {
			row := make(map[string]interface{})
			
			for j, value := range records[i] {
				if j < len(headers) {
					row[headers[j]] = value
				} else {
					row[fmt.Sprintf("column_%d", j+1)] = value
				}
			}
			
			result = append(result, row)
		}
	} else {
		// No header: generate column names and schema
		if len(records) > 0 {
			columnCount := len(records[0])
			for j := 0; j < columnCount; j++ {
				fieldName := fmt.Sprintf("column_%d", j+1)
				schema.Fields = append(schema.Fields, types.FieldDefinition{
					Name:     fieldName,
					Type:     "string",
					Nullable: true,
				})
			}
		}
		
		for _, record := range records {
			row := make(map[string]interface{})
			
			for j, value := range record {
				row[fmt.Sprintf("column_%d", j+1)] = value
			}
			
			result = append(result, row)
		}
	}
	
	envelope := &types.DataEnvelope{
		Data: result,
		Metadata: types.Metadata{
			NodeType:        c.ConnID,
			RecordCount:     len(result),
			ExecutionTimeMs: 0,
			Schema:          schema,
			Sources:         make([]string, 0),
			Custom: map[string]interface{}{
				"file_path": resolvedPath,
			},
		},
	}
	
	return envelope.ToMap(), nil
}

// writeCSV writes data to a CSV file
// Accepts envelope format and uses schema for headers if available
func (c *CSVConnector) writeCSV(filePath string, config map[string]interface{}, input map[string]interface{}) (map[string]interface{}, error) {
	resolvedPath := c.resolveFilePath(filePath)
	
	// Extract envelope format
	envelope := types.FromMap(input)
	
	// Get data from envelope
	inputData := envelope.Data
	if len(inputData) == 0 {
		// Fallback: try legacy format
		if data, ok := input["data"]; ok {
			if dataArray, ok := data.([]interface{}); ok {
				// Convert to map format
				for _, item := range dataArray {
					if record, ok := item.(map[string]interface{}); ok {
						inputData = append(inputData, record)
					}
				}
			}
		}
	}
	
	if len(inputData) == 0 {
		return nil, fmt.Errorf("no data provided for CSV output")
	}
	
	// Use schema for headers if available, otherwise infer from data
	var headers []string
	if len(envelope.Metadata.Schema.Fields) > 0 {
		// Use schema fields as headers
		headers = make([]string, 0, len(envelope.Metadata.Schema.Fields))
		for _, field := range envelope.Metadata.Schema.Fields {
			headers = append(headers, field.Name)
		}
	}
	
	rows, inferredHeaders, err := convertToCSVRecordsFromMaps(inputData, headers)
	if err != nil {
		return nil, err
	}
	
	// Use inferred headers if schema didn't provide them
	if len(headers) == 0 {
		headers = inferredHeaders
	}
	
	append, _ := config["append"].(bool)
	
	var fileMode int
	if append {
		fileMode = os.O_APPEND | os.O_CREATE | os.O_WRONLY
	} else {
		fileMode = os.O_CREATE | os.O_WRONLY | os.O_TRUNC
	}
	
	err = os.MkdirAll(filepath.Dir(resolvedPath), 0755)
	if err != nil {
		return nil, fmt.Errorf("failed to create directory: %w", err)
	}
	
	file, err := os.OpenFile(resolvedPath, fileMode, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open CSV file for writing: %w", err)
	}
	defer file.Close()
	
	writer := csv.NewWriter(file)
	defer writer.Flush()
	
	if delimiter, ok := config["delimiter"].(string); ok && len(delimiter) > 0 {
		writer.Comma = rune(delimiter[0])
	}
	
	includeHeader, _ := config["include_header"].(bool)
	
	fileInfo, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}
	
	if includeHeader && (!append || fileInfo.Size() == 0) {
		if err := writer.Write(headers); err != nil {
			return nil, fmt.Errorf("failed to write CSV header: %w", err)
		}
	}
	
	for _, row := range rows {
		if err := writer.Write(row); err != nil {
			return nil, fmt.Errorf("failed to write CSV row: %w", err)
		}
	}
	
	// Return envelope format for consistency
	outputEnvelope := &types.DataEnvelope{
		Data: make([]map[string]interface{}, 0), // Destination doesn't output data
		Metadata: types.Metadata{
			NodeType:        c.ConnID,
			RecordCount:     len(rows),
			ExecutionTimeMs: 0,
			Schema:          types.DataSchema{}, // Destination doesn't output schema
			Sources:         envelope.Metadata.Sources,
			Custom: map[string]interface{}{
				"file_path": resolvedPath,
				"success":   true,
			},
		},
	}
	
	return outputEnvelope.ToMap(), nil
}

// GetOutputSchema returns the schema for CSV source connector
// For CSV source, schema is inferred from headers
func (c *CSVConnector) GetOutputSchema(inputSchema *types.DataSchema) (*types.DataSchema, error) {
	if c.Type() == types.SourceConnector {
		// Source connectors don't accept input schemas
		if inputSchema != nil {
			return nil, fmt.Errorf("source connector does not accept input schema")
		}
		// Schema will be inferred from CSV file at execution time
		// Return empty schema - will be populated during Execute()
		return &types.DataSchema{
			Fields:      make([]types.FieldDefinition, 0),
			SourceNodes: make([]string, 0),
		}, nil
	} else if c.Type() == types.DestinationConnector {
		// Destination connectors don't output schemas
		return nil, fmt.Errorf("destination connector does not output schema")
	}
	return nil, fmt.Errorf("unsupported connector type")
}

// ValidateInputSchema validates input schema for CSV destination
func (c *CSVConnector) ValidateInputSchema(schema *types.DataSchema) error {
	if c.Type() == types.SourceConnector {
		// Source connectors don't accept input
		if schema != nil {
			return fmt.Errorf("source connector does not accept input schema")
		}
		return nil
	} else if c.Type() == types.DestinationConnector {
		// Destination accepts any schema (all fields will be written to CSV)
		return nil
	}
	return fmt.Errorf("unsupported connector type")
}

// convertToCSVRecordsFromMaps converts map records to CSV format
// If headers are provided, uses them; otherwise infers from data
func convertToCSVRecordsFromMaps(records []map[string]interface{}, providedHeaders []string) ([][]string, []string, error) {
	var rows [][]string
	var headers []string
	
	if len(records) == 0 {
		return [][]string{}, providedHeaders, nil
	}
	
	// Use provided headers if available
	if len(providedHeaders) > 0 {
		headers = providedHeaders
	} else {
		// Infer headers from all records
		headerMap := make(map[string]bool)
		for _, record := range records {
			for key := range record {
				headerMap[key] = true
			}
		}
		
		for header := range headerMap {
			headers = append(headers, header)
		}
	}
	
	// Convert records to rows
	for _, record := range records {
		row := make([]string, len(headers))
		
		for i, header := range headers {
			if val, exists := record[header]; exists {
				row[i] = fmt.Sprintf("%v", val)
			} else {
				row[i] = ""
			}
		}
		
		rows = append(rows, row)
	}
	
	return rows, headers, nil
}

// convertToCSVRecords converts input data to CSV records (legacy function for backward compatibility)
func convertToCSVRecords(input interface{}) ([][]string, []string, error) {
	inputArray, ok := input.([]interface{})
	if ok {
		if len(inputArray) == 0 {
			return [][]string{}, []string{}, nil
		}
		
		// Convert to map format
		records := make([]map[string]interface{}, 0, len(inputArray))
		for _, item := range inputArray {
			if objItem, ok := item.(map[string]interface{}); ok {
				records = append(records, objItem)
			}
		}
		
		return convertToCSVRecordsFromMaps(records, nil)
	} else if objInput, ok := input.(map[string]interface{}); ok {
		if data, ok := objInput["data"].([]interface{}); ok {
			return convertToCSVRecords(data)
		}
		
		// Single object
		record := make(map[string]interface{})
		for key, val := range objInput {
			record[key] = val
		}
		return convertToCSVRecordsFromMaps([]map[string]interface{}{record}, nil)
	} else {
		return nil, nil, fmt.Errorf("input data must be an array of objects or a single object")
	}
} 
package workflow

import (
	"fmt"
	"strings"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

// aggregateNodeInputs intelligently merges data from multiple input nodes
// Returns a DataEnvelope with merged data and unified schema
func aggregateNodeInputs(nodeResults map[string]interface{}, inputNodeIDs []string, nodeLabels map[string]string) (map[string]interface{}, error) {
	if len(inputNodeIDs) == 0 {
		// Return empty envelope
		envelope := &types.DataEnvelope{
			Data: make([]map[string]interface{}, 0),
			Metadata: types.Metadata{
				Schema: types.DataSchema{
					Fields:      make([]types.FieldDefinition, 0),
					SourceNodes: make([]string, 0),
				},
				Sources: make([]string, 0),
				Custom:  make(map[string]interface{}),
			},
		}
		return envelope.ToMap(), nil
	}

	// Extract envelopes from all input nodes
	envelopes := make([]*types.DataEnvelope, 0, len(inputNodeIDs))
	for _, inputID := range inputNodeIDs {
		result, exists := nodeResults[inputID]
		if !exists {
			continue
		}

		var envelope *types.DataEnvelope
		if resultMap, ok := result.(map[string]interface{}); ok {
			envelope = types.FromMap(resultMap)
			// Set source node ID if not already set
			if envelope.Metadata.NodeID == "" {
				envelope.Metadata.NodeID = inputID
			}
		} else {
			// Legacy format: wrap in envelope
			envelope = &types.DataEnvelope{
				Data: make([]map[string]interface{}, 0),
				Metadata: types.Metadata{
					NodeID: inputID,
					Schema: types.DataSchema{
						Fields:      make([]types.FieldDefinition, 0),
						SourceNodes: []string{inputID},
					},
					Sources: []string{inputID},
					Custom:  make(map[string]interface{}),
				},
			}
			if record, ok := result.(map[string]interface{}); ok {
				envelope.Data = []map[string]interface{}{record}
				envelope.Metadata.RecordCount = 1
			}
		}
		envelopes = append(envelopes, envelope)
	}

	if len(envelopes) == 0 {
		envelope := &types.DataEnvelope{
			Data: make([]map[string]interface{}, 0),
			Metadata: types.Metadata{
				Schema: types.DataSchema{
					Fields:      make([]types.FieldDefinition, 0),
					SourceNodes: make([]string, 0),
				},
				Sources: make([]string, 0),
				Custom:  make(map[string]interface{}),
			},
		}
		return envelope.ToMap(), nil
	}

	// Single input: return as-is (but ensure it's in envelope format)
	if len(envelopes) == 1 {
		return envelopes[0].ToMap(), nil
	}

	// Multiple inputs: merge intelligently
	mergedEnvelope := mergeEnvelopes(envelopes, nodeLabels)
	return mergedEnvelope.ToMap(), nil
}

// mergeEnvelopes merges multiple data envelopes into one
// Handles schema conflicts by prefixing field names with source node labels
func mergeEnvelopes(envelopes []*types.DataEnvelope, nodeLabels map[string]string) *types.DataEnvelope {
	if len(envelopes) == 0 {
		return &types.DataEnvelope{
			Data: make([]map[string]interface{}, 0),
			Metadata: types.Metadata{
				Schema: types.DataSchema{
					Fields:      make([]types.FieldDefinition, 0),
					SourceNodes: make([]string, 0),
				},
				Sources: make([]string, 0),
				Custom:  make(map[string]interface{}),
			},
		}
	}

	merged := &types.DataEnvelope{
		Data: make([]map[string]interface{}, 0),
		Metadata: types.Metadata{
			Schema: types.DataSchema{
				Fields:      make([]types.FieldDefinition, 0),
				SourceNodes: make([]string, 0),
			},
			Sources: make([]string, 0),
			Custom:  make(map[string]interface{}),
		},
	}

	// Collect all source node IDs
	sourceNodeSet := make(map[string]bool)
	for _, env := range envelopes {
		sourceNodeSet[env.Metadata.NodeID] = true
		for _, sourceID := range env.Metadata.Sources {
			sourceNodeSet[sourceID] = true
		}
	}
	for nodeID := range sourceNodeSet {
		merged.Metadata.Sources = append(merged.Metadata.Sources, nodeID)
		merged.Metadata.Schema.SourceNodes = append(merged.Metadata.Schema.SourceNodes, nodeID)
	}

	// Merge schemas with conflict detection
	fieldMap := make(map[string]*types.FieldDefinition) // field name -> field definition
	fieldCounts := make(map[string]int)                 // field name -> count of occurrences

	// First pass: collect all fields and count occurrences
	for _, env := range envelopes {
		for _, field := range env.Metadata.Schema.Fields {
			fieldCounts[field.Name]++
			if existing, exists := fieldMap[field.Name]; !exists {
				// First occurrence: store it
				fieldMap[field.Name] = &types.FieldDefinition{
					Name:        field.Name,
					Type:        field.Type,
					SourceNode:  field.SourceNode,
					Nullable:    field.Nullable,
					Description: field.Description,
				}
			} else {
				// Field already exists: merge nullable (if one is nullable, merged is nullable)
				if field.Nullable {
					existing.Nullable = true
				}
				// Keep type from first occurrence (could be enhanced to detect type conflicts)
			}
		}
	}

	// Second pass: handle conflicts by prefixing
	conflictFields := make(map[string]bool) // fields that appear in multiple sources
	for fieldName, count := range fieldCounts {
		if count > 1 {
			conflictFields[fieldName] = true
		}
	}

	// Build merged schema with conflict resolution
	for _, env := range envelopes {
		for _, field := range env.Metadata.Schema.Fields {
			mergedField := types.FieldDefinition{
				Name:        field.Name,
				Type:        field.Type,
				SourceNode:  field.SourceNode,
				Nullable:    field.Nullable,
				Description: field.Description,
			}

			// If field name conflicts, prefix with source node label
			if conflictFields[field.Name] {
				prefix := getNodeLabel(env.Metadata.NodeID, nodeLabels)
				if prefix != "" {
					mergedField.Name = fmt.Sprintf("%s_%s", prefix, field.Name)
					if mergedField.Description == "" {
						mergedField.Description = fmt.Sprintf("%s (from %s)", field.Name, prefix)
					} else {
						mergedField.Description = fmt.Sprintf("%s (from %s)", mergedField.Description, prefix)
					}
				} else {
					// Fallback to node ID if no label
					mergedField.Name = fmt.Sprintf("%s_%s", env.Metadata.NodeID[:8], field.Name)
					if mergedField.Description == "" {
						mergedField.Description = fmt.Sprintf("%s (from node %s)", field.Name, env.Metadata.NodeID[:8])
					}
				}
			}

			// Preserve source node information for lineage tracking
			if mergedField.SourceNode == "" {
				mergedField.SourceNode = env.Metadata.NodeID
			}

			// Check if we already added this field (avoid duplicates)
			alreadyAdded := false
			for _, existingField := range merged.Metadata.Schema.Fields {
				if existingField.Name == mergedField.Name && existingField.SourceNode == mergedField.SourceNode {
					alreadyAdded = true
					break
				}
			}

			if !alreadyAdded {
				merged.Metadata.Schema.Fields = append(merged.Metadata.Schema.Fields, mergedField)
			}
		}
	}

	// Merge data: combine all records
	totalRecords := 0
	for _, env := range envelopes {
		merged.Data = append(merged.Data, env.Data...)
		totalRecords += env.Metadata.RecordCount
	}
	merged.Metadata.RecordCount = totalRecords

	// Merge custom metadata
	merged.Metadata.Custom = make(map[string]interface{})
	for _, env := range envelopes {
		for k, v := range env.Metadata.Custom {
			// For conflicting keys, create arrays
			if existing, exists := merged.Metadata.Custom[k]; exists {
				if existingArray, ok := existing.([]interface{}); ok {
					merged.Metadata.Custom[k] = append(existingArray, v)
				} else {
					merged.Metadata.Custom[k] = []interface{}{existing, v}
				}
			} else {
				merged.Metadata.Custom[k] = v
			}
		}
	}

	return merged
}

// mergeSchemas merges multiple schemas into one
// This is a helper function that can be used by connectors
func mergeSchemas(schemas []types.DataSchema, nodeLabels map[string]string) types.DataSchema {
	if len(schemas) == 0 {
		return types.DataSchema{
			Fields:      make([]types.FieldDefinition, 0),
			SourceNodes: make([]string, 0),
		}
	}

	if len(schemas) == 1 {
		return schemas[0]
	}

	merged := types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: make([]string, 0),
	}

	// Collect all source nodes
	sourceNodeSet := make(map[string]bool)
	for _, schema := range schemas {
		for _, nodeID := range schema.SourceNodes {
			sourceNodeSet[nodeID] = true
		}
	}
	for nodeID := range sourceNodeSet {
		merged.SourceNodes = append(merged.SourceNodes, nodeID)
	}

	// Count field occurrences
	fieldCounts := make(map[string]int)
	for _, schema := range schemas {
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
	for _, schema := range schemas {
		for _, field := range schema.Fields {
			mergedField := field

			// Prefix conflicting fields
			if conflictFields[field.Name] && field.SourceNode != "" {
				prefix := getNodeLabel(field.SourceNode, nodeLabels)
				if prefix != "" {
					mergedField.Name = fmt.Sprintf("%s_%s", prefix, field.Name)
				} else {
					mergedField.Name = fmt.Sprintf("%s_%s", field.SourceNode[:8], field.Name)
				}
			}

			// Avoid duplicates
			alreadyAdded := false
			for _, existingField := range merged.Fields {
				if existingField.Name == mergedField.Name && existingField.SourceNode == mergedField.SourceNode {
					alreadyAdded = true
					break
				}
			}

			if !alreadyAdded {
				merged.Fields = append(merged.Fields, mergedField)
			}
		}
	}

	return merged
}

// getNodeLabel returns a human-readable label for a node ID
// Uses nodeLabels map if available, otherwise generates a short label from ID
func getNodeLabel(nodeID string, nodeLabels map[string]string) string {
	if label, exists := nodeLabels[nodeID]; exists && label != "" {
		// Clean label: remove spaces, make lowercase, limit length
		clean := strings.ToLower(strings.ReplaceAll(label, " ", "_"))
		if len(clean) > 10 {
			clean = clean[:10]
		}
		return clean
	}
	// Fallback: use first 8 chars of node ID
	if len(nodeID) >= 8 {
		return nodeID[:8]
	}
	return nodeID
}

// inferSchemaFromData attempts to infer a schema from raw data
// This is useful for connectors that receive unstructured data
func inferSchemaFromData(data []map[string]interface{}) types.DataSchema {
	schema := types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: make([]string, 0),
	}

	if len(data) == 0 {
		return schema
	}

	// Collect all field names and infer types from first record
	fieldMap := make(map[string]types.FieldDefinition)
	for _, record := range data {
		for fieldName, value := range record {
			if _, exists := fieldMap[fieldName]; !exists {
				fieldType := inferFieldType(value)
				fieldMap[fieldName] = types.FieldDefinition{
					Name:     fieldName,
					Type:     fieldType,
					Nullable: value == nil,
				}
			} else {
				// Update nullable if we find a nil value
				if value == nil {
					field := fieldMap[fieldName]
					field.Nullable = true
					fieldMap[fieldName] = field
				}
			}
		}
	}

	// Convert map to slice
	for _, field := range fieldMap {
		schema.Fields = append(schema.Fields, field)
	}

	return schema
}

// inferFieldType attempts to infer the type of a value
func inferFieldType(value interface{}) string {
	if value == nil {
		return "string" // Default to string for null values
	}

	switch value.(type) {
	case bool:
		return "boolean"
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return "number"
	case float32, float64:
		return "number"
	case string:
		// Could enhance to detect dates, but for now treat as string
		return "string"
	case []interface{}, map[string]interface{}:
		return "json"
	default:
		return "string" // Default fallback
	}
}

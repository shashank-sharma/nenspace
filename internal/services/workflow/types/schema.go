package types

// FieldDefinition represents a single field in a data schema
type FieldDefinition struct {
	Name        string `json:"name"`         // Field name
	Type        string `json:"type"`         // Field type: string, number, boolean, date, json
	SourceNode  string `json:"source_node"`  // Which node produced this field (for lineage tracking)
	Nullable    bool   `json:"nullable"`     // Whether the field can be null
	Description string `json:"description"`  // Optional description of the field
}

// DataSchema represents the schema of data flowing through a node
type DataSchema struct {
	Fields      []FieldDefinition `json:"fields"`       // List of field definitions
	SourceNodes []string          `json:"source_nodes"` // All contributing source nodes (for merged data)
}

// Metadata contains execution metadata for a node's output
type Metadata struct {
	NodeID          string                 `json:"node_id"`           // ID of the node that produced this data
	NodeType        string                 `json:"node_type"`         // Type of the connector (e.g., "pocketbase_source")
	Schema          DataSchema             `json:"schema"`           // Schema of the data
	RecordCount     int                    `json:"record_count"`     // Number of records
	ExecutionTimeMs int64                  `json:"execution_time_ms"` // Execution time in milliseconds
	Sources         []string                `json:"sources"`          // For aggregated data, track all source node IDs
	Custom          map[string]interface{} `json:"custom"`            // Node-specific metadata
}

// DataEnvelope is the standardized format for data flowing between nodes
type DataEnvelope struct {
	Data     []map[string]interface{} `json:"data"`     // Actual records/rows
	Metadata Metadata                 `json:"metadata"` // Schema and execution metadata
}

// ToMap converts a DataEnvelope to a map[string]interface{} for backward compatibility
// This allows existing code to work with the new envelope format
func (e *DataEnvelope) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"data":     e.Data,
		"metadata": e.Metadata,
	}
}

// FromMap creates a DataEnvelope from a map (for backward compatibility)
// Attempts to extract envelope format, falls back to legacy formats
func FromMap(data map[string]interface{}) *DataEnvelope {
	envelope := &DataEnvelope{
		Data: make([]map[string]interface{}, 0),
		Metadata: Metadata{
			Schema: DataSchema{
				Fields:      make([]FieldDefinition, 0),
				SourceNodes: make([]string, 0),
			},
			Sources: make([]string, 0),
			Custom:  make(map[string]interface{}),
		},
	}

	// Try to extract data array
	if dataArray, ok := data["data"].([]interface{}); ok {
		for _, item := range dataArray {
			if record, ok := item.(map[string]interface{}); ok {
				envelope.Data = append(envelope.Data, record)
			}
		}
	} else if recordsArray, ok := data["records"].([]interface{}); ok {
		// Legacy format: {records: [...]}
		for _, item := range recordsArray {
			if record, ok := item.(map[string]interface{}); ok {
				envelope.Data = append(envelope.Data, record)
			}
		}
	}

	// Try to extract metadata
	if metadataMap, ok := data["metadata"].(map[string]interface{}); ok {
		if nodeID, ok := metadataMap["node_id"].(string); ok {
			envelope.Metadata.NodeID = nodeID
		}
		if nodeType, ok := metadataMap["node_type"].(string); ok {
			envelope.Metadata.NodeType = nodeType
		}
		if recordCount, ok := metadataMap["record_count"].(float64); ok {
			envelope.Metadata.RecordCount = int(recordCount)
		} else if recordCount, ok := metadataMap["record_count"].(int); ok {
			envelope.Metadata.RecordCount = recordCount
		}
		if schemaMap, ok := metadataMap["schema"].(map[string]interface{}); ok {
			envelope.Metadata.Schema = parseSchemaFromMap(schemaMap)
		}
	} else {
		// Legacy format: infer metadata from data structure
		envelope.Metadata.RecordCount = len(envelope.Data)
		if collection, ok := data["collection"].(string); ok {
			envelope.Metadata.Custom["collection"] = collection
		}
		if total, ok := data["total"].(float64); ok {
			envelope.Metadata.Custom["total"] = total
		} else if total, ok := data["total"].(int); ok {
			envelope.Metadata.Custom["total"] = total
		}
	}

	return envelope
}

// parseSchemaFromMap parses a schema from a map representation
func parseSchemaFromMap(schemaMap map[string]interface{}) DataSchema {
	schema := DataSchema{
		Fields:      make([]FieldDefinition, 0),
		SourceNodes: make([]string, 0),
	}

	if fieldsArray, ok := schemaMap["fields"].([]interface{}); ok {
		for _, fieldItem := range fieldsArray {
			if fieldMap, ok := fieldItem.(map[string]interface{}); ok {
				field := FieldDefinition{}
				if name, ok := fieldMap["name"].(string); ok {
					field.Name = name
				}
				if fieldType, ok := fieldMap["type"].(string); ok {
					field.Type = fieldType
				}
				if sourceNode, ok := fieldMap["source_node"].(string); ok {
					field.SourceNode = sourceNode
				}
				if nullable, ok := fieldMap["nullable"].(bool); ok {
					field.Nullable = nullable
				}
				if desc, ok := fieldMap["description"].(string); ok {
					field.Description = desc
				}
				schema.Fields = append(schema.Fields, field)
			}
		}
	}

	if sourceNodesArray, ok := schemaMap["source_nodes"].([]interface{}); ok {
		for _, nodeID := range sourceNodesArray {
			if nodeIDStr, ok := nodeID.(string); ok {
				schema.SourceNodes = append(schema.SourceNodes, nodeIDStr)
			}
		}
	}

	return schema
}



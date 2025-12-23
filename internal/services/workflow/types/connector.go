package types

import (
	"context"
)

// ConnectorType defines the type of a connector
type ConnectorType string

const (
	SourceConnector      ConnectorType = "source"
	DestinationConnector ConnectorType = "destination"
	ProcessorConnector   ConnectorType = "processor"
)

// Connector is the interface that defines a source or destination connector
type Connector interface {
	// ID returns the unique identifier of the connector
	ID() string
	
	// Name returns the display name of the connector
	Name() string
	
	// Type returns the connector type (source or destination)
	Type() ConnectorType
	
	// Configure sets up the connector with the provided configuration
	Configure(config map[string]interface{}) error
	
	// GetConfigSchema returns the configuration schema for the connector
	GetConfigSchema() map[string]interface{}
	
	// Execute runs the connector with the provided input
	// For source connectors, input may be empty or contain trigger parameters
	// For processor connectors, input contains the data to process
	// For destination connectors, input contains the data to store/send
	Execute(ctx context.Context, input map[string]interface{}) (map[string]interface{}, error)
}

// BaseConnector provides common functionality for connectors
type BaseConnector struct {
	ConnID        string
	ConnName      string
	ConnType      ConnectorType
	Config        map[string]interface{}
	ConfigSchema  map[string]interface{}
}

// ID returns the connector ID
func (b *BaseConnector) ID() string {
	return b.ConnID
}

// Name returns the connector name
func (b *BaseConnector) Name() string {
	return b.ConnName
}

// Type returns the connector type
func (b *BaseConnector) Type() ConnectorType {
	return b.ConnType
}

// Configure sets the connector configuration
func (b *BaseConnector) Configure(config map[string]interface{}) error {
	b.Config = config
	return nil
}

// GetConfigSchema returns the configuration schema
func (b *BaseConnector) GetConfigSchema() map[string]interface{} {
	return b.ConfigSchema
}

// SchemaAwareConnector extends the Connector interface with schema awareness
// Connectors that implement this interface can declare their output schema
// and validate input schema compatibility
type SchemaAwareConnector interface {
	Connector
	// GetOutputSchema returns the schema this connector produces given an input schema
	// For source connectors, inputSchema will be nil
	// For processor/destination connectors, inputSchema contains the upstream schema
	GetOutputSchema(inputSchema *DataSchema) (*DataSchema, error)
	// ValidateInputSchema validates if the provided input schema is compatible
	// Returns nil if compatible, error if incompatible
	ValidateInputSchema(schema *DataSchema) error
} 
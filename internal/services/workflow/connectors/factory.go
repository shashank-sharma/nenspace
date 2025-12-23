package connectors

import (
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

// RegisterAllConnectors registers all available connectors with the registry
func RegisterAllConnectors(registry types.ConnectorRegistry) {
	// Register source connectors
	registry.Register("csv_source", func() types.Connector { return NewCSVSourceConnector() })
	registry.Register("http_source", func() types.Connector { return NewHTTPSourceConnector() })
	registry.Register("gmail_source", func() types.Connector { return NewGmailSourceConnector() })
	registry.Register("pocketbase_source", func() types.Connector { return NewPocketBaseSourceConnector() })
	
	// Register processor connectors
	registry.Register("pb_to_csv_converter", func() types.Connector { return NewPBToCsvConverter() })
	registry.Register("transform_processor", func() types.Connector { return NewTransformConnector() })
	registry.Register("script_processor", func() types.Connector { return NewScriptConnector() })
	
	// Register destination connectors
	registry.Register("csv_destination", func() types.Connector { return NewCSVDestinationConnector() })
	// HTTP destination connector not yet implemented
	// registry.Register("http_destination", func() types.Connector { return NewHTTPDestinationConnector() })
	
	// Note: file_source, transform_processor, and log_destination are defined
	// in the workflow package and will be registered separately
	
	logger.LogInfo("All connectors registered successfully")
} 
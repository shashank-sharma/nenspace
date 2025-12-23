package workflow

import (
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

// RegisterLocalConnectors registers local connectors with the registry
func RegisterLocalConnectors(registry types.ConnectorRegistry) {
	// Register local connectors
	registry.Register("file_source", NewFileSourceConnector)
	// transform_processor is now registered in connectors package
	registry.Register("log_destination", NewLogDestinationConnector)
	
	logger.LogInfo("Registered local workflow connectors")
}

// GetAvailableConnectors returns a list of all available connectors with their metadata
// This function is kept for backward compatibility
func GetAvailableConnectors() []map[string]interface{} {
	registry := NewConnectorRegistryImpl()
	RegisterLocalConnectors(registry) // Only register local connectors
	
	// Get connector IDs
	connectorIDs := registry.GetAvailableConnectors()
	
	// Convert to richer metadata format
	results := make([]map[string]interface{}, 0, len(connectorIDs))
	
	for _, id := range connectorIDs {
		connector := registry.Get(id)
		if connector != nil {
			results = append(results, map[string]interface{}{
				"id":           connector.ID(),
				"name":         connector.Name(),
				"type":         connector.Type(),
				"configSchema": connector.GetConfigSchema(),
			})
		}
	}
	
	return results
} 
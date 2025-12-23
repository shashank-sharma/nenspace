package vectorsearch

import (
	"context"
	"fmt"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/shashank-sharma/backend/internal/logger"
)

// InitVectorSearch initializes the vector search service and registers it with the app
func InitVectorSearch(app *pocketbase.PocketBase, options ServiceOptions) {
	if app == nil {
		logger.LogError("Cannot initialize vector search with nil app")
		return
	}

	service, err := NewVectorSearchService(app, options)
	if err != nil {
		logger.LogError(fmt.Sprintf("Failed to create vector search service: %v", err))
		return
	}

	// Initialize in a goroutine so it doesn't block app startup
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		if err := service.Initialize(ctx); err != nil {
			logger.LogError(fmt.Sprintf("Failed to initialize vector search service: %v", err))
			return
		}

		// Register collections
		if options.Collections != nil {
			for collName, config := range options.Collections {
				if err := service.RegisterCollection(ctx, collName, config.Fields); err != nil {
					logger.LogWarning(fmt.Sprintf("Failed to register collection %s: %v", collName, err))
				}
			}
		}

		logger.LogInfo("Vector search service initialized and ready")
	}()
} 
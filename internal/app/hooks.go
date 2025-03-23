package app

import (
	"context"
	"fmt"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/shashank-sharma/backend/internal/logger"
)

// SearchHookConfig holds configuration for search-related hooks
type SearchHookConfig struct {
	CollectionName  string
	CollectionField string
	EventType       string
}

// registerHooks sets up all application event handlers
func (app *Application) registerHooks() {
	app.registerTerminationHooks()
	app.registerTokenEncryptionHooks()
	
	if app.SearchService != nil {
		app.registerSearchHooks()
	}
}

// registerTerminationHooks sets up handlers for application termination
func (app *Application) registerTerminationHooks() {
	app.Pb.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		if app.ContainerService != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			
			logger.LogInfo("Shutting down container service...")
			if err := app.ContainerService.ShutdownAll(ctx); err != nil {
				logger.LogError("Error shutting down container service: %v", err)
			}
		}
		return e.Next()
	})
	
	app.Pb.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		logger.LogInfo("Application shutting down...")
		logger.Cleanup()
		return nil
	})
}

// registerTokenEncryptionHooks sets up token encryption/decryption handlers
func (app *Application) registerTokenEncryptionHooks() {
	app.Pb.OnRecordCreate("tokens").BindFunc(func(e *core.RecordEvent) error {
		return app.encryptTokens(e)
	})

	app.Pb.OnRecordViewRequest("tokens").BindFunc(func(e *core.RecordRequestEvent) error {
		return app.decryptTokens(e)
	})

	app.Pb.OnRecordUpdate("tokens").BindFunc(func(e *core.RecordEvent) error {
		return app.encryptTokens(e)
	})
}

// encryptTokens encrypts access and refresh tokens in a record
func (app *Application) encryptTokens(e *core.RecordEvent) error {
	encryptionKey := app.Pb.Store().Get("ENCRYPTION_KEY").(string)
	
	if accessToken := e.Record.GetString("access_token"); accessToken != "" {
		encrypted, err := security.Encrypt([]byte(accessToken), encryptionKey)
		if err != nil {
			return fmt.Errorf("failed to encrypt access_token: %w", err)
		}
		e.Record.Set("access_token", encrypted)
	}

	if refreshToken := e.Record.GetString("refresh_token"); refreshToken != "" {
		encrypted, err := security.Encrypt([]byte(refreshToken), encryptionKey)
		if err != nil {
			return fmt.Errorf("failed to encrypt refresh_token: %w", err)
		}
		e.Record.Set("refresh_token", encrypted)
	}

	return e.Next()
}

// decryptTokens decrypts access and refresh tokens in a record
func (app *Application) decryptTokens(e *core.RecordRequestEvent) error {
	encryptionKey := app.Pb.Store().Get("ENCRYPTION_KEY").(string)
	
	if encryptedToken := e.Record.GetString("access_token"); encryptedToken != "" {
		decrypted, err := security.Decrypt(encryptedToken, encryptionKey)
		if err != nil {
			logger.LogError("Failed to decrypt access_token: %v", err)
			e.Record.Set("access_token", "[decryption failed]")
		} else {
			e.Record.Set("access_token", decrypted)
		}
	}

	if encryptedToken := e.Record.GetString("refresh_token"); encryptedToken != "" {
		decrypted, err := security.Decrypt(encryptedToken, encryptionKey)
		if err != nil {
			logger.LogError("Failed to decrypt refresh_token: %v", err)
			e.Record.Set("refresh_token", "[decryption failed]")
		} else {
			e.Record.Set("refresh_token", decrypted)
		}
	}

	return e.Next()
}

// processCollectionFTSAction handles common FTS actions for a collection
func (app *Application) processCollectionFTSAction(collectionName string, action string) error {
	searchService := app.SearchService
	
	if collectionName == "" {
		return nil
	}
	
	shouldProcess := false
	for _, col := range searchService.GetSupportedCollections() {
		if col == collectionName {
			shouldProcess = true
			break
		}
	}
	
	if !shouldProcess {
		return nil
	}
	
	switch action {
	case "create":
		logger.LogInfo(fmt.Sprintf("Creating FTS for collection: %s", collectionName))
		if err := searchService.CreateCollectionFTS(collectionName); err != nil {
			logger.LogError(fmt.Sprintf("Failed to create FTS for collection %s: %v", collectionName, err))
			return err
		}
	case "recreate":
		logger.LogInfo(fmt.Sprintf("Recreating FTS for collection: %s", collectionName))
		if err := searchService.DeleteCollectionFTS(collectionName); err != nil {
			logger.LogError(fmt.Sprintf("Failed to delete FTS for collection %s: %v", collectionName, err))
			return err
		}
		if err := searchService.CreateCollectionFTS(collectionName); err != nil {
			logger.LogError(fmt.Sprintf("Failed to recreate FTS for collection %s: %v", collectionName, err))
			return err
		}
	case "delete":
		logger.LogInfo(fmt.Sprintf("Removing FTS for collection: %s", collectionName))
		if err := searchService.DeleteCollectionFTS(collectionName); err != nil {
			logger.LogError(fmt.Sprintf("Failed to delete FTS for collection %s: %v", collectionName, err))
			return err
		}
	default:
		return fmt.Errorf("unknown FTS action: %s", action)
	}
	
	return nil
}

// registerSearchHooks sets up event handlers for the full-text search service
func (app *Application) registerSearchHooks() {
	searchService := app.SearchService
	
	app.Pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		logger.LogInfo("Initializing full-text search tables")
		for _, col := range searchService.GetSupportedCollections() {
			if err := app.processCollectionFTSAction(col, "create"); err != nil {
				logger.LogError(fmt.Sprintf("Error initializing FTS for collection %s: %v", col, err))
			}
		}
		return e.Next()
	})
	
	app.Pb.OnRecordCreate("_collections").BindFunc(func(e *core.RecordEvent) error {
		collectionName := e.Record.GetString("name")
		_ = app.processCollectionFTSAction(collectionName, "create")
		return e.Next()
	})
	
	app.Pb.OnRecordUpdate("_collections").BindFunc(func(e *core.RecordEvent) error {
		collectionName := e.Record.GetString("name")
		_ = app.processCollectionFTSAction(collectionName, "recreate")
		return e.Next()
	})
	
	app.Pb.OnRecordDeleteRequest("_collections").BindFunc(func(e *core.RecordRequestEvent) error {
		collectionName := e.Record.GetString("name")
		_ = app.processCollectionFTSAction(collectionName, "delete")
		return e.Next()
	})
}

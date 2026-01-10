package search

import (
	"fmt"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/search"
)

func RegisterSearchHooks(pb *pocketbase.PocketBase, ss *search.FullTextSearchService) {
	if ss == nil {
		return
	}

	pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		logger.LogInfo("Initializing full-text search tables")
		for _, col := range ss.GetSupportedCollections() {
			if err := processCollectionFTSAction(ss, col, "create"); err != nil {
				logger.LogError(fmt.Sprintf("Error initializing FTS for collection %s: %v", col, err))
			}
		}
		return e.Next()
	})

	pb.OnRecordCreate("_collections").BindFunc(func(e *core.RecordEvent) error {
		collectionName := e.Record.GetString("name")
		_ = processCollectionFTSAction(ss, collectionName, "create")
		return e.Next()
	})

	pb.OnRecordUpdate("_collections").BindFunc(func(e *core.RecordEvent) error {
		collectionName := e.Record.GetString("name")
		_ = processCollectionFTSAction(ss, collectionName, "recreate")
		return e.Next()
	})

	pb.OnRecordDeleteRequest("_collections").BindFunc(func(e *core.RecordRequestEvent) error {
		collectionName := e.Record.GetString("name")
		_ = processCollectionFTSAction(ss, collectionName, "delete")
		return e.Next()
	})
}

func processCollectionFTSAction(ss *search.FullTextSearchService, collectionName string, action string) error {
	if collectionName == "" {
		return nil
	}

	shouldProcess := false
	for _, col := range ss.GetSupportedCollections() {
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
		if err := ss.CreateCollectionFTS(collectionName); err != nil {
			logger.LogError(fmt.Sprintf("Failed to create FTS for collection %s: %v", collectionName, err))
			return err
		}
	case "recreate":
		logger.LogInfo(fmt.Sprintf("Recreating FTS for collection: %s", collectionName))
		if err := ss.DeleteCollectionFTS(collectionName); err != nil {
			logger.LogError(fmt.Sprintf("Failed to delete FTS for collection %s: %v", collectionName, err))
			return err
		}
		if err := ss.CreateCollectionFTS(collectionName); err != nil {
			logger.LogError(fmt.Sprintf("Failed to recreate FTS for collection %s: %v", collectionName, err))
			return err
		}
	case "delete":
		logger.LogInfo(fmt.Sprintf("Removing FTS for collection: %s", collectionName))
		if err := ss.DeleteCollectionFTS(collectionName); err != nil {
			logger.LogError(fmt.Sprintf("Failed to delete FTS for collection %s: %v", collectionName, err))
			return err
		}
	default:
		return fmt.Errorf("unknown FTS action: %s", action)
	}

	return nil
}

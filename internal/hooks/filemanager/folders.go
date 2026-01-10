package filemanager

import (
	"fmt"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/hooks/helpers"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/filemanager"
)

func RegisterFolderHooks(pb *pocketbase.PocketBase) {
	pb.OnRecordCreateRequest("folders").BindFunc(func(e *core.RecordRequestEvent) error {
		return validateFolderCreate(e)
	})

	pb.OnRecordUpdateRequest("folders").BindFunc(func(e *core.RecordRequestEvent) error {
		return validateFolderUpdate(e)
	})

	pb.OnRecordDeleteRequest("folders").BindFunc(func(e *core.RecordRequestEvent) error {
		return validateFolderDelete(e)
	})
}

func validateFolderCreate(e *core.RecordRequestEvent) error {
	userId := e.Record.GetString("user")
	if userId == "" {
		return fmt.Errorf("user field is required")
	}

	name := e.Record.GetString("name")
	if name == "" {
		return fmt.Errorf("folder name is required")
	}

	sanitizedName, err := filemanager.SanitizeFilename(name)
	if err != nil {
		return fmt.Errorf("invalid folder name: %w", err)
	}
	e.Record.Set("name", sanitizedName)

	parentId := e.Record.GetString("parent")
	if parentId != "" {
		parentFolder, err := query.FindById[*models.Folder](parentId)
		if err != nil {
			return fmt.Errorf("parent folder not found: %w", err)
		}
		if parentFolder.User != userId {
			return fmt.Errorf("unauthorized access to parent folder")
		}
	}

	return e.Next()
}

func validateFolderUpdate(e *core.RecordRequestEvent) error {
	existingFolder, err := query.FindById[*models.Folder](e.Record.Id)
	if err != nil {
		return fmt.Errorf("folder not found: %w", err)
	}

	userId := existingFolder.User

	if helpers.HasField(e.Record, "user") {
		recordUserId := e.Record.GetString("user")
		if recordUserId != userId {
			return fmt.Errorf("cannot change folder ownership")
		}
	}

	if helpers.HasField(e.Record, "name") {
		name := e.Record.GetString("name")
		sanitizedName, err := filemanager.SanitizeFilename(name)
		if err != nil {
			return fmt.Errorf("invalid folder name: %w", err)
		}
		e.Record.Set("name", sanitizedName)
	}

	return e.Next()
}

func validateFolderDelete(e *core.RecordRequestEvent) error {
	folder, err := query.FindById[*models.Folder](e.Record.Id)
	if err != nil {
		return fmt.Errorf("folder not found: %w", err)
	}

	childFolders, err := query.FindAllByFilter[*models.Folder](map[string]interface{}{
		"user":   folder.User,
		"parent": folder.Id,
	})
	if err == nil && len(childFolders) > 0 {
		return fmt.Errorf("cannot delete folder: it contains subfolders")
	}

	filesInFolder, err := query.FindAllByFilter[*models.File](map[string]interface{}{
		"user":   folder.User,
		"folder": folder.Id,
	})
	if err == nil && len(filesInFolder) > 0 {
		return fmt.Errorf("cannot delete folder: it contains files")
	}

	return e.Next()
}





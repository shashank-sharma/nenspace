package filemanager

import (
	"fmt"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/hooks/helpers"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/filemanager"
)

func RegisterFileHooks(pb *pocketbase.PocketBase) {
	pb.OnRecordCreateRequest("files").BindFunc(func(e *core.RecordRequestEvent) error {
		return validateFileCreate(e)
	})

	pb.OnRecordCreate("files").BindFunc(func(e *core.RecordEvent) error {
		return processFileCreate(e)
	})

	pb.OnRecordUpdateRequest("files").BindFunc(func(e *core.RecordRequestEvent) error {
		return validateFileUpdate(e)
	})

	pb.OnRecordUpdate("files").BindFunc(func(e *core.RecordEvent) error {
		return processFileUpdate(e)
	})

	pb.OnRecordDeleteRequest("files").BindFunc(func(e *core.RecordRequestEvent) error {
		return validateFileDelete(e)
	})

	pb.OnRecordDelete("files").BindFunc(func(e *core.RecordEvent) error {
		return processFileDelete(e)
	})

	pb.OnRecordViewRequest("files").BindFunc(func(e *core.RecordRequestEvent) error {
		return validateFileView(e)
	})
}

func validateFileCreate(e *core.RecordRequestEvent) error {
	userId := e.Record.GetString("user")
	if userId == "" {
		return fmt.Errorf("user field is required")
	}

	filename := e.Record.GetString("filename")
	if filename == "" {
		return fmt.Errorf("filename is required")
	}

	sanitizedFilename, err := filemanager.SanitizeFilename(filename)
	if err != nil {
		return fmt.Errorf("invalid filename: %w", err)
	}
	e.Record.Set("filename", sanitizedFilename)

	originalFilename := e.Record.GetString("original_filename")
	if originalFilename == "" {
		e.Record.Set("original_filename", sanitizedFilename)
	} else {
		sanitizedOriginal, err := filemanager.SanitizeFilename(originalFilename)
		if err == nil {
			e.Record.Set("original_filename", sanitizedOriginal)
		}
	}

	path := e.Record.GetString("path")
	if path != "" {
		sanitizedPath, err := filemanager.SanitizePath(path)
		if err != nil {
			return fmt.Errorf("invalid path: %w", err)
		}

		finalPath, err := filemanager.BuildFilePath(sanitizedPath, sanitizedFilename)
		if err != nil {
			return fmt.Errorf("invalid path: %w", err)
		}
		e.Record.Set("path", finalPath)
	} else {
		e.Record.Set("path", sanitizedFilename)
	}

	fileSize := helpers.GetInt64FromRecord(e.Record, "size")
	if fileSize <= 0 {
		return fmt.Errorf("file size must be greater than 0")
	}

	available, err := filemanager.CheckQuotaAvailable(e.App, userId, fileSize)
	if err != nil {
		logger.LogError("Failed to check quota: %v", err)
		return fmt.Errorf("failed to check quota: %w", err)
	}

	if !available {
		return fmt.Errorf("storage quota exceeded")
	}

	return e.Next()
}

func processFileCreate(e *core.RecordEvent) error {
	userId := e.Record.GetString("user")
	fileSize := helpers.GetInt64FromRecord(e.Record, "size")

	if err := filemanager.UpdateQuotaUsage(e.App, userId, fileSize); err != nil {
		logger.LogError("Failed to update quota after file creation: %v", err)
		return fmt.Errorf("failed to update quota: %w", err)
	}

	return e.Next()
}

func validateFileUpdate(e *core.RecordRequestEvent) error {
	existingFile, err := query.FindById[*models.File](e.Record.Id)
	if err != nil {
		return fmt.Errorf("file not found: %w", err)
	}

	if helpers.HasField(e.Record, "user") {
		recordUserId := e.Record.GetString("user")
		if recordUserId != existingFile.User {
			return fmt.Errorf("cannot change file ownership")
		}
	}

	if helpers.HasField(e.Record, "size") {
		newSize := helpers.GetInt64FromRecord(e.Record, "size")
		if newSize != existingFile.Size {
			return fmt.Errorf("cannot modify file size")
		}
	}

	if helpers.HasField(e.Record, "filename") {
		filename := e.Record.GetString("filename")
		sanitizedFilename, err := filemanager.SanitizeFilename(filename)
		if err != nil {
			return fmt.Errorf("invalid filename: %w", err)
		}
		e.Record.Set("filename", sanitizedFilename)

		if helpers.HasField(e.Record, "path") {
			path := e.Record.GetString("path")
			sanitizedPath, err := filemanager.SanitizePath(path)
			if err != nil {
				return fmt.Errorf("invalid path: %w", err)
			}

			finalPath, err := filemanager.BuildFilePath(sanitizedPath, sanitizedFilename)
			if err != nil {
				return fmt.Errorf("invalid path: %w", err)
			}
			e.Record.Set("path", finalPath)
		}
	}

	if helpers.HasField(e.Record, "path") && !helpers.HasField(e.Record, "filename") {
		path := e.Record.GetString("path")
		if !filemanager.ValidatePath(path) {
			return fmt.Errorf("invalid path")
		}

		sanitizedPath, err := filemanager.SanitizePath(path)
		if err != nil {
			return fmt.Errorf("invalid path: %w", err)
		}
		e.Record.Set("path", sanitizedPath)
	}

	return e.Next()
}

func processFileUpdate(e *core.RecordEvent) error {
	return e.Next()
}

func validateFileDelete(e *core.RecordRequestEvent) error {
	return e.Next()
}

func processFileDelete(e *core.RecordEvent) error {
	userId := e.Record.GetString("user")
	fileSize := helpers.GetInt64FromRecord(e.Record, "size")

	if err := filemanager.UpdateQuotaUsage(e.App, userId, -fileSize); err != nil {
		logger.LogError("Failed to update quota after file deletion: %v", err)
		return fmt.Errorf("failed to update quota: %w", err)
	}

	return e.Next()
}

func validateFileView(e *core.RecordRequestEvent) error {
	return e.Next()
}





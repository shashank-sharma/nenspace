package filemanager

import (
	"archive/zip"
	"fmt"
	"io"
	"path/filepath"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/store"
)

func StreamSelectionAsZip(userId string, folderIds []string, fileIds []string, w io.Writer) error {
	logger.LogInfo("Starting ZIP stream", "userId", userId, "foldersCount", len(folderIds), "filesCount", len(fileIds))

	zw := zip.NewWriter(w)

	filesCol, err := store.GetDao().FindCollectionByNameOrId("files")
	if err != nil {
		logger.LogError("Failed to find files collection", "error", err)
		return fmt.Errorf("failed to find files collection: %w", err)
	}

	totalFiles := 0

	for _, fileId := range fileIds {
		if fileId == "" {
			continue
		}
		file, err := query.FindById[*models.File](fileId)
		if err != nil {
			logger.LogWarning("File not found for zip", "fileId", fileId)
			continue
		}

		if file.User != userId {
			logger.LogWarning("Unauthorized individual file skip", "fileId", fileId, "owner", file.User, "requester", userId)
			continue
		}

		if err := addFileToZip(filesCol.Id, zw, file, ""); err != nil {
			logger.LogError("Error adding individual file to zip", "error", err, "fileId", file.Id)
			continue
		}
		totalFiles++
	}

	for _, folderId := range folderIds {
		if folderId == "" {
			continue
		}
		folder, err := query.FindById[*models.Folder](folderId)
		if err != nil {
			logger.LogWarning("Folder not found for zip", "folderId", folderId)
			continue
		}

		if folder.User != userId {
			logger.LogWarning("Unauthorized folder skip", "folderId", folderId, "owner", folder.User, "requester", userId)
			continue
		}

		count, err := addFolderToZip(filesCol.Id, userId, folder, "", zw)
		if err != nil {
			logger.LogError("Error processing folder for zip", "error", err, "folderId", folder.Id)
			continue
		}
		totalFiles += count
	}

	if err := zw.Close(); err != nil {
		logger.LogError("Error closing zip writer", "error", err)
		return err
	}

	logger.LogInfo("ZIP stream completed successfully", "totalFiles", totalFiles)
	return nil
}

func addFolderToZip(filesColId string, userId string, folder *models.Folder, basePath string, zw *zip.Writer) (int, error) {
	currentZipDir := filepath.Join(basePath, folder.Name)
	fileCount := 0

	files, err := query.FindAllByFilter[*models.File](map[string]interface{}{
		"user":   userId,
		"folder": folder.Id,
	})

	if err == nil && len(files) > 0 {
		for _, file := range files {
			if err := addFileToZip(filesColId, zw, file, currentZipDir); err != nil {
				return fileCount, err
			}
			fileCount++
		}
	}

	subfolders, err := query.FindAllByFilter[*models.Folder](map[string]interface{}{
		"user":   userId,
		"parent": folder.Id,
	})

	if err == nil && len(subfolders) > 0 {
		for _, subfolder := range subfolders {
			count, err := addFolderToZip(filesColId, userId, subfolder, currentZipDir, zw)
			if err != nil {
				return fileCount, err
			}
			fileCount += count
		}
	}

	return fileCount, nil
}

func addFileToZip(filesColId string, zw *zip.Writer, file *models.File, zipDir string) error {
	fs, err := store.GetDao().NewFilesystem()
	if err != nil {
		return fmt.Errorf("failed to initialize filesystem: %w", err)
	}
	defer fs.Close()

	if file.File == "" {
		logger.LogWarning("File field is empty in database record, skipping", "fileId", file.Id)
		return nil
	}

	storagePath := filesColId + "/" + file.Id + "/" + file.File

	src, err := fs.GetReader(storagePath)
	if err != nil {
		src, err = fs.GetReader("files/" + file.Id + "/" + file.File)
		if err != nil {
			logger.LogWarning("File skip: not found in storage", "primaryPath", storagePath, "fileId", file.Id, "error", err)
			return nil
		}
	}
	defer src.Close()

	targetFilename := file.OriginalFilename
	if targetFilename == "" {
		targetFilename = file.Filename
	}
	if targetFilename == "" {
		targetFilename = file.File
	}

	zipPath := filepath.Join(zipDir, targetFilename)

	header := &zip.FileHeader{
		Name:   zipPath,
		Method: zip.Deflate,
	}
	header.Modified = file.Updated.Time()

	writer, err := zw.CreateHeader(header)
	if err != nil {
		return fmt.Errorf("failed to create zip header for %s: %w", zipPath, err)
	}

	if _, err := io.Copy(writer, src); err != nil {
		return fmt.Errorf("failed to copy file %s to zip: %w", zipPath, err)
	}

	return nil
}

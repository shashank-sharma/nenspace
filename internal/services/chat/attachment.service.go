package chat

import (
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

type AttachmentService struct {
	app core.App
}

func NewAttachmentService(app core.App) *AttachmentService {
	return &AttachmentService{
		app: app,
	}
}

func (s *AttachmentService) GetAttachmentsForMessage(messageID string) ([]*models.ChatMessageAttachment, error) {
	attachments, err := query.FindAllByFilter[*models.ChatMessageAttachment](map[string]interface{}{
		"message": messageID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get attachments: %w", err)
	}
	return attachments, nil
}

func (s *AttachmentService) GetAttachmentByID(attachmentID string) (*models.ChatMessageAttachment, error) {
	attachment, err := query.FindById[*models.ChatMessageAttachment](attachmentID)
	if err != nil {
		return nil, fmt.Errorf("attachment not found: %w", err)
	}
	return attachment, nil
}

func (s *AttachmentService) LinkAttachmentsToMessage(attachmentIDs []string, messageID string, userID string) error {
	for _, attachmentID := range attachmentIDs {
		attachment, err := query.FindById[*models.ChatMessageAttachment](attachmentID)
		if err != nil {
			logger.LogWarning("Attachment not found, skipping", "attachmentId", attachmentID, "messageId", messageID)
			continue
		}

		if attachment.User != userID {
			return fmt.Errorf("unauthorized: attachment belongs to different user")
		}

		attachment.MessageID = messageID
		if err := query.SaveRecord(attachment); err != nil {
			return fmt.Errorf("failed to link attachment: %w", err)
		}
	}
	return nil
}

func (s *AttachmentService) DeleteAttachmentsForMessage(messageID string) error {
	attachments, err := s.GetAttachmentsForMessage(messageID)
	if err != nil {
		return err
	}

	for _, attachment := range attachments {
		if err := query.DeleteById[*models.ChatMessageAttachment](attachment.Id); err != nil {
			logger.LogWarning("Failed to delete attachment", "attachmentId", attachment.Id, "error", err)
		}
	}
	return nil
}

func (s *AttachmentService) GetFileURL(attachment *models.ChatMessageAttachment) string {
	if attachment.File == "" {
		return ""
	}
	baseURL := s.app.Settings().Meta.AppURL
	if baseURL == "" {
		baseURL = "http://localhost:8090"
	}
	return fmt.Sprintf("%s/api/files/chat_message_attachments/%s/%s", baseURL, attachment.Id, attachment.File)
}

func (s *AttachmentService) GetFileAsBase64(attachment *models.ChatMessageAttachment) (string, error) {
	if attachment.File == "" {
		return "", fmt.Errorf("attachment has no file")
	}

	collectionName := attachment.TableName()
	filePath := filepath.Join(
		s.app.DataDir(),
		"storage",
		collectionName,
		attachment.Id,
		attachment.File,
	)

	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	fileData, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	base64Data := base64.StdEncoding.EncodeToString(fileData)
	dataURL := fmt.Sprintf("data:%s;base64,%s", attachment.MimeType, base64Data)

	return dataURL, nil
}

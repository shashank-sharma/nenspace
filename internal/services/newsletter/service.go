package newsletter

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

type Service struct{}

func NewService() *Service {
	return &Service{}
}

// GetSettings retrieves newsletter settings for a user
func (s *Service) GetSettings(userId string) (*models.NewsletterSettings, error) {
	settings, err := query.FindByFilter[*models.NewsletterSettings](map[string]interface{}{
		"user": userId,
	})
	if err != nil {
		return nil, err
	}
	return settings, nil
}

// ProcessMailMessage checks if a mail message is a newsletter and processes it
func (s *Service) ProcessMailMessage(userId string, message *models.MailMessage) error {
	settings, err := s.GetSettings(userId)
	if err != nil || !settings.IsEnabled {
		return nil // Detection not enabled for this user
	}

	result, err := DetectNewsletter(userId, message)
	if err != nil {
		return fmt.Errorf("detection failed: %w", err)
	}

	if result.Score < 50 {
		return nil
	}

	senderEmail := ExtractSenderEmail(message.From)

	newsletter, err := query.FindByFilter[*models.Newsletter](map[string]interface{}{
		"user":         userId,
		"sender_email": senderEmail,
	})

	isNew := false
	if err != nil {
		isNew = true
		newsletter = &models.Newsletter{
			User:           userId,
			SenderEmail:    senderEmail,
			SenderName:     ExtractSenderName(message.From),
			Name:           result.Name,
			IsActive:       true,
			DetectionScore: result.Score,
		}
		reasonsJSON, _ := json.Marshal(result.Reasons)
		newsletter.DetectionReasons = string(reasonsJSON)
	}

	CalculateInitialStats(newsletter, message.InternalDate.Time())

	if err := query.SaveRecord(newsletter); err != nil {
		return fmt.Errorf("failed to save newsletter: %w", err)
	}

	link := &models.NewsletterEmail{
		Newsletter:  newsletter.Id,
		MailMessage: message.Id,
	}

	upsertFilter := map[string]interface{}{
		"newsletter":   newsletter.Id,
		"mail_message": message.Id,
	}

	if err := query.UpsertRecord[*models.NewsletterEmail](link, upsertFilter); err != nil {
		return fmt.Errorf("failed to link email: %w", err)
	}

	if isNew {
		// Optional: Log new newsletter detection
	}

	return nil
}

// ExtractSenderName extracts the display name from the "From" header
func ExtractSenderName(from string) string {
	if idx := strings.Index(from, "<"); idx != -1 {
		return strings.TrimSpace(from[:idx])
	}
	return from
}

package mail

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

type LabelInfo struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type LabelsMap map[string]LabelInfo

// FetchLabelsForToken fetches Gmail labels for a given token (without creating/updating mail sync)
func (ms *MailService) FetchLabelsForToken(tokenId string) (string, error) {
	if tokenId == "" {
		return "", fmt.Errorf("token ID cannot be empty")
	}

	// Create a context with timeout for label initialization
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	client, err := ms.FetchClient(ctx, tokenId)
	if err != nil {
		return "", fmt.Errorf("failed to get client: %w", err)
	}

	gmailService, err := ms.GetGmailService(ctx, client)
	if err != nil {
		return "", fmt.Errorf("failed to create Gmail service: %w", err)
	}

	labelsResponse, err := gmailService.Users.Labels.List("me").Do()
	if err != nil {
		return "", fmt.Errorf("failed to fetch labels: %w", err)
	}

	if labelsResponse == nil || len(labelsResponse.Labels) == 0 {
		return "", fmt.Errorf("no labels found")
	}

	labelsMap := make(LabelsMap)
	for _, label := range labelsResponse.Labels {
		if label != nil {
			labelsMap[label.Id] = LabelInfo{
				Name: label.Name,
				Type: label.Type,
			}
		}
	}

	labelsJSON, err := json.Marshal(labelsMap)
	if err != nil {
		return "", fmt.Errorf("failed to marshal labels: %w", err)
	}

	return string(labelsJSON), nil
}

// InitializeLabels fetches and stores all Gmail labels for a user
func (ms *MailService) InitializeLabels(tokenId string, userId string) (*models.MailSync, error) {
	if tokenId == "" {
		return nil, fmt.Errorf("token ID cannot be empty")
	}
	if userId == "" {
		return nil, fmt.Errorf("user ID cannot be empty")
	}

	// Fetch labels using the helper function
	labelsJSON, err := ms.FetchLabelsForToken(tokenId)
	if err != nil {
		return nil, err
	}

	mailSync := &models.MailSync{
		User:     userId,
		Token:    tokenId,
		Provider: "gmail",
		Labels:   string(labelsJSON),
		IsActive: true,
	}

	upsertFilter := map[string]interface{}{
		"user":     userId,
		"provider": "gmail",
	}

	if err := query.UpsertRecord[*models.MailSync](mailSync, upsertFilter); err != nil {
		return nil, fmt.Errorf("failed to create mail sync: %w", err)
	}

	// Parse labels to get count for logging
	var labelsMap LabelsMap
	if err := json.Unmarshal([]byte(labelsJSON), &labelsMap); err == nil {
	logger.LogInfo(fmt.Sprintf("Initialized labels for user %s: %d labels", userId, len(labelsMap)))
	} else {
		logger.LogInfo(fmt.Sprintf("Initialized labels for user %s", userId))
	}
	return mailSync, nil
}

// GetLabels parses and returns the labels map from a MailSync record
func (ms *MailService) GetLabels(mailSync *models.MailSync) (LabelsMap, error) {
	if mailSync == nil {
		return nil, fmt.Errorf("mailSync cannot be nil")
	}

	if mailSync.Labels == "" {
		return make(LabelsMap), nil
	}

	var labelsMap LabelsMap
	err := json.Unmarshal([]byte(mailSync.Labels), &labelsMap)
	if err != nil {
		return nil, fmt.Errorf("failed to parse labels: %w", err)
	}

	return labelsMap, nil
}

// ProcessMessageLabelsResult holds the result of processing message labels
type ProcessMessageLabelsResult struct {
	CustomLabelsJSON string
	IsUnread         bool
	IsImportant      bool
	IsStarred        bool
	IsSpam           bool
	IsInbox          bool
	IsTrash          bool
	IsDraft          bool
	IsSent           bool
}

// ProcessMessageLabels processes label IDs and returns structured label information
func (ms *MailService) ProcessMessageLabels(labelIds []string, mailSync *models.MailSync) (*ProcessMessageLabelsResult, error) {
	if mailSync == nil {
		return nil, fmt.Errorf("mailSync cannot be nil")
	}

	availableLabels, err := ms.GetLabels(mailSync)
	if err != nil {
		return nil, fmt.Errorf("failed to get labels: %w", err)
	}

	result := &ProcessMessageLabelsResult{
		CustomLabelsJSON: "{}",
	}

	customLabels := make(LabelsMap)

	for _, labelId := range labelIds {
		if labelInfo, exists := availableLabels[labelId]; exists {
			switch labelId {
			case labelUNREAD:
				result.IsUnread = true
			case labelIMPORTANT:
				result.IsImportant = true
			case labelSTARRED:
				result.IsStarred = true
			case labelSPAM:
				result.IsSpam = true
			case labelINBOX:
				result.IsInbox = true
			case labelTRASH:
				result.IsTrash = true
			case labelDRAFT:
				result.IsDraft = true
			case labelSENT:
				result.IsSent = true
			default:
				customLabels[labelId] = labelInfo
			}
		}
	}

	if len(customLabels) > 0 {
		customLabelsJSON, err := json.Marshal(customLabels)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal custom labels: %w", err)
		}
		result.CustomLabelsJSON = string(customLabelsJSON)
	}

	return result, nil
}

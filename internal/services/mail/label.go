package mail

import (
	"encoding/json"
	"fmt"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

type LabelInfo struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type LabelsMap map[string]LabelInfo

// InitializeLabels fetches and stores all Gmail labels for a user
func (ms *MailService) InitializeLabels(tokenId string, userId string) (*models.MailSync, error) {
	client, err := ms.FetchClient(tokenId)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %v", err)
	}

	gmailService, err := ms.GetGmailService(client)
	if err != nil {
		logger.LogError("Unable to create Gmail service")
		return nil, err
	}

	labelsResponse, err := gmailService.Users.Labels.List("me").Do()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch labels: %v", err)
	}

	labelsMap := make(LabelsMap)
	for _, label := range labelsResponse.Labels {
		labelsMap[label.Id] = LabelInfo{
			Name: label.Name,
			Type: label.Type,
		}
	}

	labelsJSON, err := json.Marshal(labelsMap)
	if err != nil {
		return nil, fmt.Errorf("error marshaling labels: %v", err)
	}

	// Need a flow to handle 
	mailSync := &models.MailSync{
		User:     userId,
		Token:    tokenId,
		Provider: "gmail",
		Labels:   string(labelsJSON),
		IsActive: true,
	}

	if err := query.UpsertRecord[*models.MailSync](mailSync, map[string]interface{}{
		"user":     userId,
		"provider": "gmail",
	}); err != nil {
		return nil, fmt.Errorf("error creating mail sync: %v", err)
	}

	return mailSync, nil
}

// GetLabels parses and returns the labels map from a MailSync record
func (ms *MailService) GetLabels(mailSync *models.MailSync) (LabelsMap, error) {
	var labelsMap LabelsMap
	err := json.Unmarshal([]byte(mailSync.Labels), &labelsMap)
	if err != nil {
		return nil, fmt.Errorf("error parsing labels: %v", err)
	}
	return labelsMap, nil
}

// ProcessMessageLabels processes label IDs and returns structured label information
func (ms *MailService) ProcessMessageLabels(labelIds []string, mailSync *models.MailSync) (string, bool, bool, bool, bool, bool, bool, bool, bool, error) {
	availableLabels, err := ms.GetLabels(mailSync)
	if err != nil {
		logger.LogError("Error parsing labels:", err)
		return "", false, false, false, false, false, false, false, false, err
	}

	customLabels := make(LabelsMap)
	isUnread := false
	isImportant := false
	isStarred := false
	isSpam := false
	isInbox := false
	isTrash := false
	isDraft := false
	isSent := false

	for _, labelId := range labelIds {
		if labelInfo, exists := availableLabels[labelId]; exists {
			switch labelId {
			case "UNREAD":
				isUnread = true
			case "IMPORTANT":
				isImportant = true
			case "STARRED":
				isStarred = true
			case "SPAM":
				isSpam = true
			case "INBOX":
				isInbox = true
			case "TRASH":
				isTrash = true
			case "DRAFT":
				isDraft = true
			case "SENT":
				isSent = true
			default:
				customLabels[labelId] = labelInfo
			}
		}
	}

	customLabelsJSON, err := json.Marshal(customLabels)
	if err != nil {
		return "", false, false, false, false, false, false, false, false, fmt.Errorf("error marshaling custom labels: %v", err)
	}

	return string(customLabelsJSON), isUnread, isImportant, isStarred, isSpam, isInbox, isTrash, isDraft, isSent, nil
}

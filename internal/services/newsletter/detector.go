package newsletter

import (
	"encoding/json"
	"regexp"
	"strings"

	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

// DetectionResult holds the results of the detection algorithm
type DetectionResult struct {
	Score   int      `json:"score"`
	Reasons []string `json:"reasons"`
	Name    string   `json:"name"`
}

var (
	// Regex for extracting email from "Name <email@example.com>" or just "email@example.com"
	emailRegex = regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)

	// Common newsletter patterns in subjects
	newsletterSubjectPatterns = []string{
		"newsletter", "digest", "weekly", "daily", "monthly", "issue #", "vol.", "roundup", "bulletin",
	}

	// Promotional keywords in body
	promotionalKeywords = []string{
		"view in browser", "click here", "update preferences", "manage subscriptions", "unsubscribe here",
		"read online", "forward to a friend",
	}
)

// DetectNewsletter runs the weighted scoring algorithm on a mail message
func DetectNewsletter(userId string, message *models.MailMessage) (*DetectionResult, error) {
	result := &DetectionResult{
		Reasons: []string{},
	}

	senderEmail := ExtractSenderEmail(message.From)
	if senderEmail == "" {
		return result, nil
	}

	// 1. Recurring Sender (0-25 pts)
	_, score := CheckRecurringSender(userId, senderEmail)
	if score > 0 {
		result.Score += score
		result.Reasons = append(result.Reasons, "recurring_sender")
	}

	// 2. List-Unsubscribe Header (0-25 pts)
	if hasListUnsubscribeHeader(message.ExternalData) {
		result.Score += 25
		result.Reasons = append(result.Reasons, "list_unsubscribe_header")
	}

	// 3. Subject Patterns (0-20 pts)
	subjectLower := strings.ToLower(message.Subject)
	for _, pattern := range newsletterSubjectPatterns {
		if strings.Contains(subjectLower, pattern) {
			result.Score += 20
			result.Reasons = append(result.Reasons, "subject_pattern")
			break
		}
	}

	// 4. Unsubscribe Link in Body (0-15 pts)
	bodyLower := strings.ToLower(message.Body)
	if strings.Contains(bodyLower, "unsubscribe") {
		result.Score += 15
		result.Reasons = append(result.Reasons, "unsubscribe_link")
	}

	// 5. Promotional Keywords (0-10 pts)
	for _, kw := range promotionalKeywords {
		if strings.Contains(bodyLower, kw) {
			result.Score += 10
			result.Reasons = append(result.Reasons, "promotional_keywords")
			break
		}
	}

	// 6. HTML Template Indicators (0-5 pts)
	if strings.Contains(bodyLower, "<table") || strings.Contains(bodyLower, "display:none") {
		result.Score += 5
		result.Reasons = append(result.Reasons, "html_template")
	}

	// Extract or generate a name for the newsletter
	result.Name = ExtractNewsletterName(message.Subject, senderEmail)

	return result, nil
}

// ExtractSenderEmail normalizes and extracts the sender email address
func ExtractSenderEmail(from string) string {
	match := emailRegex.FindString(from)
	return strings.ToLower(strings.TrimSpace(match))
}

// ExtractNewsletterName attempts to extract a clean name for the newsletter
func ExtractNewsletterName(subject string, senderEmail string) string {
	// Try to get domain name as fallback
	parts := strings.Split(senderEmail, "@")
	domain := ""
	if len(parts) > 1 {
		domainParts := strings.Split(parts[1], ".")
		if len(domainParts) > 0 {
			domain = strings.Title(domainParts[0])
		}
	}

	// If subject is empty, use domain
	if subject == "" {
		return domain
	}

	// Simple cleaning of subject to use as name if it looks like a title
	// e.g. "The Daily Brew: January 11" -> "The Daily Brew"
	cleanName := subject
	delimiters := []string{":", "-", "|", "#"}
	for _, d := range delimiters {
		if idx := strings.Index(cleanName, d); idx != -1 {
			candidate := strings.TrimSpace(cleanName[:idx])
			if len(candidate) > 3 {
				cleanName = candidate
			}
		}
	}

	if len(cleanName) > 50 {
		cleanName = cleanName[:50]
	}

	return strings.TrimSpace(cleanName)
}

// CheckRecurringSender queries the database for other emails from the same sender
func CheckRecurringSender(userId string, senderEmail string) (int, int) {
	filter := map[string]interface{}{
		"user": userId,
		"from": map[string]interface{}{"like": "%" + senderEmail + "%"},
	}

	count, err := query.CountRecords[*models.MailMessage](filter)
	if err != nil {
		return 0, 0
	}

	if count >= 3 {
		return int(count), 25
	} else if count >= 2 {
		return int(count), 15
	}

	return int(count), 0
}

// hasListUnsubscribeHeader checks if the List-Unsubscribe header is present in external_data
func hasListUnsubscribeHeader(externalData string) bool {
	if externalData == "" {
		return false
	}

	var data map[string]interface{}
	if err := json.Unmarshal([]byte(externalData), &data); err != nil {
		return false
	}

	// In the Gmail service, we store labels and other metadata in external_data.
	// We might need to check if we actually have headers there.
	// Looking back at internal/services/mail/message.go, we store history_id, label_ids, etc.
	// We might need to ensure headers are stored too if we want this to be robust.
	// For now, let's assume it might be there if we enhance the mail service later.
	
	// Check if "label_ids" contains specific system labels that might indicate newsletters
	if labels, ok := data["label_ids"].([]interface{}); ok {
		for _, l := range labels {
			if l == "CATEGORY_PROMOTIONS" || l == "CATEGORY_UPDATES" {
				return true
			}
		}
	}

	return false
}


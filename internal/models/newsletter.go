package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*NewsletterSettings)(nil)
var _ core.Model = (*Newsletter)(nil)
var _ core.Model = (*NewsletterEmail)(nil)

type NewsletterSettings struct {
	BaseModel

	User                string         `db:"user" json:"user"`
	IsEnabled           bool           `db:"is_enabled" json:"is_enabled"`
	ScanStatus          string         `db:"scan_status" json:"scan_status"`           // pending, scanning, completed, failed
	TotalMessages       int            `db:"total_messages" json:"total_messages"`
	ProcessedMessages   int            `db:"processed_messages" json:"processed_messages"`
	DetectedNewsletters int            `db:"detected_newsletters" json:"detected_newsletters"`
	LastScannedId       string         `db:"last_scanned_id" json:"last_scanned_id"`   // Checkpoint for resume
	ErrorMessage        string         `db:"error_message" json:"error_message"`
	ScanStartedAt       types.DateTime `db:"scan_started_at" json:"scan_started_at"`
	ScanCompletedAt     types.DateTime `db:"scan_completed_at" json:"scan_completed_at"`
}

type Newsletter struct {
	BaseModel

	User             string         `db:"user" json:"user"`
	SenderEmail      string         `db:"sender_email" json:"sender_email"`
	SenderName       string         `db:"sender_name" json:"sender_name"`
	Name             string         `db:"name" json:"name"`
	FirstSeen        types.DateTime `db:"first_seen" json:"first_seen"`
	LastSeen         types.DateTime `db:"last_seen" json:"last_seen"`
	TotalCount       int            `db:"total_count" json:"total_count"`
	FrequencyDays    float64        `db:"frequency_days" json:"frequency_days"`
	IsActive         bool           `db:"is_active" json:"is_active"`
	DetectionScore   int            `db:"detection_score" json:"detection_score"`
	DetectionReasons string         `db:"detection_reasons" json:"detection_reasons"` // JSON array
}

type NewsletterEmail struct {
	BaseModel

	Newsletter  string `db:"newsletter" json:"newsletter"`
	MailMessage string `db:"mail_message" json:"mail_message"`
}

func (m *NewsletterSettings) TableName() string {
	return "newsletter_settings"
}

func (m *Newsletter) TableName() string {
	return "newsletters"
}

func (m *NewsletterEmail) TableName() string {
	return "newsletter_emails"
}


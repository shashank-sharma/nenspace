package models

import (
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ Model = (*Cron)(nil)
var _ Model = (*CronExecution)(nil)

type Cron struct {
	BaseModel

	User                string          `db:"user" json:"user"`
	Name                string          `db:"name" json:"name"`
	Description         string          `db:"description" json:"description"`
	Schedule            string          `db:"schedule" json:"schedule"`
	WebhookURL          string          `db:"webhook_url" json:"webhook_url"`
	WebhookMethod       string          `db:"webhook_method" json:"webhook_method"`
	WebhookHeaders      types.JSONRaw   `db:"webhook_headers" json:"webhook_headers"`
	WebhookPayload      types.JSONRaw   `db:"webhook_payload" json:"webhook_payload"`
	IsActive            bool            `db:"is_active" json:"is_active"`
	IsSystem            bool            `db:"is_system" json:"is_system"`
	SystemType          string          `db:"system_type" json:"system_type"`
	LastRun             types.DateTime  `db:"last_run" json:"last_run"`
	NextRun             types.DateTime  `db:"next_run" json:"next_run"`
	TimeoutSeconds      int             `db:"timeout_seconds" json:"timeout_seconds"`
	NotifyOnSuccess     bool            `db:"notify_on_success" json:"notify_on_success"`
	NotifyOnFailure     bool            `db:"notify_on_failure" json:"notify_on_failure"`
	NotificationWebhook string          `db:"notification_webhook" json:"notification_webhook"`
	MaxRetries          int             `db:"max_retries" json:"max_retries"`
	RetryDelaySeconds   int             `db:"retry_delay_seconds" json:"retry_delay_seconds"`
}

func (m *Cron) TableName() string {
	return "crons"
}

type CronExecution struct {
	BaseModel

	Cron            string          `db:"cron" json:"cron"`
	User            string          `db:"user" json:"user"`
	Status          string          `db:"status" json:"status"`
	StartedAt       types.DateTime  `db:"started_at" json:"started_at"`
	CompletedAt     types.DateTime  `db:"completed_at" json:"completed_at"`
	DurationMs      int64           `db:"duration_ms" json:"duration_ms"`
	HTTPStatus      int             `db:"http_status" json:"http_status"`
	RequestURL      string          `db:"request_url" json:"request_url"`
	RequestMethod   string          `db:"request_method" json:"request_method"`
	RequestHeaders  types.JSONRaw   `db:"request_headers" json:"request_headers"`
	RequestPayload  types.JSONRaw   `db:"request_payload" json:"request_payload"`
	ResponseHeaders types.JSONRaw   `db:"response_headers" json:"response_headers"`
	ResponseBody    string          `db:"response_body" json:"response_body"`
	ErrorMessage    string          `db:"error_message" json:"error_message"`
	ErrorStack      string          `db:"error_stack" json:"error_stack"`
	RetryCount      int             `db:"retry_count" json:"retry_count"`
	IsRetry         bool            `db:"is_retry" json:"is_retry"`
	Metadata        types.JSONRaw   `db:"metadata" json:"metadata"`
}

func (m *CronExecution) TableName() string {
	return "cron_executions"
}

package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*MailSync)(nil)
var _ core.Model = (*MailMessage)(nil)

type MailSync struct {
	BaseModel

	User                   string         `db:"user" json:"user"`
	Token                  string         `db:"token" json:"token"`
	Provider               string         `db:"provider" json:"provider"`
	Labels                 string         `db:"labels" json:"labels"`
	LastSyncState          string         `db:"last_sync_state" json:"last_sync_state"`                     // History ID for incremental sync
	LastFullSyncCheckpoint types.DateTime `db:"last_full_sync_checkpoint" json:"last_full_sync_checkpoint"` // Oldest message date processed during full sync
	SyncStatus             string         `db:"sync_status" json:"sync_status"`
	LastError              string         `db:"last_error" json:"last_error"`
	IsActive               bool           `db:"is_active" json:"is_active"`
	LastSynced             types.DateTime `db:"last_synced" json:"last_synced"`
}

type MailMessage struct {
	BaseModel

	User         string         `db:"user" json:"user"`
	MailSync     string         `db:"mail_sync" json:"mail_sync"`
	MessageId    string         `db:"message_id" json:"message_id"`
	ThreadId     string         `db:"thread_id" json:"thread_id"`
	From         string         `db:"from" json:"from"`
	To           string         `db:"to" json:"to"`
	Subject      string         `db:"subject" json:"subject"`
	Snippet      string         `db:"snippet" json:"snippet"`
	Body         string         `db:"body" json:"body"`
	IsUnread     bool           `db:"is_unread" json:"is_unread"`
	IsImportant  bool           `db:"is_important" json:"is_important"`
	IsStarred    bool           `db:"is_starred" json:"is_starred"`
	IsSpam       bool           `db:"is_spam" json:"is_spam"`
	IsInbox      bool           `db:"is_inbox" json:"is_inbox"`
	IsTrash      bool           `db:"is_trash" json:"is_trash"`
	IsDraft      bool           `db:"is_draft" json:"is_draft"`
	IsSent       bool           `db:"is_sent" json:"is_sent"`
	InternalDate types.DateTime `db:"internal_date" json:"internal_date"`
	ReceivedDate types.DateTime `db:"received_date" json:"received_date"`
	ExternalData string         `db:"external_data" json:"external_data"`
}

func (m *MailSync) TableName() string {
	return "mail_sync"
}

func (m *MailMessage) TableName() string {
	return "mail_messages"
}

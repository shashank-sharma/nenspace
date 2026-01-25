package models

import "github.com/pocketbase/pocketbase/core"

var _ core.Model = (*ChatMessageAttachment)(nil)

type ChatMessageAttachment struct {
	BaseModel

	MessageID string `db:"message" json:"message"`
	User      string `db:"user" json:"user"`
	File      string `db:"file" json:"file"`
	Filename  string `db:"filename" json:"filename"`
	MimeType  string `db:"mime_type" json:"mime_type"`
	Size      int64  `db:"size" json:"size"`
}

func (m *ChatMessageAttachment) TableName() string {
	return "chat_message_attachments"
}

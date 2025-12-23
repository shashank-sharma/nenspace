package models

import "github.com/pocketbase/pocketbase/tools/types"

var _ Model = (*StreamEntry)(nil)

type StreamEntry struct {
	BaseModel

	User          string         `db:"user" json:"user"`
	Content       string         `db:"content" json:"content"`
	Title         string         `db:"title" json:"title"`
	EntryDate     types.DateTime `db:"entry_date" json:"entry_date"`
	EntryType     string         `db:"entry_type" json:"entry_type"`
	EntryColor    string         `db:"entry_color" json:"entry_color"`
	IsHighlighted bool           `db:"is_highlighted" json:"is_highlighted"`
	ParentEntry   string         `db:"parent_entry" json:"parent_entry"`
	AIContext     types.JSONRaw  `db:"ai_context" json:"ai_context"`
}

func (m *StreamEntry) TableName() string {
	return "stream_entries"
}

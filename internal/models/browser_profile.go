package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*BrowserProfile)(nil)

type BrowserProfile struct {
	BaseModel
	User      string         `db:"user" json:"user"`
	Name      string         `db:"name" json:"name"`
	UserAgent string         `db:"user_agent" json:"user_agent"`
	Platform  string         `db:"platform" json:"platform"`
	IsActive  bool           `db:"is_active" json:"is_active"`
	LastUsed  types.DateTime `db:"last_used" json:"last_used"`
}

func (m *BrowserProfile) TableName() string {
	return "browser_profiles"
}

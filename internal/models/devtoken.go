package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*DevToken)(nil)

type DevToken struct {
	BaseModel

	User       string         `db:"user" json:"user"`
	Token      string         `db:"token" json:"token"`
	Name       string         `db:"name" json:"name"`
	IsActive   bool           `db:"is_active" json:"is_active"`
	ExpiresAt  types.DateTime `db:"expires_at" json:"expires_at"`
	LastUsedAt types.DateTime `db:"last_used_at" json:"last_used_at"`
}

func (m *DevToken) TableName() string {
	return "dev_tokens"
}

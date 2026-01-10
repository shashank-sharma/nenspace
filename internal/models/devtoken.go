package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*DevToken)(nil)

type DevToken struct {
	BaseModel

	User            string         `db:"user" json:"user"`
	Token           string         `db:"token" json:"token"`
	Name            string         `db:"name" json:"name"`
	Environment     string         `db:"environment" json:"environment"`
	IsActive        bool           `db:"is_active" json:"is_active"`
	TotalRequests   int            `db:"total_requests" json:"total_requests"`
	LastUsedAt      types.DateTime `db:"last_used_at" json:"last_used_at"`
	TotalTokensUsed int            `db:"total_tokens_used" json:"total_tokens_used"`
	SuccessRate     float64        `db:"success_rate" json:"success_rate"`
}

func (m *DevToken) TableName() string {
	return "dev_tokens"
}

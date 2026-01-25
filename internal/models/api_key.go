package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*ApiKey)(nil)

type ApiKey struct {
	BaseModel

	User        string         `db:"user" json:"user"`
	Name        string         `db:"name" json:"name"`
	Description string         `db:"description" json:"description"`
	Service     string         `db:"service" json:"service"`
	Key         string         `db:"key" json:"key"`
	Secret      string         `db:"secret" json:"secret"`
	Scopes      types.JSONRaw  `db:"scopes" json:"scopes"`
	IsActive    bool           `db:"is_active" json:"is_active"`
	Expires     types.DateTime `db:"expires" json:"expires"`
}

func (m *ApiKey) TableName() string {
	return "api_keys"
}

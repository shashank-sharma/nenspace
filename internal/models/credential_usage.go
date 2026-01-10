package models

import (
	"github.com/pocketbase/pocketbase/tools/types"
)

type CredentialUsage struct {
	BaseModel
	User              string         `db:"user" json:"user"`
	CredentialType    string         `db:"credential_type" json:"credential_type"`
	CredentialID      string         `db:"credential_id" json:"credential_id"`
	Service           string         `db:"service" json:"service"`
	Endpoint          string         `db:"endpoint" json:"endpoint"`
	Method            string         `db:"method" json:"method"`
	StatusCode        int            `db:"status_code" json:"status_code"`
	ResponseTimeMS    float64        `db:"response_time_ms" json:"response_time_ms"`
	TokensUsed        float64        `db:"tokens_used" json:"tokens_used"`
	RequestSizeBytes  float64        `db:"request_size_bytes" json:"request_size_bytes"`
	ResponseSizeBytes float64        `db:"response_size_bytes" json:"response_size_bytes"`
	ErrorType         string         `db:"error_type" json:"error_type"`
	ErrorMessage      string         `db:"error_message" json:"error_message"`
	Timestamp         types.DateTime `db:"timestamp" json:"timestamp"`
	Metadata          types.JSONRaw  `db:"metadata" json:"metadata"`
}

func (m *CredentialUsage) TableName() string {
	return "credential_usage"
}

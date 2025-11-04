package query

import (
	"github.com/pocketbase/dbx"
)

// BaseFilter represents common filter fields used across multiple models
type BaseFilter struct {
	ID       string `json:"id,omitempty"`
	User     string `json:"user,omitempty"`
	IsActive *bool  `json:"is_active,omitempty"`
}

// ToMap converts BaseFilter to map[string]interface{} for compatibility
func (f *BaseFilter) ToMap() map[string]interface{} {
	result := make(map[string]interface{})
	if f.ID != "" {
		result["id"] = f.ID
	}
	if f.User != "" {
		result["user"] = f.User
	}
	if f.IsActive != nil {
		result["is_active"] = *f.IsActive
	}
	return result
}

// ToHashExp converts BaseFilter to dbx.HashExp for query building
func (f *BaseFilter) ToHashExp() dbx.HashExp {
	return dbx.HashExp(f.ToMap())
}

// FeedSourceFilter represents filter criteria for feed sources
type FeedSourceFilter struct {
	BaseFilter
	Type     string `json:"type,omitempty"`
	SourceID string `json:"source_id,omitempty"`
}

// ToMap converts FeedSourceFilter to map[string]interface{}
func (f *FeedSourceFilter) ToMap() map[string]interface{} {
	result := f.BaseFilter.ToMap()
	if f.Type != "" {
		result["type"] = f.Type
	}
	if f.SourceID != "" {
		result["source_id"] = f.SourceID
	}
	return result
}

// FeedItemFilter represents filter criteria for feed items
type FeedItemFilter struct {
	BaseFilter
	SourceID string `json:"source_id,omitempty"`
	Status   string `json:"status,omitempty"`
	Category string `json:"category,omitempty"`
}

// ToMap converts FeedItemFilter to map[string]interface{}
func (f *FeedItemFilter) ToMap() map[string]interface{} {
	result := f.BaseFilter.ToMap()
	if f.SourceID != "" {
		result["source_id"] = f.SourceID
	}
	if f.Status != "" {
		result["status"] = f.Status
	}
	if f.Category != "" {
		result["category"] = f.Category
	}
	return result
}

// CalendarSyncFilter represents filter criteria for calendar syncs
type CalendarSyncFilter struct {
	BaseFilter
	Token string `json:"token,omitempty"`
	Type  string `json:"type,omitempty"`
}

// ToMap converts CalendarSyncFilter to map[string]interface{}
func (f *CalendarSyncFilter) ToMap() map[string]interface{} {
	result := f.BaseFilter.ToMap()
	if f.Token != "" {
		result["token"] = f.Token
	}
	if f.Type != "" {
		result["type"] = f.Type
	}
	return result
}

// MailSyncFilter represents filter criteria for mail syncs
type MailSyncFilter struct {
	BaseFilter
	MailSyncID string `json:"mail_sync,omitempty"`
}

// ToMap converts MailSyncFilter to map[string]interface{}
func (f *MailSyncFilter) ToMap() map[string]interface{} {
	result := f.BaseFilter.ToMap()
	if f.MailSyncID != "" {
		result["mail_sync"] = f.MailSyncID
	}
	return result
}

// WorkflowFilter represents filter criteria for workflows
type WorkflowFilter struct {
	BaseFilter
	WorkflowID string `json:"workflow_id,omitempty"`
}

// ToMap converts WorkflowFilter to map[string]interface{}
func (f *WorkflowFilter) ToMap() map[string]interface{} {
	result := f.BaseFilter.ToMap()
	if f.WorkflowID != "" {
		result["workflow_id"] = f.WorkflowID
	}
	return result
}

// WorkflowExecutionFilter represents filter criteria for workflow executions
type WorkflowExecutionFilter struct {
	BaseFilter
	WorkflowID string `json:"workflow_id,omitempty"`
	Status     string `json:"status,omitempty"`
}

// ToMap converts WorkflowExecutionFilter to map[string]interface{}
func (f *WorkflowExecutionFilter) ToMap() map[string]interface{} {
	result := f.BaseFilter.ToMap()
	if f.WorkflowID != "" {
		result["workflow_id"] = f.WorkflowID
	}
	if f.Status != "" {
		result["status"] = f.Status
	}
	return result
}

// TokenFilter represents filter criteria for tokens
type TokenFilter struct {
	BaseFilter
	Provider string `json:"provider,omitempty"`
	Account  string `json:"account,omitempty"`
}

// ToMap converts TokenFilter to map[string]interface{}
func (f *TokenFilter) ToMap() map[string]interface{} {
	result := f.BaseFilter.ToMap()
	if f.Provider != "" {
		result["provider"] = f.Provider
	}
	if f.Account != "" {
		result["account"] = f.Account
	}
	return result
}

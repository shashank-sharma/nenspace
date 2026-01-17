package query

import (
	"github.com/pocketbase/dbx"
)

type BaseFilter struct {
	ID       string `json:"id,omitempty"`
	User     string `json:"user,omitempty"`
	IsActive *bool  `json:"is_active,omitempty"`
}

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

func (f *BaseFilter) ToHashExp() dbx.HashExp {
	return dbx.HashExp(f.ToMap())
}

type FeedSourceFilter struct {
	BaseFilter
	Type     string `json:"type,omitempty"`
	SourceID string `json:"source_id,omitempty"`
}

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

type FeedItemFilter struct {
	BaseFilter
	SourceID string `json:"source_id,omitempty"`
	Status   string `json:"status,omitempty"`
	Category string `json:"category,omitempty"`
}

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

type CalendarSyncFilter struct {
	BaseFilter
	Token string `json:"token,omitempty"`
	Type  string `json:"type,omitempty"`
}

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

type MailSyncFilter struct {
	BaseFilter
	MailSyncID string `json:"mail_sync,omitempty"`
}

func (f *MailSyncFilter) ToMap() map[string]interface{} {
	result := f.BaseFilter.ToMap()
	if f.MailSyncID != "" {
		result["mail_sync"] = f.MailSyncID
	}
	return result
}

type WorkflowFilter struct {
	BaseFilter
	WorkflowID string `json:"workflow_id,omitempty"`
}

func (f *WorkflowFilter) ToMap() map[string]interface{} {
	result := f.BaseFilter.ToMap()
	if f.WorkflowID != "" {
		result["workflow_id"] = f.WorkflowID
	}
	return result
}

type WorkflowExecutionFilter struct {
	BaseFilter
	WorkflowID string `json:"workflow_id,omitempty"`
	Status     string `json:"status,omitempty"`
}

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

type TokenFilter struct {
	BaseFilter
	Provider string `json:"provider,omitempty"`
	Account  string `json:"account,omitempty"`
}

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

type CronFilter struct {
	BaseFilter
	IsSystem   *bool  `json:"is_system,omitempty"`
	SystemType string `json:"system_type,omitempty"`
}

func (f *CronFilter) ToMap() map[string]interface{} {
	result := f.BaseFilter.ToMap()
	if f.IsSystem != nil {
		result["is_system"] = *f.IsSystem
	}
	if f.SystemType != "" {
		result["system_type"] = f.SystemType
	}
	return result
}

type CronExecutionFilter struct {
	BaseFilter
	Cron   string `json:"cron,omitempty"`
	Status string `json:"status,omitempty"`
}

func (f *CronExecutionFilter) ToMap() map[string]interface{} {
	result := f.BaseFilter.ToMap()
	if f.Cron != "" {
		result["cron"] = f.Cron
	}
	if f.Status != "" {
		result["status"] = f.Status
	}
	return result
}

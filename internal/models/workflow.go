package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*Workflow)(nil)
var _ core.Model = (*WorkflowNode)(nil)
var _ core.Model = (*WorkflowConnection)(nil)
var _ core.Model = (*WorkflowExecution)(nil)
var _ core.Model = (*WorkflowResult)(nil)
var _ core.Model = (*Connector)(nil)

// Workflow represents the core workflow definition
type Workflow struct {
	BaseModel

	Name        string        `db:"name" json:"name"`
	Description string        `db:"description" json:"description"`
	Active      bool          `db:"active" json:"active"`
	User        string        `db:"user" json:"user"` // user ID
	Config      types.JSONRaw `db:"config" json:"config"`
}

// WorkflowNode represents a single node in a workflow
type WorkflowNode struct {
	BaseModel

	WorkflowID string `db:"workflow_id" json:"workflow_id"`
	Type       string `db:"type" json:"type"`             // source, processor, destination
	NodeType   string `db:"node_type" json:"node_type"`   // gmail, csv, http, etc.
	Label      string `db:"label" json:"label"`
	Config     string `db:"config" json:"config"`         // JSON string
	PositionX  int    `db:"position_x" json:"position_x"` // X coordinate in the editor
	PositionY  int    `db:"position_y" json:"position_y"` // Y coordinate in the editor
}

type WorkflowConnection struct {
	BaseModel

	WorkflowID string `db:"workflow_id" json:"workflow_id"`
	SourceID   string `db:"source_id" json:"source_id"` // ID of the source node
	TargetID   string `db:"target_id" json:"target_id"` // ID of the target node
}

// WorkflowExecution represents the execution history of a workflow
type WorkflowExecution struct {
	BaseModel

	WorkflowID    string         `db:"workflow_id" json:"workflow_id"`
	Status        string         `db:"status" json:"status"`           // running, completed, failed
	StartTime     types.DateTime `db:"start_time" json:"start_time"`
	EndTime       types.DateTime `db:"end_time" json:"end_time"`
	Duration      int            `db:"duration" json:"duration"`       // in milliseconds
	Logs          string         `db:"logs" json:"logs"`               // JSON string of log entries
	Results       string         `db:"results" json:"results"`         // JSON string of results summary
	ErrorMessage  string         `db:"error_message" json:"error_message,omitempty"`
	ResultFileIDs string         `db:"result_file_ids" json:"result_file_ids,omitempty"` // Comma-separated IDs
}

// WorkflowResult represents structured output data from a workflow
type WorkflowResult struct {
	BaseModel

	ExecutionID string `db:"execution_id" json:"execution_id"`
	WorkflowID  string `db:"workflow_id" json:"workflow_id"`
	Data        string `db:"data" json:"data"` // JSON string
}

// Connector represents a source or destination connector
type Connector struct {
	BaseModel

	Name         string `db:"name" json:"name"`
	Type         string `db:"type" json:"type"`               // source or destination
	Category     string `db:"category" json:"category"`       // email, file, api, etc.
	Description  string `db:"description" json:"description"`
	ConfigSchema string `db:"config_schema" json:"config_schema"` // JSON schema string
	Icon         string `db:"icon" json:"icon,omitempty"`
}

func (m *Workflow) TableName() string {
	return "workflows"
}

func (m *WorkflowNode) TableName() string {
	return "workflow_nodes"
}

func (m *WorkflowConnection) TableName() string {
	return "workflow_connections"
}

func (m *WorkflowExecution) TableName() string {
	return "workflow_executions"
}

func (m *WorkflowResult) TableName() string {
	return "workflow_results"
}

func (m *Connector) TableName() string {
	return "connectors"
} 
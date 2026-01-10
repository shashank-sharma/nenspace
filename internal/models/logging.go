package models

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/tools/types"
)

type LoggingProject struct {
	BaseModel
	Name      string `db:"name" json:"name"`
	Slug      string `db:"slug" json:"slug"`
	DevToken  string `db:"dev_token" json:"dev_token"`
	Retention int    `db:"retention" json:"retention"`
	Active    bool   `db:"active" json:"active"`
}

func (m *LoggingProject) TableName() string {
	return "logging_projects"
}

type Log struct {
	BaseModel
	Project   string         `db:"project" json:"project"`
	Level     string         `db:"level" json:"level"`
	Timestamp types.DateTime `db:"timestamp" json:"timestamp"`
	Source    string         `db:"source" json:"source"`
	Message   string         `db:"message" json:"message"`
	Context   types.JSONRaw  `db:"context" json:"context"`
	TraceID   string         `db:"trace_id" json:"trace_id"`
}

func (m *Log) TableName() string {
	return "logs"
}

func (m *Log) SetContextMap(ctx map[string]interface{}) error {
	if ctx == nil {
		m.Context = types.JSONRaw("{}")
		return nil
	}

	jsonBytes, err := json.Marshal(ctx)
	if err != nil {
		return err
	}

	m.Context = types.JSONRaw(jsonBytes)
	return nil
}

func (m *Log) GetContextMap() (map[string]interface{}, error) {
	if len(m.Context) == 0 {
		return make(map[string]interface{}), nil
	}

	var ctx map[string]interface{}
	if err := json.Unmarshal([]byte(m.Context), &ctx); err != nil {
		return nil, err
	}

	return ctx, nil
}


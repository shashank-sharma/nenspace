package models

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/tools/types"
)

type BrowsingActivity struct {
	BaseModel
	User           string          `db:"user" json:"user"`
	BrowserProfile string          `db:"browser_profile" json:"browser_profile"`
	URL            string          `db:"url" json:"url"`
	Title          string          `db:"title" json:"title"`
	Domain         string          `db:"domain" json:"domain"`
	StartTime      types.DateTime  `db:"start_time" json:"start_time"`
	EndTime        *types.DateTime `db:"end_time" json:"end_time"`
	Duration       *int            `db:"duration" json:"duration"`
	TabID          *int            `db:"tab_id" json:"tab_id"`
	WindowID       *int            `db:"window_id" json:"window_id"`
	Audible        bool            `db:"audible" json:"audible"`
	Incognito      bool            `db:"incognito" json:"incognito"`
	Metadata       types.JSONRaw   `db:"metadata" json:"metadata"`
	SessionID      string          `db:"session_id" json:"session_id"`
}

func (m *BrowsingActivity) SetMetadataMap(metadata map[string]interface{}) error {
	if metadata == nil {
		m.Metadata = types.JSONRaw("{}")
		return nil
	}

	jsonBytes, err := json.Marshal(metadata)
	if err != nil {
		return err
	}

	m.Metadata = types.JSONRaw(jsonBytes)
	return nil
}

func (m *BrowsingActivity) GetMetadataMap() (map[string]interface{}, error) {
	if len(m.Metadata) == 0 {
		return make(map[string]interface{}), nil
	}

	var metadata map[string]interface{}
	if err := json.Unmarshal([]byte(m.Metadata), &metadata); err != nil {
		return nil, err
	}

	return metadata, nil
}

func (m *BrowsingActivity) TableName() string {
	return "browsing_activity"
}

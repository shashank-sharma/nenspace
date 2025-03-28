package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*CalendarToken)(nil)
var _ core.Model = (*CalendarSync)(nil)
var _ core.Model = (*CalendarEvent)(nil)

type CalendarToken struct {
	BaseModel

	User         string         `db:"user" json:"user"`
	Account      string         `db:"account" json:"account"`
	AccessToken  string         `db:"access_token" json:"access_token"`
	TokenType    string         `db:"token_type" json:"token_type"`
	RefreshToken string         `db:"refresh_token" json:"refresh_token"`
	Expiry       types.DateTime `db:"expiry" json:"expiry"`
}

type CalendarSync struct {
	BaseModel

	User       string         `db:"user" json:"user"`
	Token      string         `db:"token" json:"token"`
	Name       string         `db:"name" json:"name"`
	Type       string         `db:"type" json:"type"`
	SyncToken  string         `db:"sync_token" json:"sync_token"`
	SyncStatus string         `db:"sync_status" json:"sync_status"`
	IsActive   bool           `db:"is_active" json:"is_active"`
	InProgress bool           `db:"in_progress" json:"in_progress"`
	LastSynced types.DateTime `db:"last_synced" json:"last_synced"`
}

type CalendarEvent struct {
	BaseModel

	CalendarId     string         `db:"calendar_id" json:"calendar_id"`
	CalendarUId    string         `db:"calendar_uid" json:"calendar_uid"`
	User           string         `db:"user" json:"user"`
	Calendar       string         `db:"calendar" json:"calendar"`
	Etag           string         `db:"etag" json:"etag"`
	Summary        string         `db:"summary" json:"summary"`
	Description    string         `db:"description" json:"description"`
	EventType      string         `db:"event_type" json:"event_type"`
	Start          types.DateTime `db:"start" json:"start"`
	End            types.DateTime `db:"end" json:"end"`
	Creator        string         `db:"creator" json:"creator"`
	CreatorEmail   string         `db:"creator_email" json:"creator_email"`
	Organizer      string         `db:"organizer" json:"organizer"`
	OrganizerEmail string         `db:"organizer_email" json:"organizer_email"`
	Kind           string         `db:"kind" json:"kind"`
	Location       string         `db:"location" json:"location"`
	Status         string         `db:"status" json:"status"`
	EventCreated   types.DateTime `db:"event_created" json:"event_created"`
	EventUpdated   types.DateTime `db:"event_updated" json:"event_updated"`
	IsDayEvent     bool           `db:"is_day_event" json:"is_day_event"`
}

func (m *CalendarToken) TableName() string {
	return "calendar_tokens"
}

func (m *CalendarSync) TableName() string {
	return "calendar_sync"
}

func (m *CalendarEvent) TableName() string {
	return "calendar_events"
}

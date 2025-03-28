package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*TrackDevice)(nil)
var _ core.Model = (*TrackItems)(nil)
var _ core.Model = (*TrackUpload)(nil)

// Use structure embedding
type TrackDeviceAPI struct {
	Name     string `json:"name" form:"name"`
	HostName string `json:"hostname" form:"hostname"`
	Os       string `db:"os" json:"os"`
	Arch     string `db:"arch" json:"arch"`
}

type TrackDeviceUpdateAPI struct {
	UserId    string `json:"userid" json:"userid"`
	Token     string `json:"token" json:"token"`
	ProductId string `json:"productid" json:"productid"`
}

type TrackDevice struct {
	BaseModel

	User       string         `db:"user" json:"user"`
	Name       string         `db:"name" json:"name"`
	HostName   string         `db:"hostname" json:"hostname"`
	Os         string         `db:"os" json:"os"`
	Arch       string         `db:"arch" json:"arch"`
	IsOnline   bool           `db:"is_online" json:"is_online"`
	IsActive   bool           `db:"is_active" json:"is_active"`
	IsPublic   bool           `db:"is_public" json:"is_public"`
	SyncEvents bool           `db:"sync_events" json:"sync_events"`
	LastOnline types.DateTime `db:"last_online" json:"last_online"`
	LastSync   types.DateTime `db:"last_sync" json:"last_sync"`
}

type TrackItems struct {
	BaseModel

	User      string         `db:"user" json:"user"`
	TrackId   int64          `db:"track_id" json:"track_id"`
	Device    string         `db:"device" json:"device"`
	App       string         `db:"app" json:"app"`
	TaskName  string         `db:"task_name" json:"task_name"`
	Title     string         `db:"title" json:"title"`
	BeginDate types.DateTime `db:"begin_date" json:"begin_date"`
	EndDate   types.DateTime `db:"end_date" json:"end_date"`
}

type TrackUpload struct {
	BaseModel

	User            string `db:"user" json:"user"`
	Source          string `db:"source" json:"source"`
	File            string `db:"file" json:"file"`
	Synced          bool   `db:"synced" json:"synced"`
	Status          string `db:"status" json:"status"`
	TotalRecord     int64  `db:"total_record" json:"total_record"`
	DuplicateRecord int64  `db:"duplicate_record" json:"duplicate_record"`
}

func (m *TrackDevice) TableName() string {
	return "devices"
}

func (m *TrackItems) TableName() string {
	return "track_items"
}

func (m *TrackUpload) TableName() string {
	return "track_upload"
}

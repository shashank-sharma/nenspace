package models

import "github.com/pocketbase/pocketbase/tools/types"

type Model interface {
	TableName() string
	PK() any
	LastSavedPK() any
	IsNew() bool
	SetId(id string)
	GetId() string
	HasId() bool
	MarkAsNew()
	MarkAsNotNew()
	RefreshCreated()
	RefreshUpdated()
	SetCreated(created types.DateTime)
	GetCreated() types.DateTime
}

type BaseModel struct {
	lastSavedPK string

	Id      string         `db:"id" json:"id" form:"id" xml:"id"`
	Created types.DateTime `json:"created"`
	Updated types.DateTime `json:"updated"`
}

func (m *BaseModel) LastSavedPK() any {
	return m.lastSavedPK
}

func (m *BaseModel) PK() any {
	return m.Id
}

// IsNew indicates what type of db query (insert or update)
// should be used with the model instance.
func (m *BaseModel) IsNew() bool {
	return m.lastSavedPK == ""
}

// MarkAsNew clears the pk field and marks the current model as "new"
// (aka. forces m.IsNew() to be true).
func (m *BaseModel) MarkAsNew() {
	m.lastSavedPK = ""
}

// MarkAsNew set the pk field to the Id value and marks the current model
// as NOT "new" (aka. forces m.IsNew() to be false).
func (m *BaseModel) MarkAsNotNew() {
	m.lastSavedPK = m.Id
}

// PostScan implements the [dbx.PostScanner] interface.
//
// It is usually executed right after the model is populated with the db row values.
func (m *BaseModel) PostScan() error {
	m.MarkAsNotNew()
	return nil
}

// HasId returns whether the model has a nonzero id.
func (m *BaseModel) HasId() bool {
	return m.GetId() != ""
}

// GetId returns the model id.
func (m *BaseModel) GetId() string {
	return m.Id
}

// SetId sets the model id to the provided string value.
func (m *BaseModel) SetId(id string) {
	m.Id = id
}

// RefreshCreated updates the model Created field with the current datetime.
func (m *BaseModel) RefreshCreated() {
	m.Created = types.NowDateTime()
}

// RefreshUpdated updates the model Updated field with the current datetime.
func (m *BaseModel) RefreshUpdated() {
	m.Updated = types.NowDateTime()
}

func (m *BaseModel) SetCreated(created types.DateTime) {
	m.Created = created
}

func (m *BaseModel) GetCreated() types.DateTime {
	return m.Created
}
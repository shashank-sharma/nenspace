package models

type Superuser struct {
	BaseModel
}

func (m *Superuser) TableName() string {
	return "_superusers"
}


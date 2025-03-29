package models

var _ Model = (*Users)(nil)

type Users struct {
	BaseModel

	Username string `db:"username" json:"username"`
	Email    string `db:"email" json:"email"`
	Name     string `db:"name" json:"name"`
	Verified bool   `db:"verified" json:"verified"`
	Avatar   string `db:"avatar" json:"avatar"`
	City     string `db:"city" json:"city"`
	Lat      float64 `db:"lat" json:"lat"`
	Lon      float64 `db:"lon" json:"lon"`
}

func (m *Users) TableName() string {
	return "users"
}

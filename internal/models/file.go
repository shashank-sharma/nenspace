package models

var _ Model = (*File)(nil)

type File struct {
	BaseModel

	User             string `db:"user" json:"user"`
	Filename         string `db:"filename" json:"filename"`
	OriginalFilename string `db:"original_filename" json:"original_filename"`
	File             string `db:"file" json:"file"` // PocketBase file URL
	MimeType         string `db:"mime_type" json:"mime_type"`
	Size             int64  `db:"size" json:"size"`
	Path             string `db:"path" json:"path"`
	Folder           string `db:"folder" json:"folder"` // Optional folder ID
	Description      string `db:"description" json:"description"`
	Tags             string `db:"tags" json:"tags"` // JSON array stored as string
}

func (m *File) TableName() string {
	return "files"
}

var _ Model = (*UserStorageQuota)(nil)

type UserStorageQuota struct {
	BaseModel

	User       string `db:"user" json:"user"`
	QuotaBytes int64  `db:"quota_bytes" json:"quota_bytes"`
	UsedBytes  int64  `db:"used_bytes" json:"used_bytes"`
}

func (m *UserStorageQuota) TableName() string {
	return "user_storage_quotas"
}

var _ Model = (*Folder)(nil)

type Folder struct {
	BaseModel

	User   string `db:"user" json:"user"`
	Name   string `db:"name" json:"name"`
	Parent string `db:"parent" json:"parent"` // Parent folder ID (null for root)
	Color  string `db:"color" json:"color"`   // Optional folder color
}

func (m *Folder) TableName() string {
	return "folders"
}

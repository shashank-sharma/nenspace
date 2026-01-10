package models

import (
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ Model = (*MusicTrack)(nil)

type MusicTrack struct {
	BaseModel

	User        string  `db:"user" json:"user"`
	Title       string  `db:"title" json:"title"`
	Artist      string  `db:"artist" json:"artist"`
	Album       string  `db:"album" json:"album"`
	AlbumArtist string  `db:"album_artist" json:"album_artist"`
	Genre       string  `db:"genre" json:"genre"`
	Year        int     `db:"year" json:"year"`
	TrackNumber int     `db:"track_number" json:"track_number"`
	DiscNumber  int     `db:"disc_number" json:"disc_number"`
	Duration    float64 `db:"duration" json:"duration"`
	Bitrate     int     `db:"bitrate" json:"bitrate"`
	SampleRate  int     `db:"sample_rate" json:"sample_rate"`
	Format      string  `db:"format" json:"format"`
	FilePath    string  `db:"file_path" json:"file_path"`
	FileSize    int64   `db:"file_size" json:"file_size"`
	FileHash    string  `db:"file_hash" json:"file_hash"`
	CoverArt    string  `db:"cover_art" json:"cover_art"`
	PlayCount   int     `db:"play_count" json:"play_count"`
	LastPlayed  string  `db:"last_played" json:"last_played"`
	Rating      int                     `db:"rating" json:"rating"`
	Tags        types.JSONArray[string] `db:"tags" json:"tags"`
}

func (m *MusicTrack) TableName() string {
	return "music_tracks"
}

var _ Model = (*MusicPlaylist)(nil)

type MusicPlaylist struct {
	BaseModel

	User          string `db:"user" json:"user"`
	Name          string `db:"name" json:"name"`
	Description   string `db:"description" json:"description"`
	CoverImage    string `db:"cover_image" json:"cover_image"`
	IsSmart       bool   `db:"is_smart" json:"is_smart"`
	TrackCount    int    `db:"track_count" json:"track_count"`
	TotalDuration int    `db:"total_duration" json:"total_duration"`
}

func (m *MusicPlaylist) TableName() string {
	return "music_playlists"
}

var _ Model = (*MusicPlaylistTrack)(nil)

type MusicPlaylistTrack struct {
	BaseModel

	Playlist string `db:"playlist" json:"playlist"`
	Track    string `db:"track" json:"track"`
	Position int    `db:"position" json:"position"`
	AddedAt  string `db:"added_at" json:"added_at"`
}

func (m *MusicPlaylistTrack) TableName() string {
	return "music_playlist_tracks"
}

var _ Model = (*MusicPlayHistory)(nil)

type MusicPlayHistory struct {
	BaseModel

	User           string  `db:"user" json:"user"`
	Track          string  `db:"track" json:"track"`
	PlayedAt       string  `db:"played_at" json:"played_at"`
	DurationPlayed float64 `db:"duration_played" json:"duration_played"`
	Completed      bool    `db:"completed" json:"completed"`
}

func (m *MusicPlayHistory) TableName() string {
	return "music_play_history"
}




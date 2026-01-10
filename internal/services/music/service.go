package music

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/store"
)

type MusicService struct {
	storagePath    string
	maxUploadSize  int64
	scanInProgress bool
	scanMutex      sync.RWMutex
	scanProgress   ScanProgress
}

type ScanProgress struct {
	TotalFiles    int    `json:"total_files"`
	ProcessedFiles int   `json:"processed_files"`
	CurrentFile   string `json:"current_file"`
	Status        string `json:"status"`
	Errors        []string `json:"errors"`
}

type TrackMetadata struct {
	Title       string
	Artist      string
	Album       string
	AlbumArtist string
	Genre       string
	Year        int
	TrackNumber int
	DiscNumber  int
	Duration    float64
	Bitrate     int
	SampleRate  int
	Format      string
	CoverArt    []byte
}

type AlbumInfo struct {
	Album       string `json:"album"`
	AlbumArtist string `json:"album_artist"`
	Artist      string `json:"artist"`
	Year        int    `json:"year"`
	TrackCount  int    `json:"track_count"`
	CoverArt    string `json:"cover_art"`
	TrackID     string `json:"track_id"`
	Genre       string `json:"genre"`
}

type ArtistInfo struct {
	Artist     string `json:"artist"`
	AlbumCount int    `json:"album_count"`
	TrackCount int    `json:"track_count"`
}

type ListeningStats struct {
	TotalTracks      int            `json:"total_tracks"`
	TotalPlays       int            `json:"total_plays"`
	TotalListenTime  float64        `json:"total_listen_time"`
	TopTracks        []TrackStats   `json:"top_tracks"`
	TopArtists       []ArtistStats  `json:"top_artists"`
	TopAlbums        []AlbumStats   `json:"top_albums"`
	GenreDistribution map[string]int `json:"genre_distribution"`
	RecentPlays      []PlayRecord   `json:"recent_plays"`
}

type TrackStats struct {
	TrackID   string  `json:"track_id"`
	Title     string  `json:"title"`
	Artist    string  `json:"artist"`
	PlayCount int     `json:"play_count"`
	Duration  float64 `json:"duration"`
}

type ArtistStats struct {
	Artist    string `json:"artist"`
	PlayCount int    `json:"play_count"`
}

type AlbumStats struct {
	Album     string `json:"album"`
	Artist    string `json:"artist"`
	PlayCount int    `json:"play_count"`
}

type PlayRecord struct {
	TrackID   string `json:"track_id"`
	Title     string `json:"title"`
	Artist    string `json:"artist"`
	PlayedAt  string `json:"played_at"`
	Completed bool   `json:"completed"`
}

func NewMusicService(storagePath string, maxUploadSize int64) *MusicService {
	if maxUploadSize <= 0 {
		maxUploadSize = 100 * 1024 * 1024
	}

	if err := os.MkdirAll(storagePath, 0755); err != nil {
		fmt.Printf("Warning: Could not create music storage path: %v\n", err)
	}

	return &MusicService{
		storagePath:   storagePath,
		maxUploadSize: maxUploadSize,
	}
}

func (s *MusicService) GetStoragePath() string {
	return s.storagePath
}

func (s *MusicService) ProcessUpload(userID string, filename string, fileReader io.Reader, fileSize int64) (*core.Record, error) {
	if fileSize > s.maxUploadSize {
		return nil, fmt.Errorf("file size exceeds maximum allowed size of %d bytes", s.maxUploadSize)
	}

	ext := strings.ToLower(filepath.Ext(filename))
	supportedFormats := map[string]bool{
		".mp3":  true,
		".flac": true,
		".wav":  true,
		".ogg":  true,
		".m4a":  true,
		".aac":  true,
		".wma":  true,
	}

	if !supportedFormats[ext] {
		return nil, fmt.Errorf("unsupported audio format: %s", ext)
	}

	tempFile, err := os.CreateTemp("", "music_upload_*"+ext)
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	tempPath := tempFile.Name()
	defer os.Remove(tempPath)

	hasher := sha256.New()
	teeReader := io.TeeReader(fileReader, hasher)

	written, err := io.Copy(tempFile, teeReader)
	if err != nil {
		tempFile.Close()
		return nil, fmt.Errorf("failed to write temp file: %w", err)
	}
	tempFile.Close()

	fileHash := hex.EncodeToString(hasher.Sum(nil))

	metadata, err := ExtractMetadata(tempPath)
	if err != nil {
		metadata = &TrackMetadata{
			Title:  strings.TrimSuffix(filename, ext),
			Format: strings.TrimPrefix(ext, "."),
		}
	}

	if metadata.Title == "" {
		metadata.Title = strings.TrimSuffix(filename, ext)
	}
	if metadata.Artist == "" {
		metadata.Artist = "Unknown Artist"
	}
	if metadata.Album == "" {
		metadata.Album = "Unknown Album"
	}

	artistDir := sanitizeFilename(metadata.Artist)
	albumDir := sanitizeFilename(metadata.Album)
	trackFilename := sanitizeFilename(metadata.Title) + ext

	relativePath := filepath.Join(artistDir, albumDir, trackFilename)
	fullPath := filepath.Join(s.storagePath, relativePath)

	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory structure: %w", err)
	}

	srcFile, err := os.Open(tempPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open temp file: %w", err)
	}
	defer srcFile.Close()

	dstFile, err := os.Create(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return nil, fmt.Errorf("failed to copy file: %w", err)
	}

	collection, err := store.GetDao().FindCollectionByNameOrId("music_tracks")
	if err != nil {
		return nil, fmt.Errorf("failed to find music_tracks collection: %w", err)
	}

	record := core.NewRecord(collection)
	record.Set("user", userID)
	record.Set("title", metadata.Title)
	record.Set("artist", metadata.Artist)
	record.Set("album", metadata.Album)
	record.Set("album_artist", metadata.AlbumArtist)
	record.Set("genre", metadata.Genre)
	record.Set("year", metadata.Year)
	record.Set("track_number", metadata.TrackNumber)
	record.Set("disc_number", metadata.DiscNumber)
	record.Set("duration", metadata.Duration)
	record.Set("bitrate", metadata.Bitrate)
	record.Set("sample_rate", metadata.SampleRate)
	record.Set("format", metadata.Format)
	record.Set("file_path", relativePath)
	record.Set("file_size", written)
	record.Set("file_hash", fileHash)
	record.Set("play_count", 0)
	record.Set("rating", 0)

	if err := store.GetDao().Save(record); err != nil {
		os.Remove(fullPath)
		return nil, fmt.Errorf("failed to save track record: %w", err)
	}

	return record, nil
}

func (s *MusicService) GetTrackFilePath(relativePath string) string {
	return filepath.Join(s.storagePath, relativePath)
}

func (s *MusicService) DeleteTrack(trackID string, userID string) error {
	record, err := store.GetDao().FindRecordById("music_tracks", trackID)
	if err != nil {
		return fmt.Errorf("track not found: %w", err)
	}

	if record.GetString("user") != userID {
		return fmt.Errorf("unauthorized: track belongs to another user")
	}

	filePath := s.GetTrackFilePath(record.GetString("file_path"))
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		fmt.Printf("Warning: Could not delete file %s: %v\n", filePath, err)
	}

	if err := store.GetDao().Delete(record); err != nil {
		return fmt.Errorf("failed to delete track record: %w", err)
	}

	return nil
}

func (s *MusicService) GetAlbums(userID string) ([]AlbumInfo, error) {
	records, err := store.GetDao().FindRecordsByFilter(
		"music_tracks",
		"user = {:user}",
		"-album",
		0,
		0,
		map[string]any{"user": userID},
	)
	if err != nil {
		return nil, err
	}

	albumMap := make(map[string]*AlbumInfo)
	for _, record := range records {
		album := record.GetString("album")
		if album == "" {
			album = "Unknown Album"
		}

		key := album + "|" + record.GetString("artist")
		if existing, ok := albumMap[key]; ok {
			existing.TrackCount++
			// If the existing one doesn't have cover art but this one does, use this one
			if existing.CoverArt == "" && record.GetString("cover_art") != "" {
				existing.CoverArt = record.GetString("cover_art")
				existing.TrackID = record.Id
			}
		} else {
			albumMap[key] = &AlbumInfo{
				Album:       album,
				AlbumArtist: record.GetString("album_artist"),
				Artist:      record.GetString("artist"),
				Year:        record.GetInt("year"),
				TrackCount:  1,
				CoverArt:    record.GetString("cover_art"),
				TrackID:     record.Id,
				Genre:       record.GetString("genre"),
			}
		}
	}

	albums := make([]AlbumInfo, 0, len(albumMap))
	for _, album := range albumMap {
		albums = append(albums, *album)
	}

	return albums, nil
}

func (s *MusicService) GetArtists(userID string) ([]ArtistInfo, error) {
	records, err := store.GetDao().FindRecordsByFilter(
		"music_tracks",
		"user = {:user}",
		"-artist",
		0,
		0,
		map[string]any{"user": userID},
	)
	if err != nil {
		return nil, err
	}

	artistMap := make(map[string]*ArtistInfo)
	albumsByArtist := make(map[string]map[string]bool)

	for _, record := range records {
		artist := record.GetString("artist")
		if artist == "" {
			artist = "Unknown Artist"
		}

		if existing, ok := artistMap[artist]; ok {
			existing.TrackCount++
		} else {
			artistMap[artist] = &ArtistInfo{
				Artist:     artist,
				TrackCount: 1,
			}
			albumsByArtist[artist] = make(map[string]bool)
		}

		album := record.GetString("album")
		albumsByArtist[artist][album] = true
	}

	for artist, info := range artistMap {
		info.AlbumCount = len(albumsByArtist[artist])
	}

	artists := make([]ArtistInfo, 0, len(artistMap))
	for _, artist := range artistMap {
		artists = append(artists, *artist)
	}

	return artists, nil
}

func (s *MusicService) GetGenres(userID string) ([]string, error) {
	records, err := store.GetDao().FindRecordsByFilter(
		"music_tracks",
		"user = {:user}",
		"-genre",
		0,
		0,
		map[string]any{"user": userID},
	)
	if err != nil {
		return nil, err
	}

	genreSet := make(map[string]bool)
	for _, record := range records {
		genre := record.GetString("genre")
		if genre != "" {
			genreSet[genre] = true
		}
	}

	genres := make([]string, 0, len(genreSet))
	for genre := range genreSet {
		genres = append(genres, genre)
	}

	return genres, nil
}

func (s *MusicService) RecordPlay(userID string, trackID string, durationPlayed float64, completed bool) error {
	_, err := store.GetDao().FindRecordById("music_tracks", trackID)
	if err != nil {
		return fmt.Errorf("track not found: %w", err)
	}

	collection, err := store.GetDao().FindCollectionByNameOrId("music_play_history")
	if err != nil {
		return fmt.Errorf("failed to find music_play_history collection: %w", err)
	}

	record := core.NewRecord(collection)
	record.Set("user", userID)
	record.Set("track", trackID)
	record.Set("duration_played", durationPlayed)
	record.Set("completed", completed)

	if err := store.GetDao().Save(record); err != nil {
		return fmt.Errorf("failed to save play history: %w", err)
	}

	if completed {
		trackRecord, _ := store.GetDao().FindRecordById("music_tracks", trackID)
		if trackRecord != nil {
			playCount := trackRecord.GetInt("play_count")
			trackRecord.Set("play_count", playCount+1)
			store.GetDao().Save(trackRecord)
		}
	}

	return nil
}

func (s *MusicService) GetListeningStats(userID string) (*ListeningStats, error) {
	tracks, err := store.GetDao().FindRecordsByFilter(
		"music_tracks",
		"user = {:user}",
		"-play_count",
		10,
		0,
		map[string]any{"user": userID},
	)
	if err != nil {
		return nil, err
	}

	allTracks, _ := store.GetDao().FindRecordsByFilter(
		"music_tracks",
		"user = {:user}",
		"",
		0,
		0,
		map[string]any{"user": userID},
	)

	history, _ := store.GetDao().FindRecordsByFilter(
		"music_play_history",
		"user = {:user}",
		"-created",
		50,
		0,
		map[string]any{"user": userID},
	)

	stats := &ListeningStats{
		TotalTracks:       len(allTracks),
		GenreDistribution: make(map[string]int),
	}

	for _, track := range allTracks {
		stats.TotalPlays += track.GetInt("play_count")
		genre := track.GetString("genre")
		if genre != "" {
			stats.GenreDistribution[genre]++
		}
	}

	for _, track := range tracks {
		if track.GetInt("play_count") > 0 {
			stats.TopTracks = append(stats.TopTracks, TrackStats{
				TrackID:   track.Id,
				Title:     track.GetString("title"),
				Artist:    track.GetString("artist"),
				PlayCount: track.GetInt("play_count"),
				Duration:  track.GetFloat("duration"),
			})
		}
	}

	for _, record := range history {
		stats.TotalListenTime += record.GetFloat("duration_played")
		stats.RecentPlays = append(stats.RecentPlays, PlayRecord{
			TrackID:   record.GetString("track"),
			PlayedAt:  record.GetString("created"),
			Completed: record.GetBool("completed"),
		})
	}

	return stats, nil
}

func (s *MusicService) StartScan(userID string) error {
	s.scanMutex.Lock()
	if s.scanInProgress {
		s.scanMutex.Unlock()
		return fmt.Errorf("scan already in progress")
	}
	s.scanInProgress = true
	s.scanProgress = ScanProgress{Status: "starting"}
	s.scanMutex.Unlock()

	go s.performScan(userID)
	return nil
}

func (s *MusicService) GetScanProgress() ScanProgress {
	s.scanMutex.RLock()
	defer s.scanMutex.RUnlock()
	return s.scanProgress
}

func (s *MusicService) performScan(userID string) {
	defer func() {
		s.scanMutex.Lock()
		s.scanInProgress = false
		s.scanMutex.Unlock()
	}()

	var files []string
	supportedFormats := map[string]bool{
		".mp3":  true,
		".flac": true,
		".wav":  true,
		".ogg":  true,
		".m4a":  true,
		".aac":  true,
	}

	err := filepath.Walk(s.storagePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() {
			ext := strings.ToLower(filepath.Ext(path))
			if supportedFormats[ext] {
				files = append(files, path)
			}
		}
		return nil
	})

	if err != nil {
		s.scanMutex.Lock()
		s.scanProgress.Status = "error"
		s.scanProgress.Errors = append(s.scanProgress.Errors, err.Error())
		s.scanMutex.Unlock()
		return
	}

	s.scanMutex.Lock()
	s.scanProgress.TotalFiles = len(files)
	s.scanProgress.Status = "scanning"
	s.scanMutex.Unlock()

	for i, filePath := range files {
		s.scanMutex.Lock()
		s.scanProgress.ProcessedFiles = i + 1
		s.scanProgress.CurrentFile = filepath.Base(filePath)
		s.scanMutex.Unlock()

		relativePath, _ := filepath.Rel(s.storagePath, filePath)

		existing, _ := store.GetDao().FindFirstRecordByFilter(
			"music_tracks",
			"user = {:user} && file_path = {:path}",
			map[string]any{"user": userID, "path": relativePath},
		)
		if existing != nil {
			continue
		}

		metadata, err := ExtractMetadata(filePath)
		if err != nil {
			s.scanMutex.Lock()
			s.scanProgress.Errors = append(s.scanProgress.Errors, fmt.Sprintf("%s: %v", filepath.Base(filePath), err))
			s.scanMutex.Unlock()
			continue
		}

		fileInfo, err := os.Stat(filePath)
		if err != nil {
			continue
		}

		collection, err := store.GetDao().FindCollectionByNameOrId("music_tracks")
		if err != nil {
			continue
		}

		record := core.NewRecord(collection)
		record.Set("user", userID)
		record.Set("title", metadata.Title)
		record.Set("artist", metadata.Artist)
		record.Set("album", metadata.Album)
		record.Set("album_artist", metadata.AlbumArtist)
		record.Set("genre", metadata.Genre)
		record.Set("year", metadata.Year)
		record.Set("track_number", metadata.TrackNumber)
		record.Set("disc_number", metadata.DiscNumber)
		record.Set("duration", metadata.Duration)
		record.Set("bitrate", metadata.Bitrate)
		record.Set("sample_rate", metadata.SampleRate)
		record.Set("format", metadata.Format)
		record.Set("file_path", relativePath)
		record.Set("file_size", fileInfo.Size())
		record.Set("play_count", 0)
		record.Set("rating", 0)

		store.GetDao().Save(record)
	}

	s.scanMutex.Lock()
	s.scanProgress.Status = "completed"
	s.scanMutex.Unlock()
}

func sanitizeFilename(name string) string {
	if name == "" {
		return "Unknown"
	}

	invalid := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	result := name
	for _, char := range invalid {
		result = strings.ReplaceAll(result, char, "_")
	}

	result = strings.TrimSpace(result)
	if len(result) > 200 {
		result = result[:200]
	}

	return result
}


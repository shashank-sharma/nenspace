package music

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type AudioStreamer struct {
	storagePath string
}

func NewAudioStreamer(storagePath string) *AudioStreamer {
	return &AudioStreamer{
		storagePath: storagePath,
	}
}

func (s *AudioStreamer) StreamFile(w http.ResponseWriter, r *http.Request, relativePath string) error {
	fullPath := filepath.Join(s.storagePath, relativePath)

	file, err := os.Open(fullPath)
	if err != nil {
		return fmt.Errorf("file not found: %w", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("could not get file info: %w", err)
	}

	contentType := getContentType(relativePath)
	
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filepath.Base(relativePath)))
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", fileInfo.Size()))
	w.Header().Set("Cache-Control", "private, max-age=86400, must-revalidate")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	http.ServeContent(w, r, filepath.Base(relativePath), fileInfo.ModTime(), file)
	return nil
}

func getContentType(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))

	contentTypes := map[string]string{
		".mp3":  "audio/mpeg",
		".flac": "audio/flac",
		".wav":  "audio/wav",
		".ogg":  "audio/ogg",
		".m4a":  "audio/mp4",
		".aac":  "audio/aac",
		".wma":  "audio/x-ms-wma",
	}

	if ct, ok := contentTypes[ext]; ok {
		return ct
	}

	return "application/octet-stream"
}

func (s *AudioStreamer) GetFileInfo(relativePath string) (int64, string, error) {
	fullPath := filepath.Join(s.storagePath, relativePath)

	fileInfo, err := os.Stat(fullPath)
	if err != nil {
		return 0, "", err
	}

	return fileInfo.Size(), getContentType(relativePath), nil
}


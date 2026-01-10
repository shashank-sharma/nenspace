package music

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/dhowden/tag"
)

func ExtractMetadata(filePath string) (*TrackMetadata, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	metadata, err := tag.ReadFrom(file)
	if err != nil {
		return getBasicMetadata(filePath)
	}

	trackNum, _ := metadata.Track()
	discNum, _ := metadata.Disc()

	ext := strings.ToLower(filepath.Ext(filePath))
	format := strings.TrimPrefix(ext, ".")

	fileInfo, _ := file.Stat()
	var duration float64
	var bitrate int
	var sampleRate int

	if fileInfo != nil {
		duration = estimateDuration(fileInfo.Size(), format)
		bitrate = estimateBitrate(format)
		sampleRate = estimateSampleRate(format)
	}

	title := metadata.Title()
	if title == "" {
		title = strings.TrimSuffix(filepath.Base(filePath), ext)
	}

	artist := metadata.Artist()
	if artist == "" {
		artist = "Unknown Artist"
	}

	album := metadata.Album()
	if album == "" {
		album = "Unknown Album"
	}

	return &TrackMetadata{
		Title:       title,
		Artist:      artist,
		Album:       album,
		AlbumArtist: metadata.AlbumArtist(),
		Genre:       metadata.Genre(),
		Year:        metadata.Year(),
		TrackNumber: trackNum,
		DiscNumber:  discNum,
		Duration:    duration,
		Bitrate:     bitrate,
		SampleRate:  sampleRate,
		Format:      format,
	}, nil
}

func getBasicMetadata(filePath string) (*TrackMetadata, error) {
	ext := strings.ToLower(filepath.Ext(filePath))
	filename := strings.TrimSuffix(filepath.Base(filePath), ext)

	return &TrackMetadata{
		Title:      filename,
		Artist:     "Unknown Artist",
		Album:      "Unknown Album",
		Format:     strings.TrimPrefix(ext, "."),
		Duration:   0,
		Bitrate:    0,
		SampleRate: 0,
	}, nil
}

func estimateDuration(fileSize int64, format string) float64 {
	var bytesPerSecond float64

	switch format {
	case "mp3":
		bytesPerSecond = 320 * 1024 / 8
	case "flac":
		bytesPerSecond = 1411 * 1024 / 8
	case "wav":
		bytesPerSecond = 1411 * 1024 / 8
	case "ogg":
		bytesPerSecond = 256 * 1024 / 8
	case "m4a", "aac":
		bytesPerSecond = 256 * 1024 / 8
	default:
		bytesPerSecond = 256 * 1024 / 8
	}

	return float64(fileSize) / bytesPerSecond
}

func estimateBitrate(format string) int {
	switch format {
	case "mp3":
		return 320
	case "flac":
		return 1411
	case "wav":
		return 1411
	case "ogg":
		return 256
	case "m4a", "aac":
		return 256
	default:
		return 256
	}
}

func estimateSampleRate(format string) int {
	switch format {
	case "flac", "wav":
		return 44100
	default:
		return 44100
	}
}

func FormatDuration(seconds float64) string {
	d := time.Duration(seconds * float64(time.Second))
	minutes := int(d.Minutes())
	secs := int(d.Seconds()) % 60
	return strings.TrimLeft(time.Date(0, 0, 0, 0, minutes, secs, 0, time.UTC).Format("4:05"), "0")
}





package filemanager

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"unicode"
)

const (
	MaxFilenameLength = 255
	MaxPathLength     = 500
)

var (
	reservedFilenames = map[string]bool{
		"CON": true, "PRN": true, "AUX": true, "NUL": true,
		"COM1": true, "COM2": true, "COM3": true, "COM4": true,
		"COM5": true, "COM6": true, "COM7": true, "COM8": true, "COM9": true,
		"LPT1": true, "LPT2": true, "LPT3": true, "LPT4": true,
		"LPT5": true, "LPT6": true, "LPT7": true, "LPT8": true, "LPT9": true,
	}
	invalidCharsRegex = regexp.MustCompile(`[<>:"|?*\x00-\x1f]`)
)

func SanitizeFilename(filename string) (string, error) {
	if filename == "" {
		return "", fmt.Errorf("filename cannot be empty")
	}

	filename = strings.TrimSpace(filename)
	if filename == "" {
		return "", fmt.Errorf("filename cannot be empty")
	}

	filename = invalidCharsRegex.ReplaceAllString(filename, "")

	filename = strings.TrimRight(filename, ".")

	if filename == "" {
		return "", fmt.Errorf("filename cannot consist only of invalid characters")
	}

	nameWithoutExt := strings.TrimSuffix(filename, filepath.Ext(filename))
	if nameWithoutExt == "" {
		nameWithoutExt = filename
	}

	upperName := strings.ToUpper(nameWithoutExt)
	if reservedFilenames[upperName] {
		filename = "_" + filename
	}

	if len(filename) > MaxFilenameLength {
		ext := filepath.Ext(filename)
		namePart := filename[:MaxFilenameLength-len(ext)-1]
		filename = namePart + ext
	}

	return filename, nil
}

func SanitizePath(path string) (string, error) {
	if path == "" {
		return "", nil
	}

	path = strings.TrimSpace(path)
	if path == "" {
		return "", nil
	}

	if strings.Contains(path, "..") {
		return "", fmt.Errorf("path traversal detected")
	}

	path = invalidCharsRegex.ReplaceAllString(path, "")

	path = filepath.Clean(path)

	if filepath.IsAbs(path) {
		path = strings.TrimPrefix(path, string(filepath.Separator))
	}

	path = strings.ReplaceAll(path, "\\", "/")
	path = regexp.MustCompile(`/+`).ReplaceAllString(path, "/")
	path = strings.Trim(path, "/")

	if len(path) > MaxPathLength {
		path = path[:MaxPathLength]
	}

	return path, nil
}

func ValidatePath(path string) bool {
	if path == "" {
		return true
	}

	if strings.Contains(path, "..") {
		return false
	}

	if len(path) > MaxPathLength {
		return false
	}

	for _, char := range path {
		if unicode.IsControl(char) {
			return false
		}
		if strings.ContainsRune(`<>:"|?*\`, char) {
			return false
		}
	}

	return true
}

func BuildFilePath(path, filename string) (string, error) {
	sanitizedPath, err := SanitizePath(path)
	if err != nil {
		return "", err
	}

	sanitizedFilename, err := SanitizeFilename(filename)
	if err != nil {
		return "", err
	}

	if sanitizedPath != "" {
		return sanitizedPath + "/" + sanitizedFilename, nil
	}

	return sanitizedFilename, nil
}


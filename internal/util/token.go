package util

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

// GenerateSecureToken creates a cryptographically secure random token with a prefix
func GenerateSecureToken(prefix string) (string, error) {
	randomBytes := make([]byte, 48)
	_, err := rand.Read(randomBytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate random token: %w", err)
	}

	token := base64.RawURLEncoding.EncodeToString(randomBytes)
	if prefix != "" {
		return prefix + "_" + token, nil
	}
	return token, nil
}

package query

import (
	"errors"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/store"
)

func structToHashExp(filterStruct map[string]interface{}) dbx.HashExp {
	hashExp := dbx.HashExp{}
	for key, value := range filterStruct {
		hashExp[key] = value
	}
	return hashExp
}

// ValidateDevToken validates a dev token by encrypting the incoming decrypted token
// and comparing it with the encrypted token stored in the database.
// tokenString should be in format: {user_id}.{decrypted_token}
// The encryption key is retrieved from the app store internally.
// Returns the full DevToken object if valid, or error if invalid/inactive/expired.
// Also updates the last_used_at timestamp.
func ValidateDevToken(tokenString string) (*models.DevToken, error) {
	parts := strings.Split(tokenString, ".")
	if len(parts) != 2 {
		return nil, errors.New("invalid token format")
	}

	userID := parts[0]
	decryptedToken := parts[1]

	// Get encryption key from app store
	encryptionKey := store.GetDao().Store().Get("ENCRYPTION_KEY").(string)

	// Since encryption uses random IVs, the same plaintext produces different ciphertexts.
	// Instead of encrypting the incoming token, we need to:
	// 1. Query tokens by user and is_active (can't query by encrypted value)
	// 2. Decrypt each stored token
	// 3. Compare plaintext values

	// Query all active tokens for the user (usually just a few)
	tokens, err := FindAllByFilter[*models.DevToken](map[string]interface{}{
		"user":      userID,
		"is_active": true,
	})

	if err != nil {
		return nil, err
	}

	// Decrypt each token and compare with incoming token
	var matchingToken *models.DevToken
	for i := range tokens {
		token := tokens[i]
		// Decrypt the stored encrypted token
		decryptedStoredToken, err := security.Decrypt(token.Token, encryptionKey)
		if err != nil {
			// Skip tokens that can't be decrypted
			continue
		}

		// Compare plaintext values (decrypt returns []byte, convert to string)
		if string(decryptedStoredToken) == decryptedToken {
			matchingToken = token
			break
		}
	}

	if matchingToken == nil {
		return nil, errors.New("token not found")
	}

	token := matchingToken

	// Update last used timestamp using query utilities
	token.LastUsedAt = types.NowDateTime()
	if err := SaveRecord(token); err != nil {
		// Log error but don't fail validation - timestamp update is non-critical
		return token, nil
	}

	return token, nil
}

// ValidateDevTokenUserID is a convenience function that returns just the user ID
// Useful for routes that only need the user ID and don't need the full token object
func ValidateDevTokenUserID(tokenString string) (string, error) {
	token, err := ValidateDevToken(tokenString)
	if err != nil {
		return "", err
	}
	return token.User, nil
}

func ValidateLoggingToken(key string) (*models.DevToken, error) {
	encryptionKey := store.GetDao().Store().Get("ENCRYPTION_KEY").(string)

	tokens, err := FindAllByFilter[*models.DevToken](map[string]interface{}{
		"is_active": true,
	})
	if err != nil {
		return nil, err
	}

	for i := range tokens {
		token := tokens[i]
		decryptedStoredToken, err := security.Decrypt(token.Token, encryptionKey)
		if err != nil {
			continue
		}

		if string(decryptedStoredToken) == key {
			token.LastUsedAt = types.NowDateTime()
			_ = SaveRecord(token)

			return token, nil
		}
	}

	return nil, errors.New("invalid API key")
}

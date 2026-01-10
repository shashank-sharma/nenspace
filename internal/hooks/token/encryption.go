package token

import (
	"fmt"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/shashank-sharma/backend/internal/logger"
)

func RegisterEncryptionHooks(pb *pocketbase.PocketBase, encryptionKey string) {
	pb.OnRecordCreate("tokens").BindFunc(func(e *core.RecordEvent) error {
		return encryptTokens(e, encryptionKey)
	})

	pb.OnRecordViewRequest("tokens").BindFunc(func(e *core.RecordRequestEvent) error {
		return decryptTokens(e, encryptionKey)
	})

	pb.OnRecordUpdate("tokens").BindFunc(func(e *core.RecordEvent) error {
		return encryptTokens(e, encryptionKey)
	})

	pb.OnRecordCreate("dev_tokens").BindFunc(func(e *core.RecordEvent) error {
		return encryptDevToken(e, encryptionKey)
	})

	pb.OnRecordViewRequest("dev_tokens").BindFunc(func(e *core.RecordRequestEvent) error {
		return decryptDevToken(e, encryptionKey)
	})

	pb.OnRecordUpdate("dev_tokens").BindFunc(func(e *core.RecordEvent) error {
		return encryptDevToken(e, encryptionKey)
	})
}

func encryptTokens(e *core.RecordEvent, encryptionKey string) error {
	original := e.Record.Original()

	if accessToken := e.Record.GetString("access_token"); accessToken != "" {
		if original == nil || accessToken != original.GetString("access_token") {
			encrypted, err := security.Encrypt([]byte(accessToken), encryptionKey)
			if err != nil {
				return fmt.Errorf("failed to encrypt access_token: %w", err)
			}
			e.Record.Set("access_token", encrypted)
		}
	}

	if refreshToken := e.Record.GetString("refresh_token"); refreshToken != "" {
		if original == nil || refreshToken != original.GetString("refresh_token") {
			encrypted, err := security.Encrypt([]byte(refreshToken), encryptionKey)
			if err != nil {
				return fmt.Errorf("failed to encrypt refresh_token: %w", err)
			}
			e.Record.Set("refresh_token", encrypted)
		}
	}

	return e.Next()
}

func decryptTokens(e *core.RecordRequestEvent, encryptionKey string) error {
	if encryptedToken := e.Record.GetString("access_token"); encryptedToken != "" {
		decrypted, err := security.Decrypt(encryptedToken, encryptionKey)
		if err != nil {
			logger.LogError("Failed to decrypt access_token: %v", err)
			e.Record.Set("access_token", "[decryption failed]")
		} else {
			e.Record.Set("access_token", decrypted)
		}
	}

	if encryptedToken := e.Record.GetString("refresh_token"); encryptedToken != "" {
		decrypted, err := security.Decrypt(encryptedToken, encryptionKey)
		if err != nil {
			logger.LogError("Failed to decrypt refresh_token: %v", err)
			e.Record.Set("refresh_token", "[decryption failed]")
		} else {
			e.Record.Set("refresh_token", decrypted)
		}
	}

	return e.Next()
}

func encryptDevToken(e *core.RecordEvent, encryptionKey string) error {
	tokenValue := e.Record.GetString("token")
	if tokenValue == "" {
		return e.Next()
	}

	// Skip encryption if token hasn't changed (prevents double-encryption on updates)
	if original := e.Record.Original(); original != nil {
		if tokenValue == original.GetString("token") {
			return e.Next()
		}
	}

	encrypted, err := security.Encrypt([]byte(tokenValue), encryptionKey)
	if err != nil {
		return fmt.Errorf("failed to encrypt dev token: %w", err)
	}
	e.Record.Set("token", encrypted)

	return e.Next()
}

func decryptDevToken(e *core.RecordRequestEvent, encryptionKey string) error {
	if encryptedToken := e.Record.GetString("token"); encryptedToken != "" {
		decrypted, err := security.Decrypt(encryptedToken, encryptionKey)
		if err != nil {
			logger.LogError("Failed to decrypt dev token: %v", err)
			e.Record.Set("token", "[decryption failed]")
		} else {
			e.Record.Set("token", decrypted)
		}
	}

	return e.Next()
}

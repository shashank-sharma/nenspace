package routes

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/store"
	"github.com/shashank-sharma/backend/internal/util"
)

func RegisterDevTokenRoutes(e *core.ServeEvent) {
	e.Router.POST("/api/dev-tokens/generate", GenerateDevToken)
	e.Router.GET("/api/dev-tokens", ListDevTokens)
	e.Router.DELETE("/api/dev-tokens/:id", RevokeDevToken)
}

// generateSecureToken creates a cryptographically secure random token
func generateSecureToken() (string, error) {
	// Generate 48 bytes (384 bits) of random data
	randomBytes := make([]byte, 48)
	_, err := rand.Read(randomBytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate random token: %w", err)
	}

	// Encode to base64 URL-safe format
	token := base64.RawURLEncoding.EncodeToString(randomBytes)
	return "dev_" + token, nil
}

// GenerateDevToken creates a new dev token for the authenticated user
func GenerateDevToken(e *core.RequestEvent) error {
	// Get user ID from auth token
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusUnauthorized, map[string]interface{}{
			"error": "Authentication required",
		})
	}

	// Parse request body
	var requestData struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(e.Request.Body).Decode(&requestData); err != nil {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
	}

	if requestData.Name == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "Token name is required",
		})
	}

	// Check user's current token count
	app := store.GetDao()
	maxTokensStr := app.Store().Get("MAX_DEV_TOKENS_PER_USER").(string)
	maxTokens, err := strconv.Atoi(maxTokensStr)
	if err != nil {
		maxTokens = 10 // fallback to default
	}

	// Count active tokens for user
	var count int64
	err = app.DB().Select("count(*)").
		From("dev_tokens").
		Where(dbx.HashExp{"user": userId, "is_active": true}).
		Row(&count)
	
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to count user tokens",
		})
	}

	if count >= int64(maxTokens) {
		return e.JSON(http.StatusTooManyRequests, map[string]interface{}{
			"error": fmt.Sprintf("maximum dev tokens limit reached (%d/%d)", count, maxTokens),
		})
	}

	// Generate secure token
	tokenValue, err := generateSecureToken()
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to generate token",
		})
	}

	// Create new dev token record
	devToken := &models.DevToken{
		User:     userId,
		Token:    tokenValue,
		Name:     requestData.Name,
		IsActive: true,
	}
	devToken.SetId(util.GenerateRandomId())
	devToken.RefreshCreated()
	devToken.RefreshUpdated()

	// Insert into database (hook will encrypt the token automatically)
	err = app.DB().Model(devToken).Insert()
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to create dev token",
		})
	}

	// Return generated token (plain text, only shown once)
	generatedToken := map[string]interface{}{
		"id":        devToken.Id,
		"token":     tokenValue,
		"name":      requestData.Name,
		"created_at": devToken.Created,
		"warning":   "Save this token securely. You won't be able to see it again.",
	}

	return e.JSON(http.StatusCreated, generatedToken)
}

// ListDevTokens returns all dev tokens for the authenticated user (metadata only)
func ListDevTokens(e *core.RequestEvent) error {
	// Get user ID from auth token
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusUnauthorized, map[string]interface{}{
			"error": "Authentication required",
		})
	}

	// List tokens using query
	tokens, err := query.FindAllByFilter[*models.DevToken](map[string]interface{}{
		"user": userId,
	})
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to retrieve tokens",
		})
	}

	// Convert to metadata (excluding token values)
	metadata := make([]map[string]interface{}, len(tokens))
	for i, token := range tokens {
		metadata[i] = map[string]interface{}{
			"id":          token.Id,
			"name":        token.Name,
			"is_active":   token.IsActive,
			"created_at":  token.Created,
			"last_used_at": token.LastUsedAt,
			"expires_at":  token.ExpiresAt,
		}
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"tokens": metadata,
		"count":  len(metadata),
	})
}

// RevokeDevToken deactivates a specific dev token
func RevokeDevToken(e *core.RequestEvent) error {
	// Get user ID from auth token
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusUnauthorized, map[string]interface{}{
			"error": "Authentication required",
		})
	}

	// Get token ID from URL
	tokenId := e.Request.PathValue("id")
	if tokenId == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "Token ID is required",
		})
	}

	// Verify token belongs to user
	devToken, err := query.FindByFilter[*models.DevToken](map[string]interface{}{
		"id":   tokenId,
		"user": userId,
	})
	
	if err != nil {
		return e.JSON(http.StatusNotFound, map[string]interface{}{
			"error": "Token not found or access denied",
		})
	}

	// Deactivate token
	devToken.IsActive = false
	devToken.RefreshUpdated()

	app := store.GetDao()
	err = app.DB().Model(devToken).Update()
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to revoke token",
		})
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"message": "Token revoked successfully",
	})
}


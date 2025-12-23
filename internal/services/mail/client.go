package mail

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/gmail/v1"
	"google.golang.org/api/option"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

const (
	// OAuth state token for CSRF protection
	oauthStateToken = "state-token"
)

// MailServiceConfig holds configuration for the mail service
type MailServiceConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

// MailService handles Gmail integration and operations
type MailService struct {
	googleConfig *oauth2.Config
	config       *MailServiceConfig
}

// NewMailService creates a new MailService instance with configuration from environment variables
func NewMailService() *MailService {
	config := &MailServiceConfig{
		ClientID:     os.Getenv("GCP_MAIL_CLIENT_ID"),
		ClientSecret: os.Getenv("GCP_MAIL_CLIENT_SECRET"),
		RedirectURL:  os.Getenv("GCP_MAIL_REDIRECT_URL"),
	}

	googleConfig := &oauth2.Config{
		ClientID:     config.ClientID,
		ClientSecret: config.ClientSecret,
		RedirectURL:  config.RedirectURL,
		Endpoint:     google.Endpoint,
		Scopes: []string{
			gmail.GmailReadonlyScope,
			"https://www.googleapis.com/auth/userinfo.email",
		},
	}

	return &MailService{
		googleConfig: googleConfig,
		config:       config,
	}
}

// GetAuthUrl generates an OAuth authorization URL for Gmail authentication
func (ms *MailService) GetAuthUrl() string {
	return ms.googleConfig.AuthCodeURL(
		oauthStateToken,
		oauth2.AccessTypeOffline,
		oauth2.ApprovalForce,
		oauth2.SetAuthURLParam("prompt", "consent"),
		oauth2.SetAuthURLParam("redirect_uri", ms.googleConfig.RedirectURL),
	)
}

// GetConfig returns the OAuth2 configuration
func (ms *MailService) GetConfig() *oauth2.Config {
	return ms.googleConfig
}

// tokenSource wraps the OAuth2 token source to save refreshed tokens and handle errors
type tokenSource struct {
	ctx          context.Context
	config       *oauth2.Config
	token        *oauth2.Token
	tokenId      string
	baseTokenSrc oauth2.TokenSource
}

func (ts *tokenSource) Token() (*oauth2.Token, error) {
	// Get token from base token source (handles refresh automatically)
	newToken, err := ts.baseTokenSrc.Token()
	if err != nil {
		// Check if this is an invalid_grant error (case-insensitive)
		errMsg := strings.ToLower(err.Error())
		if strings.Contains(errMsg, "invalid_grant") {
			logger.LogError(fmt.Sprintf("Invalid grant error for token %s - token may be expired or revoked", ts.tokenId), err)

			// Mark token as inactive
			updateData := map[string]interface{}{
				"is_active": false,
			}
			if updateErr := query.UpdateRecord[*models.Token](ts.tokenId, updateData); updateErr != nil {
				logger.LogError(fmt.Sprintf("Failed to mark token %s as inactive", ts.tokenId), updateErr)
			}

			return nil, fmt.Errorf("OAuth token is invalid or expired. Please re-authenticate your Gmail account: %w", err)
		}
		return nil, err
	}

	// If token was refreshed, save it to the database
	if newToken.AccessToken != ts.token.AccessToken {
		logger.Debug.Printf("Token refreshed for token ID: %s", ts.tokenId)

		expiry := types.DateTime{}
		expiry.Scan(newToken.Expiry)

		updateData := map[string]interface{}{
			"access_token":  newToken.AccessToken,
			"token_type":    newToken.TokenType,
			"refresh_token": newToken.RefreshToken,
			"expiry":        expiry,
			"last_used":     types.NowDateTime(),
		}

		// Only update refresh_token if a new one was provided
		if newToken.RefreshToken != "" {
			updateData["refresh_token"] = newToken.RefreshToken
		}

		if err := query.UpdateRecord[*models.Token](ts.tokenId, updateData); err != nil {
			logger.LogError(fmt.Sprintf("Failed to save refreshed token for token ID: %s", ts.tokenId), err)
			// Don't fail the request, just log the error
		} else {
			// Update local token for next comparison
			ts.token = newToken
		}
	}

	return newToken, nil
}

// FetchClient retrieves an authenticated HTTP client for a given token ID
// Returns an error if the token cannot be found or is invalid
// The context should remain alive for the duration of all API calls that use this client
func (ms *MailService) FetchClient(ctx context.Context, tokenId string) (*http.Client, error) {
	if tokenId == "" {
		return nil, fmt.Errorf("token ID cannot be empty")
	}

	if ctx == nil {
		ctx = context.Background()
	}

	token, err := query.FindById[*models.Token](tokenId)
	if err != nil {
		return nil, fmt.Errorf("failed to find token with ID %s: %w", tokenId, err)
	}

	if !token.IsActive {
		return nil, fmt.Errorf("token %s is marked as inactive - please re-authenticate", tokenId)
	}

	oauthToken := &oauth2.Token{
		AccessToken:  token.AccessToken,
		TokenType:    token.TokenType,
		RefreshToken: token.RefreshToken,
		Expiry:       token.Expiry.Time(),
	}

	logger.Debug.Printf("Retrieved OAuth token for token ID: %s, expires at: %v", tokenId, oauthToken.Expiry)

	// Create base token source
	baseTokenSrc := ms.googleConfig.TokenSource(ctx, oauthToken)

	// Wrap it with our custom token source
	customTokenSrc := &tokenSource{
		ctx:          ctx,
		config:       ms.googleConfig,
		token:        oauthToken,
		tokenId:      tokenId,
		baseTokenSrc: baseTokenSrc,
	}

	// Create client with custom token source
	return oauth2.NewClient(ctx, customTokenSrc), nil
}

// GetGmailService creates a Gmail API service client using the provided HTTP client
func (ms *MailService) GetGmailService(ctx context.Context, client *http.Client) (*gmail.Service, error) {
	if client == nil {
		return nil, fmt.Errorf("HTTP client cannot be nil")
	}

	if ctx == nil {
		ctx = context.Background()
	}

	service, err := gmail.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, fmt.Errorf("failed to create Gmail service: %w", err)
	}

	return service, nil
}

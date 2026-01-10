package calendar

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/credentials"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
)

type CalendarService struct {
	googleConfig *oauth2.Config
}

func NewCalendarService() *CalendarService {
	googleConfig := &oauth2.Config{
		ClientID:     os.Getenv("GCP_CAL_CLIENT_ID"),
		ClientSecret: os.Getenv("GCP_CAL_CLIENT_SECRET"),
		RedirectURL:  os.Getenv("GCP_CAL_REDIRECT_URL"),
		Endpoint:     google.Endpoint,
		Scopes:       []string{calendar.CalendarReadonlyScope, "https://www.googleapis.com/auth/userinfo.email"},
	}

	return &CalendarService{
		googleConfig: googleConfig,
	}
}

func (cs *CalendarService) GetAuthUrl() string {
	return cs.googleConfig.AuthCodeURL("state-token", oauth2.AccessTypeOffline, oauth2.ApprovalForce, oauth2.SetAuthURLParam("prompt", "consent"), oauth2.SetAuthURLParam("redirect_uri", cs.googleConfig.RedirectURL))
}

func (cs *CalendarService) GetConfig() *oauth2.Config {
	return cs.googleConfig
}

// tokenSource wraps the OAuth2 token source to save refreshed tokens and handle errors
type calendarTokenSource struct {
	ctx          context.Context
	config       *oauth2.Config
	token        *oauth2.Token
	tokenId      string
	baseTokenSrc oauth2.TokenSource
}

func (ts *calendarTokenSource) Token() (*oauth2.Token, error) {
	// Get token from base token source (handles refresh automatically)
	newToken, err := ts.baseTokenSrc.Token()
	if err != nil {
		// Check if this is an invalid_grant error (case-insensitive)
		errMsg := strings.ToLower(err.Error())
		if strings.Contains(errMsg, "invalid_grant") {
			logger.LogInfo(fmt.Sprintf("Token %s expired or revoked - user needs to re-authenticate", ts.tokenId))

			// Mark token as inactive
			updateData := map[string]interface{}{
				"is_active": false,
			}
			if updateErr := query.UpdateRecord[*models.Token](ts.tokenId, updateData); updateErr != nil {
				logger.LogError(fmt.Sprintf("Failed to mark token %s as inactive", ts.tokenId), updateErr)
			}

			return nil, fmt.Errorf("OAuth token is invalid or expired. Please re-authenticate your Google Calendar account: %w", err)
		}
		return nil, err
	}

	// If token was refreshed, save it to the database
	if newToken.AccessToken != ts.token.AccessToken {
		logger.LogDebug("Token refreshed for token ID", "tokenId", ts.tokenId)

		expiry := types.DateTime{}
		expiry.Scan(newToken.Expiry)

		updateData := map[string]interface{}{
			"access_token":  newToken.AccessToken,
			"token_type":    newToken.TokenType,
			"refresh_token": newToken.RefreshToken,
			"expiry":        expiry,
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

func (cs *CalendarService) FetchClient(ctx context.Context, calTokenId string) (*http.Client, error) {
	if calTokenId == "" {
		return nil, fmt.Errorf("token ID cannot be empty")
	}

	if ctx == nil {
		ctx = context.Background()
	}

	calendarToken, err := query.FindById[*models.Token](calTokenId)
	if err != nil {
		return nil, fmt.Errorf("failed to find token with ID %s: %w", calTokenId, err)
	}

	if !calendarToken.IsActive {
		return nil, fmt.Errorf("token %s is marked as inactive - please re-authenticate", calTokenId)
	}

	oauthToken := &oauth2.Token{
		AccessToken:  calendarToken.AccessToken,
		TokenType:    calendarToken.TokenType,
		RefreshToken: calendarToken.RefreshToken,
		Expiry:       calendarToken.Expiry.Time(),
	}

	logger.LogDebug("Retrieved OAuth token for calendar", "tokenId", calTokenId, "expiresAt", oauthToken.Expiry)

	// Create base token source
	baseTokenSrc := cs.googleConfig.TokenSource(ctx, oauthToken)

	// Wrap it with our custom token source
	customTokenSrc := &calendarTokenSource{
		ctx:          ctx,
		config:       cs.googleConfig,
		token:        oauthToken,
		tokenId:      calTokenId,
		baseTokenSrc: baseTokenSrc,
	}

	// Create client with custom token source
	oauthClient := oauth2.NewClient(ctx, customTokenSrc)

	trackedClient := credentials.WrapOAuthClient(oauthClient, "token", calTokenId, "calendar")

	return trackedClient, nil
}

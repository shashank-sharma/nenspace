package calendar

import (
	"context"
	"net/http"
	"os"

	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
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

func (cs *CalendarService) FetchClient(calTokenId string) (*http.Client, error) {
	calendarToken, err := query.FindById[*models.Token](calTokenId)
	if err != nil {
		return nil, err
	}

	oauthToken := &oauth2.Token{
		AccessToken:  calendarToken.AccessToken,
		TokenType:    calendarToken.TokenType,
		RefreshToken: calendarToken.RefreshToken,
		Expiry:       calendarToken.Expiry.Time(),
	}

	return cs.googleConfig.Client(context.Background(), oauthToken), nil
}

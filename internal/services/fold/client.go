package fold

import (
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"time"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
)

type APIClient struct {
	httpClient *http.Client
	baseUrl    string
}

type FoldService struct {
	client *APIClient
}

// DefaultHTTPTimeout is the default timeout for HTTP requests
const DefaultHTTPTimeout = 60 * time.Second

func NewFoldService(baseUrl string) *FoldService {
	return &FoldService{
		client: newAPIClient(baseUrl, DefaultHTTPTimeout),
	}
}

func newAPIClient(baseUrl string, timeout time.Duration) *APIClient {
	return &APIClient{
		httpClient: &http.Client{
			Timeout: timeout,
		},
		baseUrl: baseUrl,
	}
}

func (c *APIClient) Url(route string) string {
	u, _ := url.Parse(c.baseUrl)
	u.Path = path.Join(u.Path, route)
	return u.String()
}

func (c *APIClient) NewRequest(method, route string, body io.Reader, tokenModel *models.FoldToken) (*http.Request, error) {
	reqUrl := c.Url(route)
	req, err := http.NewRequest(method, reqUrl, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+tokenModel.AccessToken)
	req.Header.Set("X-User-Agent", tokenModel.UserAgent)
	req.Header.Set("X-Device-Hash", tokenModel.DeviceHash)
	req.Header.Set("X-Device-Location", tokenModel.DeviceLocation)
	req.Header.Set("X-Device-Name", tokenModel.DeviceName)
	req.Header.Set("X-Device-Type", tokenModel.DeviceType)

	c.logRequest(req)

	return req, nil
}

func (c *APIClient) Do(req *http.Request) (*http.Response, error) {
	return c.httpClient.Do(req)
}

func (c *APIClient) logRequest(req *http.Request) {
	dump, err := httputil.DumpRequestOut(req, true)
	if err != nil {
		logger.Debug.Println("Error dumping request:", err)
	}
	logger.Debug.Println("API request:", string(dump))
}

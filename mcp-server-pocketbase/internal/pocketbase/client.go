package pocketbase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

type TokenInfo struct {
	Token     string
	ExpiresAt time.Time
	Email     string
	Password  string
}

type Client struct {
	BaseURL      string
	HTTPClient   *http.Client
	tokens       map[string]*TokenInfo
	defaultToken string
	mu           sync.RWMutex
}

func NewClient(baseURL string, timeout time.Duration) *Client {
	return &Client{
		BaseURL: strings.TrimSuffix(baseURL, "/"),
		HTTPClient: &http.Client{
			Timeout: timeout,
		},
		tokens: make(map[string]*TokenInfo),
	}
}

func (c *Client) SetDefaultToken(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.defaultToken = token
}

func (c *Client) GetToken(providedToken string) string {
	if providedToken != "" {
		return providedToken
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.defaultToken
}

func (c *Client) AuthWithPassword(ctx context.Context, email, password string) (*AuthResponse, error) {
	data := map[string]string{
		"identity": email,
		"password": password,
	}
	body, _ := json.Marshal(data)

	req, _ := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/api/collections/users/auth-with-password", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp ErrorResponse
		json.NewDecoder(resp.Body).Decode(&errResp)
		return nil, fmt.Errorf("auth failed (%d): %s", resp.StatusCode, errResp.Message)
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.tokens[email] = &TokenInfo{
		Token:     authResp.Token,
		ExpiresAt: time.Now().Add(168 * time.Hour),
		Email:     email,
		Password:  password,
	}
	c.mu.Unlock()

	return &authResp, nil
}

func (c *Client) RefreshToken(ctx context.Context, token string) (*AuthResponse, error) {
	req, _ := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/api/collections/users/auth-refresh", nil)
	req.Header.Set("Authorization", token)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("refresh failed (%d)", resp.StatusCode)
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return nil, err
	}

	return &authResp, nil
}

func (c *Client) ListCollections(ctx context.Context, token string) ([]Collection, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", c.BaseURL+"/api/collections", nil)
	if token != "" {
		req.Header.Set("Authorization", token)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to list collections (%d)", resp.StatusCode)
	}

	var result struct {
		Items []Collection `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Items, nil
}

type ListOptions struct {
	Page    int
	PerPage int
	Sort    string
	Filter  string
	Expand  string
}

func (c *Client) ListRecords(ctx context.Context, collection string, opts ListOptions, token string) (*ListResult, error) {
	u, _ := url.Parse(fmt.Sprintf("%s/api/collections/%s/records", c.BaseURL, collection))
	q := u.Query()
	if opts.Page > 0 {
		q.Set("page", strconv.Itoa(opts.Page))
	}
	if opts.PerPage > 0 {
		q.Set("perPage", strconv.Itoa(opts.PerPage))
	}
	if opts.Sort != "" {
		q.Set("sort", opts.Sort)
	}
	if opts.Filter != "" {
		q.Set("filter", opts.Filter)
	}
	if opts.Expand != "" {
		q.Set("expand", opts.Expand)
	}
	u.RawQuery = q.Encode()

	req, _ := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if token != "" {
		req.Header.Set("Authorization", token)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.handleError(resp)
	}

	var result ListResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

func (c *Client) GetRecord(ctx context.Context, collection, id string, expand string, token string) (map[string]any, error) {
	u, _ := url.Parse(fmt.Sprintf("%s/api/collections/%s/records/%s", c.BaseURL, collection, id))
	if expand != "" {
		q := u.Query()
		q.Set("expand", expand)
		u.RawQuery = q.Encode()
	}

	req, _ := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if token != "" {
		req.Header.Set("Authorization", token)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.handleError(resp)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

func (c *Client) CreateRecord(ctx context.Context, collection string, data map[string]any, token string) (map[string]any, error) {
	body, _ := json.Marshal(data)
	req, _ := http.NewRequestWithContext(ctx, "POST", fmt.Sprintf("%s/api/collections/%s/records", c.BaseURL, collection), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", token)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, c.handleError(resp)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

func (c *Client) UpdateRecord(ctx context.Context, collection, id string, data map[string]any, token string) (map[string]any, error) {
	body, _ := json.Marshal(data)
	req, _ := http.NewRequestWithContext(ctx, "PATCH", fmt.Sprintf("%s/api/collections/%s/records/%s", c.BaseURL, collection, id), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", token)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.handleError(resp)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

func (c *Client) DeleteRecord(ctx context.Context, collection, id string, token string) error {
	req, _ := http.NewRequestWithContext(ctx, "DELETE", fmt.Sprintf("%s/api/collections/%s/records/%s", c.BaseURL, collection, id), nil)
	if token != "" {
		req.Header.Set("Authorization", token)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return c.handleError(resp)
	}

	return nil
}

func (c *Client) GetCurrentUser(ctx context.Context, token string) (map[string]any, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", c.BaseURL+"/api/collections/users/auth-refresh", nil)
	req.Header.Set("Authorization", token)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.handleError(resp)
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return nil, err
	}

	return authResp.Record, nil
}

func (c *Client) handleError(resp *http.Response) error {
	var errResp ErrorResponse
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &errResp)

	msg := errResp.Message
	if msg == "" {
		msg = "Unknown error"
	}

	switch resp.StatusCode {
	case http.StatusBadRequest:
		return fmt.Errorf("invalid request: %s", msg)
	case http.StatusUnauthorized:
		return fmt.Errorf("unauthorized: %s (token may be expired)", msg)
	case http.StatusForbidden:
		return fmt.Errorf("forbidden: %s", msg)
	case http.StatusNotFound:
		return fmt.Errorf("not found: %s", msg)
	default:
		return fmt.Errorf("pocketbase error (%d): %s", resp.StatusCode, msg)
	}
}

func (c *Client) GetFileURL(collection, recordID, filename string) string {
	return fmt.Sprintf("%s/api/files/%s/%s/%s", c.BaseURL, collection, recordID, filename)
}

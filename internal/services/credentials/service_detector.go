package credentials

import (
	"net/http"
	"net/url"
	"strings"
)

func DetectService(req *http.Request) string {
	if service := detectFromURL(req.URL); service != "" {
		return service
	}

	if service := detectFromHeaders(req); service != "" {
		return service
	}

	return "unknown"
}

func detectFromURL(u *url.URL) string {
	host := strings.ToLower(u.Host)

	if idx := strings.Index(host, ":"); idx != -1 {
		host = host[:idx]
	}

	serviceMap := map[string]string{
		"api.openai.com":            "openai",
		"api.anthropic.com":         "claude",
		"api.github.com":            "github",
		"api.githubusercontent.com": "github",
		"gmail.googleapis.com":      "gmail",
		"www.googleapis.com":        "google",
		"calendar.googleapis.com":   "calendar",
		"api.fold.money":            "fold",
		"api.fold.money/api":        "fold",
	}

	if service, ok := serviceMap[host]; ok {
		return service
	}

	for pattern, service := range serviceMap {
		if strings.Contains(host, pattern) {
			return service
		}
	}

	if strings.Contains(host, "openai") {
		return "openai"
	}
	if strings.Contains(host, "anthropic") || strings.Contains(host, "claude") {
		return "claude"
	}
	if strings.Contains(host, "github") {
		return "github"
	}
	if strings.Contains(host, "google") {
		return "google"
	}

	return ""
}

func detectFromHeaders(req *http.Request) string {
	if req.Header.Get("X-API-Key") != "" {
		return ""
	}

	if req.Header.Get("anthropic-version") != "" {
		return "claude"
	}

	if strings.Contains(req.Header.Get("User-Agent"), "OpenAI") {
		return "openai"
	}

	return ""
}

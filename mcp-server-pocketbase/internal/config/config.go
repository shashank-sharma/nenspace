package config

import (
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	PocketBaseURL string
	LogLevel      string
	HTTPTimeout   time.Duration
	AdminEmail    string
	AdminPassword string
	DefaultToken  string
}

func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		PocketBaseURL: getEnv("POCKETBASE_URL", "http://localhost:8090"),
		LogLevel:      getEnv("LOG_LEVEL", "info"),
		HTTPTimeout:   getDurationEnv("HTTP_TIMEOUT", 30*time.Second),
		AdminEmail:    getEnv("POCKETBASE_ADMIN_EMAIL", ""),
		AdminPassword: getEnv("POCKETBASE_ADMIN_PASSWORD", ""),
		DefaultToken:  getEnv("POCKETBASE_TOKEN", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value, ok := os.LookupEnv(key); ok {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}

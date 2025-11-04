package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/pocketbase/pocketbase"
	"github.com/shashank-sharma/backend/internal/logger"
)

var EnableMetricsFlag bool
var FileLoggingFlag bool
var WithGuiFlag bool

type ConfigFlags struct {
	Metrics     bool
	FileLogging bool
	WithGui     bool
	Dev         bool
	HttpAddr    string
}

func getEnv(key string, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// Init initializes and validates configuration
func Init(pb *pocketbase.PocketBase, configFlags ConfigFlags) error {
	err := godotenv.Load()
	if err != nil {
		// Not critical - environment variables can be set directly
		logger.LogWarning("Failed to load .env file, using environment variables directly")
	}

	// Get encryption key - require it in production
	encryptionKey := getEnv("ENCRYPTION_KEY", "")
	if !configFlags.Dev && encryptionKey == "" {
		return fmt.Errorf("ENCRYPTION_KEY is required in production mode")
	}
	if encryptionKey == "" {
		encryptionKey = "default_encryption_key"
		logger.LogWarning("Using default encryption key - this should only be used in development")
	}

	// Validate encryption key length (min 32 bytes for security)
	if len(encryptionKey) < 32 && !configFlags.Dev {
		return fmt.Errorf("ENCRYPTION_KEY must be at least 32 characters long in production")
	}

	// Set configuration values
	pb.Store().Set("ENCRYPTION_KEY", encryptionKey)
	pb.Store().Set("METRICS_ENABLED", configFlags.Metrics)
	pb.Store().Set("METRICS_PORT", getEnv("METRICS_PORT", "9091"))
	pb.Store().Set("FILE_LOGGING_ENABLED", configFlags.FileLogging)
	pb.Store().Set("LOG_FILE_PATH", getEnv("LOG_FILE_PATH", "logs/app.log"))
	pb.Store().Set("WITH_GUI", configFlags.WithGui)
	pb.Store().Set("DEV", configFlags.Dev)
	pb.Store().Set("HTTP_ADDR", configFlags.HttpAddr)
	pb.Store().Set("MAX_DEV_TOKENS_PER_USER", getEnv("MAX_DEV_TOKENS_PER_USER", "10"))
	pb.Store().Set("FOLD_API_URL", getEnv("FOLD_API_URL", "https://api.fold.money/api"))

	// Set global flags for easy access
	EnableMetricsFlag = configFlags.Metrics
	FileLoggingFlag = configFlags.FileLogging
	WithGuiFlag = configFlags.WithGui

	return nil
}

package logging

import (
	"os"
	"strconv"
	"time"
)

type Config struct {

	BatchSize int

	FlushInterval time.Duration

	BufferSize int

	WorkerPoolSize int

	RetryAttempts int

	RetryBackoff time.Duration
}

func DefaultConfig() *Config {
	return &Config{
		BatchSize:      getEnvInt("LOGGING_BATCH_SIZE", 100),
		FlushInterval:  getEnvDuration("LOGGING_FLUSH_INTERVAL", 5*time.Second),
		BufferSize:     getEnvInt("LOGGING_BUFFER_SIZE", 5000),
		WorkerPoolSize: getEnvInt("LOGGING_WORKER_POOL_SIZE", 5),
		RetryAttempts:  getEnvInt("LOGGING_RETRY_ATTEMPTS", 3),
		RetryBackoff:   getEnvDuration("LOGGING_RETRY_BACKOFF", 1*time.Second),
	}
}

func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}

	intValue, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}

	return intValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}

	duration, err := time.ParseDuration(value)
	if err != nil {
		return defaultValue
	}

	return duration
}

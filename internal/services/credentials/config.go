package credentials

import (
	"os"
	"strconv"
	"time"
)

// Config holds configuration for credential usage tracking
type Config struct {
	// BatchSize is the number of events to batch before flushing
	BatchSize int
	
	// FlushInterval is the time interval to flush events even if batch is not full
	FlushInterval time.Duration
	
	// BufferSize is the maximum number of events to buffer in memory
	BufferSize int
	
	// WorkerPoolSize is the maximum number of concurrent workers
	WorkerPoolSize int
	
	// RetryAttempts is the number of retry attempts for failed writes
	RetryAttempts int
	
	// RetryBackoff is the backoff duration between retries
	RetryBackoff time.Duration
}

// DefaultConfig returns default configuration
func DefaultConfig() *Config {
	return &Config{
		BatchSize:      getEnvInt("CREDENTIAL_TRACKING_BATCH_SIZE", 50),
		FlushInterval:  getEnvDuration("CREDENTIAL_TRACKING_FLUSH_INTERVAL", 5*time.Second),
		BufferSize:     getEnvInt("CREDENTIAL_TRACKING_BUFFER_SIZE", 1000),
		WorkerPoolSize: getEnvInt("CREDENTIAL_TRACKING_WORKER_POOL_SIZE", 10),
		RetryAttempts:  getEnvInt("CREDENTIAL_TRACKING_RETRY_ATTEMPTS", 3),
		RetryBackoff:   getEnvDuration("CREDENTIAL_TRACKING_RETRY_BACKOFF", 1*time.Second),
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


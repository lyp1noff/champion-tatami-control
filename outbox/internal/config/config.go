package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all configuration for the outbox service
type Config struct {
	DatabaseURL        string
	ExternalAPIURL     string
	ExternalAPIToken   string
	ProcessingInterval time.Duration
	BatchSize          int
	HTTPTimeout        time.Duration
	MaxRetries         int
	LogLevel           string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	config := &Config{
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		ExternalAPIURL:     getEnv("EXTERNAL_API_URL", ""),
		ExternalAPIToken:   getEnv("EXTERNAL_API_TOKEN", ""),
		ProcessingInterval: getDurationEnv("PROCESSING_INTERVAL", 5*time.Second),
		BatchSize:          getIntEnv("BATCH_SIZE", 10),
		HTTPTimeout:        getDurationEnv("HTTP_TIMEOUT", 10*time.Second),
		MaxRetries:         getIntEnv("MAX_RETRIES", 3),
		LogLevel:           getEnv("LOG_LEVEL", "info"),
	}

	return config
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getIntEnv gets an integer environment variable with a default value
func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getDurationEnv gets a duration environment variable with a default value
func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

package http

import (
	"bytes"
	"fmt"
	"io"
	"net/http"

	"outbox-worker/internal/logger"

	"outbox-worker/internal/config"
	"outbox-worker/internal/database"
)

// HTTPClient handles HTTP requests for outbox items
type HTTPClient struct {
	client *http.Client
	token  string
	logger *logger.Logger
}

// NewHTTPClient creates a new HTTP client instance
func NewHTTPClient(config *config.Config, logger *logger.Logger) *HTTPClient {
	return &HTTPClient{
		client: &http.Client{
			Timeout: config.HTTPTimeout,
		},
		token:  config.ExternalAPIToken,
		logger: logger,
	}
}

func shouldRetry(status int) bool {
	switch {
	case status >= 500:
		return true
	case status == 408:
		return true
	case status == 429:
		return true
	case status == 409:
		return true
	default:
		return false
	}
}

// SendRequest sends an HTTP request for an outbox item
func (c *HTTPClient) SendRequest(item database.OutboxItem) (bool, error) {
	c.logger.Debug("Sending %s %s", item.Method, item.Endpoint)
	if item.Payload != nil {
		c.logger.Debug("Payload: %s", *item.Payload)
	} else {
		c.logger.Debug("Payload: <nil>")
	}

	var body io.Reader
	if item.Payload != nil {
		body = bytes.NewBufferString(*item.Payload)
	}

	req, err := http.NewRequest(item.Method, item.Endpoint, body)
	if err != nil {
		c.logger.Error("Failed to create request for item %d: %v", item.ID, err)
		return true, fmt.Errorf("failed to create request: %w", err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return true, fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	status := resp.StatusCode

	if status >= 200 && status < 300 {
		return false, nil
	}

	if shouldRetry(status) {
		return true, fmt.Errorf("retryable status %d", status)
	}

	return false, fmt.Errorf("non-retryable status %d", status)
}

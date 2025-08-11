package http

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"time"

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

// SendRequest sends an HTTP request for an outbox item
func (c *HTTPClient) SendRequest(item database.OutboxItem) error {
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
		return fmt.Errorf("failed to create request: %w", err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	start := time.Now()
	resp, err := c.client.Do(req)
	duration := time.Since(start)

	if err != nil {
		c.logger.Error("Request failed for item %d after %v: %v", item.ID, duration, err)
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	c.logger.Debug("Request for item %d completed in %v with status: %d", item.ID, duration, resp.StatusCode)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		c.logger.Debug("Request for item %d successful", item.ID)
		return nil
	}

	c.logger.Error("Request for item %d failed with non-2xx status: %d", item.ID, resp.StatusCode)
	return fmt.Errorf("non-2xx response: %d", resp.StatusCode)
}

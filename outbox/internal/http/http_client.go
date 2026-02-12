package http

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

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

type syncConflict struct {
	Reason string `json:"reason"`
}

type syncCommandsResponse struct {
	Accepted   []int          `json:"accepted"`
	Duplicates []int          `json:"duplicates"`
	Conflicts  []syncConflict `json:"conflicts"`
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
	bodyBytes, _ := io.ReadAll(resp.Body)
	bodyText := strings.TrimSpace(string(bodyBytes))

	if status >= 200 && status < 300 {
		if strings.HasSuffix(item.Endpoint, "/sync/commands") && len(bodyBytes) > 0 {
			var syncResp syncCommandsResponse
			if err := json.Unmarshal(bodyBytes, &syncResp); err == nil {
				if len(syncResp.Conflicts) > 0 {
					reason := syncResp.Conflicts[0].Reason
					if reason == "out_of_order" {
						return true, fmt.Errorf("sync conflict (retryable): %s", reason)
					}
					return false, fmt.Errorf("sync conflict (non-retryable): %s", reason)
				}
				if len(syncResp.Accepted) == 0 && len(syncResp.Duplicates) == 0 {
					return true, fmt.Errorf("sync response has no accepted/duplicates")
				}
			}
		}
		return false, nil
	}

	if shouldRetry(status) {
		if bodyText != "" {
			return true, fmt.Errorf("retryable status %d: %s", status, bodyText)
		}
		return true, fmt.Errorf("retryable status %d", status)
	}

	if bodyText != "" {
		return false, fmt.Errorf("non-retryable status %d: %s", status, bodyText)
	}
	return false, fmt.Errorf("non-retryable status %d", status)
}

package processor

import (
	"context"
	"time"

	"outbox-worker/internal/database"
	"outbox-worker/internal/http"
	"outbox-worker/internal/logger"
)

// OutboxProcessor handles the processing of outbox items
type OutboxProcessor struct {
	repo       *database.OutboxRepository
	httpClient *http.HTTPClient
	logger     *logger.Logger
}

// NewOutboxProcessor creates a new processor instance
func NewOutboxProcessor(repo *database.OutboxRepository, httpClient *http.HTTPClient, logger *logger.Logger) *OutboxProcessor {
	return &OutboxProcessor{
		repo:       repo,
		httpClient: httpClient,
		logger:     logger,
	}
}

// Run starts the continuous processing loop
func (p *OutboxProcessor) Run(ctx context.Context, interval time.Duration, _ int) {
	p.logger.Info("Starting outbox processor with interval: %v", interval)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			p.logger.Info("Context cancelled, stopping processor")
			return
		case <-ticker.C:
			item, err := p.repo.ClaimNext(ctx)
			if err != nil {
				p.logger.Error("ClaimNext error: %v", err)
				continue
			}
			if item == nil {
				p.logger.Debug("Queue empty")
				continue
			}

			retry, err := p.httpClient.SendRequest(*item)
			if err != nil {
				if retry {
					p.logger.Error("Item %d retryable failure: %v", item.ID, err)
					_ = p.repo.MarkFailure(ctx, item.ID, err.Error())
					time.Sleep(10 * time.Second)
					continue
				}

				p.logger.Warn("Item %d non-retryable failure (skipped): %v", item.ID, err)
				_ = p.repo.MarkSkipped(ctx, item.ID, err.Error())
				continue
			}

			_ = p.repo.MarkSuccess(ctx, item.ID)
		}
	}
}

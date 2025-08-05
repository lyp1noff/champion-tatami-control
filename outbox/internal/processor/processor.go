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

// ProcessBatch processes a batch of outbox items
func (p *OutboxProcessor) ProcessBatch(ctx context.Context, batchSize int) error {
	p.logger.Debug("Starting batch processing with size: %d", batchSize)

	items, err := p.repo.GetPendingItems(ctx, batchSize)
	if err != nil {
		p.logger.Error("Failed to get pending items: %v", err)
		return err
	}

	if len(items) == 0 {
		p.logger.Debug("No pending items to process")
		return nil
	}

	p.logger.Info("Processing %d items", len(items))

	successCount := 0
	failureCount := 0

	for _, item := range items {
		p.logger.Debug("Processing item %d (retry %d/%d)", item.ID, item.RetryCount+1, item.MaxRetries)

		err := p.httpClient.SendRequest(item)

		status := "success"
		var errMsg *string

		if err != nil {
			status = "failed"
			s := err.Error()
			errMsg = &s
			failureCount++
			p.logger.Error("Item %d processing failed: %v", item.ID, err)
		} else {
			successCount++
			p.logger.Debug("Item %d processing successful", item.ID)
		}

		if updateErr := p.repo.UpdateItemStatus(ctx, item.ID, status, errMsg); updateErr != nil {
			p.logger.Error("Failed to update status for item %d: %v", item.ID, updateErr)
		}
	}

	p.logger.Info("Batch processing completed. Success: %d, Failures: %d", successCount, failureCount)
	return nil
}

// Run starts the continuous processing loop
func (p *OutboxProcessor) Run(ctx context.Context, interval time.Duration, batchSize int) {
	p.logger.Info("Starting outbox processor with interval: %v, batch size: %d", interval, batchSize)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			p.logger.Info("Context cancelled, stopping processor")
			return
		case <-ticker.C:
			if err := p.ProcessBatch(ctx, batchSize); err != nil {
				p.logger.Error("Error in batch processing: %v", err)
			}
		}
	}
}

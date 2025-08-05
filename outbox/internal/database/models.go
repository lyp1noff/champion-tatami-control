package database

import (
	"context"

	"outbox-worker/internal/logger"

	"github.com/jackc/pgx/v5/pgxpool"
)

// OutboxItem represents an item in the outbox queue
type OutboxItem struct {
	ID           int
	TournamentID *int
	MatchID      *int
	Endpoint     string
	Method       string
	Payload      string
	Status       string
	RetryCount   int
	MaxRetries   int
	Error        *string
}

// OutboxRepository handles database operations for outbox items
type OutboxRepository struct {
	db     *pgxpool.Pool
	logger *logger.Logger
}

// NewOutboxRepository creates a new repository instance
func NewOutboxRepository(db *pgxpool.Pool, logger *logger.Logger) *OutboxRepository {
	return &OutboxRepository{db: db, logger: logger}
}

// GetPendingItems retrieves pending outbox items that need processing
func (r *OutboxRepository) GetPendingItems(ctx context.Context, limit int) ([]OutboxItem, error) {
	r.logger.Debug("Fetching up to %d pending outbox items", limit)

	rows, err := r.db.Query(ctx, `
		SELECT id, tournament_id, match_id, endpoint, method, payload, status, retry_count, max_retries, error
		FROM outbox_items
		WHERE status != 'success' AND retry_count < max_retries
		ORDER BY created_at ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []OutboxItem
	for rows.Next() {
		var item OutboxItem
		err := rows.Scan(
			&item.ID, &item.TournamentID, &item.MatchID, &item.Endpoint, &item.Method,
			&item.Payload, &item.Status, &item.RetryCount, &item.MaxRetries, &item.Error,
		)
		if err != nil {
			r.logger.Error("Error scanning row: %v", err)
			continue
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	r.logger.Debug("Found %d pending items to process", len(items))
	return items, nil
}

// UpdateItemStatus updates the status of an outbox item
func (r *OutboxRepository) UpdateItemStatus(ctx context.Context, itemID int, status string, errorMsg *string) error {
	r.logger.Debug("Updating item %d status to: %s", itemID, status)

	var query string
	var args []interface{}

	if status == "success" {
		// For successful requests, don't increment retry_count
		query = `
			UPDATE outbox_items
			SET status = $1, error = $2, updated_at = NOW()
			WHERE id = $3
		`
		args = []interface{}{status, errorMsg, itemID}
	} else {
		// For failed requests, increment retry_count
		query = `
			UPDATE outbox_items
			SET status = $1, retry_count = retry_count + 1, error = $2, updated_at = NOW()
			WHERE id = $3
		`
		args = []interface{}{status, errorMsg, itemID}
	}

	_, err := r.db.Exec(ctx, query, args...)

	if err != nil {
		r.logger.Error("Error updating item %d: %v", itemID, err)
		return err
	}

	r.logger.Debug("Successfully updated item %d", itemID)
	return nil
}

package database

import (
	"context"
	"strings"

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
	Payload      *string
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

func (r *OutboxRepository) ClaimNext(ctx context.Context) (*OutboxItem, error) {
	const q = `
		WITH head AS (
			SELECT id
			FROM outbox_items
			WHERE status IN ('pending','failed')
			AND retry_count < max_retries
			ORDER BY created_at ASC, id ASC
			LIMIT 1
		)
		UPDATE outbox_items o
		SET status='processing', updated_at=NOW()
		FROM head
		WHERE o.id = head.id
		RETURNING o.id, o.tournament_id, o.match_id, o.endpoint, o.method,
		o.payload, o.status, o.retry_count, o.max_retries, o.error;
`
	row := r.db.QueryRow(ctx, q)

	var it OutboxItem
	if err := row.Scan(
		&it.ID, &it.TournamentID, &it.MatchID, &it.Endpoint, &it.Method,
		&it.Payload, &it.Status, &it.RetryCount, &it.MaxRetries, &it.Error,
	); err != nil {
		if strings.Contains(err.Error(), "no rows") {
			return nil, nil
		}
		return nil, err
	}
	return &it, nil
}

func (r *OutboxRepository) MarkSuccess(ctx context.Context, id int) error {
	_, err := r.db.Exec(ctx, `
		UPDATE outbox_items
		SET status='success', error=NULL, updated_at=NOW()
		WHERE id=$1
	`, id)
	return err
}

func (r *OutboxRepository) MarkFailure(ctx context.Context, id int, errMsg string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE outbox_items
		SET status='failed',
		    retry_count = retry_count + 1,
		    error = $2,
		    updated_at = NOW()
		WHERE id=$1
	`, id, errMsg)
	return err
}

func (r *OutboxRepository) MarkSkipped(ctx context.Context, id int, errMsg string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE outbox_items
		SET status='skipped',
		    error = $2,
		    updated_at = NOW()
		WHERE id = $1
	`, id, errMsg)
	return err
}

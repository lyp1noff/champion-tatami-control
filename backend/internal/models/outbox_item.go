package models

import "time"

type OutboxItem struct {
	ID           int `gorm:"primaryKey"`
	TournamentID *int
	MatchID      *int
	Endpoint     string
	Method       string
	Payload      *string
	Status       string `gorm:"default:pending"`
	RetryCount   int    `gorm:"default:0"`
	MaxRetries   int    `gorm:"default:10"`
	Error        *string
	CreatedAt    time.Time
	UpdatedAt    time.Time

	Tournament *Tournament
	Match      *Match
}

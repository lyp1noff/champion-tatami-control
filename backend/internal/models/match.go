package models

import "time"

type Match struct {
	ID            int    `gorm:"primaryKey"`
	ExternalID    string `gorm:"uniqueIndex;not null"`
	Athlete1ID    *int
	Athlete2ID    *int
	WinnerID      *int
	ScoreAthlete1 *int
	ScoreAthlete2 *int
	Status        string `gorm:"default:not_started"`
	StartedAt     *time.Time
	EndedAt       *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time

	Athlete1     *Athlete `gorm:"foreignKey:Athlete1ID"`
	Athlete2     *Athlete `gorm:"foreignKey:Athlete2ID"`
	BracketMatch []BracketMatch
	MatchState   *MatchState
	Outbox       []OutboxItem
}

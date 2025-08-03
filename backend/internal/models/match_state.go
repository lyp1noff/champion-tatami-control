package models

import "time"

type MatchState struct {
	ID             int    `gorm:"primaryKey"`
	MatchID        int    `gorm:"unique"`
	Status         string `gorm:"default:idle"`
	StartTimestamp *time.Time
	PausedElapsed  int `gorm:"default:0"`
	Elapsed        int `gorm:"default:0"`
	DurationMs     int `gorm:"default:60000"`
	Score1         int
	Score2         int
	Shido1         int
	Shido2         int
	CreatedAt      time.Time
	UpdatedAt      time.Time

	Match Match `gorm:"constraint:OnDelete:CASCADE"`
}

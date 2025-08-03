package models

import "time"

type Bracket struct {
	ID           int `gorm:"primaryKey"`
	ExternalID   int `gorm:"uniqueIndex;not null"`
	TournamentID int
	Category     string `gorm:"not null"`
	Type         string `gorm:"not null"`
	Tatami       *int
	GroupID      int    `gorm:"default:1"`
	StartTime    string `gorm:"default:09:00"`
	Status       string
	DisplayName  string
	CreatedAt    time.Time
	UpdatedAt    time.Time

	Tournament Tournament `gorm:"constraint:OnDelete:CASCADE"`
	Matches    []BracketMatch
}

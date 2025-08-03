package models

import "time"

type BracketMatch struct {
	ID          int    `gorm:"primaryKey"`
	ExternalID  string `gorm:"uniqueIndex;not null"`
	BracketID   int
	MatchID     int
	RoundNumber int
	Position    int
	NextSlot    *int
	CreatedAt   time.Time
	UpdatedAt   time.Time

	Bracket Bracket `gorm:"constraint:OnDelete:CASCADE"`
	Match   Match   `gorm:"constraint:OnDelete:CASCADE"`
}

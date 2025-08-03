package models

import "time"

type Athlete struct {
	ID              int `gorm:"primaryKey"`
	ExternalID      int `gorm:"uniqueIndex;not null"`
	FirstName       string
	LastName        string
	CoachesLastName string
	CreatedAt       time.Time
	UpdatedAt       time.Time

	MatchesAsAthlete1 []Match `gorm:"foreignKey:Athlete1ID"`
	MatchesAsAthlete2 []Match `gorm:"foreignKey:Athlete2ID"`
}

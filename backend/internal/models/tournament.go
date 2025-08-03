package models

import "time"

type Tournament struct {
	ID         int    `gorm:"primaryKey"`
	ExternalID int    `gorm:"uniqueIndex;not null"`
	Name       string `gorm:"not null"`
	Location   string `gorm:"not null"`
	StartDate  *time.Time
	EndDate    *time.Time
	Status     string    `gorm:"not null"`
	CreatedAt  time.Time `gorm:"autoCreateTime"`
	UpdatedAt  time.Time `gorm:"autoUpdateTime"`
}

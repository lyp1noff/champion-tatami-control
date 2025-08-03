package models

import "time"

type GlobalSetting struct {
	ID        int    `gorm:"primaryKey"`
	Key       string `gorm:"unique"`
	Value     *string
	CreatedAt time.Time
	UpdatedAt time.Time
}

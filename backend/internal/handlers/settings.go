package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"champion-tatami-control/internal/models"

	"gorm.io/gorm"
)

func GetCurrentTournament(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var setting models.GlobalSetting
		if err := db.Where("key = ?", "current_tournament_id").First(&setting).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				// Return null if no current tournament is set
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]interface{}{
					"current_tournament_id": nil,
				})
				return
			}
			log.Printf("Error fetching current tournament setting: %v", err)
			http.Error(w, "failed to fetch current tournament setting", http.StatusInternalServerError)
			return
		}

		var tournamentID *int
		if setting.Value != nil {
			if id, err := strconv.Atoi(*setting.Value); err == nil {
				tournamentID = &id
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"current_tournament_id": tournamentID,
		})
	}
}

func SetCurrentTournament(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var request struct {
			TournamentID *int `json:"tournament_id"`
		}

		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		var value *string
		if request.TournamentID != nil {
			tournamentIDStr := strconv.Itoa(*request.TournamentID)
			value = &tournamentIDStr
		}

		// Use upsert to create or update the setting
		var setting models.GlobalSetting
		result := db.Where("key = ?", "current_tournament_id").First(&setting)

		if result.Error == gorm.ErrRecordNotFound {
			// Create new setting
			setting = models.GlobalSetting{
				Key:   "current_tournament_id",
				Value: value,
			}
			if err := db.Create(&setting).Error; err != nil {
				log.Printf("Error creating current tournament setting: %v", err)
				http.Error(w, "failed to set current tournament", http.StatusInternalServerError)
				return
			}
		} else if result.Error != nil {
			log.Printf("Error checking current tournament setting: %v", result.Error)
			http.Error(w, "failed to set current tournament", http.StatusInternalServerError)
			return
		} else {
			// Update existing setting
			setting.Value = value
			if err := db.Save(&setting).Error; err != nil {
				log.Printf("Error updating current tournament setting: %v", err)
				http.Error(w, "failed to set current tournament", http.StatusInternalServerError)
				return
			}
		}

		log.Printf("Current tournament set to: %v", request.TournamentID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message":               fmt.Sprintf("Current tournament set to %v", request.TournamentID),
			"current_tournament_id": request.TournamentID,
		})
	}
}

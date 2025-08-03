package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"

	"champion-tatami-control/internal/models"
	"champion-tatami-control/internal/services"

	"gorm.io/gorm"
)

func GetTournaments(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var tournaments []models.Tournament
		if err := db.Find(&tournaments).Error; err != nil {
			http.Error(w, "failed to fetch tournaments", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(tournaments)
	}
}

func GetExternalTournament() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		url := "http://10.26.1.90:8000/api/tournaments"
		resp, err := http.Get(url)
		if err != nil {
			http.Error(w, "failed to fetch external tournament", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			http.Error(w, fmt.Sprintf("external API returned status %d", resp.StatusCode), http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		io.Copy(w, resp.Body)
	}
}

func GetTournamentByID(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}
		var tournament models.Tournament
		if err := db.First(&tournament, "external_id = ?", id).Error; err != nil {
			http.Error(w, "tournament not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(tournament)
	}
}

func SyncTournament(service *services.SyncService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		tournamentID, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, "invalid tournament ID", http.StatusBadRequest)
			return
		}

		log.Printf("Starting sync for tournament %d", tournamentID)

		if err := service.SyncTournamentFromRemote(tournamentID); err != nil {
			log.Printf("Error syncing tournament %d: %v", tournamentID, err)
			http.Error(w, fmt.Sprintf("failed to sync tournament: %v", err), http.StatusInternalServerError)
			return
		}

		log.Printf("Successfully synced tournament %d", tournamentID)
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, "Tournament %d synced successfully", tournamentID)
	}
}

func GetTournamentBrackets(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		externalTournamentID, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, "invalid tournament ID", http.StatusBadRequest)
			return
		}

		// First find the tournament by external_id
		var tournament models.Tournament
		if err := db.Where("external_id = ?", externalTournamentID).First(&tournament).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				http.Error(w, "tournament not found", http.StatusNotFound)
				return
			}
			log.Printf("Error finding tournament with external_id %d: %v", externalTournamentID, err)
			http.Error(w, "failed to find tournament", http.StatusInternalServerError)
			return
		}

		var brackets []models.Bracket
		if err := db.Where("tournament_id = ?", tournament.ID).Find(&brackets).Error; err != nil {
			log.Printf("Error fetching brackets for tournament %d: %v", tournament.ID, err)
			http.Error(w, "failed to fetch brackets", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"brackets": brackets,
		})
	}
}

func GetBracketMatches(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		bracketID, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, "invalid bracket ID", http.StatusBadRequest)
			return
		}

		var bracketMatches []models.BracketMatch
		if err := db.Preload("Match").Where("bracket_id = ?", bracketID).Find(&bracketMatches).Error; err != nil {
			log.Printf("Error fetching matches for bracket %d: %v", bracketID, err)
			http.Error(w, "failed to fetch matches", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"matches": bracketMatches,
		})
	}
}

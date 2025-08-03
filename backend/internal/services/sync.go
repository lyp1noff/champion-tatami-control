package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"champion-tatami-control/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SyncService struct {
	DB *gorm.DB
}

func NewSyncService(db *gorm.DB) *SyncService {
	return &SyncService{DB: db}
}

func (s *SyncService) SyncTournamentFromRemote(tournamentID int) error {
	// First, fetch tournament data
	tournamentURL := fmt.Sprintf("http://10.26.1.90:8000/api/tournaments/%d", tournamentID)

	req, err := http.NewRequest("GET", tournamentURL, nil)
	if err != nil {
		return err
	}

	authToken := "service_token"
	req.Header.Set("Authorization", "Bearer "+authToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch tournament: status %d", resp.StatusCode)
	}

	// Parse tournament data
	var tournamentData struct {
		ID        int    `json:"id"`
		Name      string `json:"name"`
		Location  string `json:"location"`
		StartDate string `json:"start_date"`
		EndDate   string `json:"end_date"`
		Status    string `json:"status"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tournamentData); err != nil {
		return fmt.Errorf("failed to decode tournament data: %v", err)
	}

	// Parse dates
	var startDate, endDate *time.Time
	if tournamentData.StartDate != "" {
		if parsed, err := time.Parse("2006-01-02", tournamentData.StartDate); err == nil {
			startDate = &parsed
		}
	}
	if tournamentData.EndDate != "" {
		if parsed, err := time.Parse("2006-01-02", tournamentData.EndDate); err == nil {
			endDate = &parsed
		}
	}

	// Create or update tournament
	tournament := models.Tournament{
		ExternalID: tournamentData.ID,
		Name:       tournamentData.Name,
		Location:   tournamentData.Location,
		StartDate:  startDate,
		EndDate:    endDate,
		Status:     tournamentData.Status,
	}

	s.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "external_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "location", "start_date", "end_date", "status", "updated_at"}),
	}).Create(&tournament)

	// Now fetch matches data
	matchesURL := fmt.Sprintf("http://10.26.1.90:8000/api/tournaments/%d/matches_full", tournamentID)

	req, err = http.NewRequest("GET", matchesURL, nil)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+authToken)

	resp, err = client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch matches: status %d", resp.StatusCode)
	}

	var brackets []struct {
		Category    string `json:"category"`
		Type        string `json:"type"`
		StartTime   string `json:"start_time"`
		Tatami      int    `json:"tatami"`
		GroupID     int    `json:"group_id"`
		DisplayName string `json:"display_name"`
		Status      string `json:"status"`
		BracketID   int    `json:"bracket_id"`
		Matches     []struct {
			ID          string `json:"id"`
			RoundNumber int    `json:"round_number"`
			Position    int    `json:"position"`
			NextSlot    *int   `json:"next_slot"`
			Match       struct {
				ID        string `json:"id"`
				RoundType string `json:"round_type"`
				Athlete1  *struct {
					ID              int      `json:"id"`
					FirstName       string   `json:"first_name"`
					LastName        string   `json:"last_name"`
					CoachesLastName []string `json:"coaches_last_name"`
				} `json:"athlete1"`
				Athlete2 *struct {
					ID              int      `json:"id"`
					FirstName       string   `json:"first_name"`
					LastName        string   `json:"last_name"`
					CoachesLastName []string `json:"coaches_last_name"`
				} `json:"athlete2"`
				Winner        *models.Athlete `json:"winner"`
				ScoreAthlete1 int             `json:"score_athlete1"`
				ScoreAthlete2 int             `json:"score_athlete2"`
				Status        string          `json:"status"`
				StartedAt     time.Time       `json:"started_at"`
				EndedAt       time.Time       `json:"ended_at"`
			} `json:"match"`
		} `json:"matches"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&brackets); err != nil {
		return err
	}

	// Define upsert clause for GORM
	upsert := clause.OnConflict{
		Columns:   []clause.Column{{Name: "external_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"category", "type", "tatami", "group_id", "start_time", "status", "display_name", "updated_at"}),
	}

	for _, b := range brackets {
		// remove local non-started/finished matches for this bracket
		// First get the match IDs that are not started or finished
		var matchIDs []int
		s.DB.Model(&models.Match{}).
			Joins("JOIN bracket_matches ON bracket_matches.match_id = matches.id").
			Where("bracket_matches.bracket_id = ? AND matches.status NOT IN ?", b.BracketID, []string{"started", "finished"}).
			Pluck("matches.id", &matchIDs)

		// Then delete the bracket matches for those matches
		if len(matchIDs) > 0 {
			s.DB.Where("bracket_id = ? AND match_id IN ?", b.BracketID, matchIDs).
				Delete(&models.BracketMatch{})
		}

		// insert or update bracket with proper TournamentID
		bracket := models.Bracket{
			ExternalID:   b.BracketID,
			TournamentID: tournament.ID, // Set the foreign key
			Category:     b.Category,
			Type:         b.Type,
			Tatami:       &b.Tatami,
			GroupID:      b.GroupID,
			StartTime:    b.StartTime,
			Status:       b.Status,
			DisplayName:  b.DisplayName,
		}
		s.DB.Clauses(upsert).Create(&bracket)

		for _, m := range b.Matches {
			var a1ID, a2ID *int

			// Handle athlete1
			if m.Match.Athlete1 != nil {
				a1 := models.Athlete{
					ExternalID:      m.Match.Athlete1.ID,
					FirstName:       m.Match.Athlete1.FirstName,
					LastName:        m.Match.Athlete1.LastName,
					CoachesLastName: strings.Join(m.Match.Athlete1.CoachesLastName, ", "),
				}
				s.DB.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "external_id"}},
					DoUpdates: clause.AssignmentColumns([]string{"first_name", "last_name", "coaches_last_name", "updated_at"}),
				}).Create(&a1)
				a1ID = &a1.ID
			}

			// Handle athlete2
			if m.Match.Athlete2 != nil {
				a2 := models.Athlete{
					ExternalID:      m.Match.Athlete2.ID,
					FirstName:       m.Match.Athlete2.FirstName,
					LastName:        m.Match.Athlete2.LastName,
					CoachesLastName: strings.Join(m.Match.Athlete2.CoachesLastName, ", "),
				}
				s.DB.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "external_id"}},
					DoUpdates: clause.AssignmentColumns([]string{"first_name", "last_name", "coaches_last_name", "updated_at"}),
				}).Create(&a2)
				a2ID = &a2.ID
			}

			// Create or update match
			match := models.Match{
				ExternalID:    m.Match.ID,
				Athlete1ID:    a1ID,
				Athlete2ID:    a2ID,
				ScoreAthlete1: &m.Match.ScoreAthlete1,
				ScoreAthlete2: &m.Match.ScoreAthlete2,
				Status:        m.Match.Status,
				StartedAt:     &m.Match.StartedAt,
				EndedAt:       &m.Match.EndedAt,
			}

			s.DB.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "external_id"}},
				DoUpdates: clause.AssignmentColumns([]string{"athlete1_id", "athlete2_id", "score_athlete1", "score_athlete2", "status", "started_at", "ended_at", "updated_at"}),
			}).Create(&match)

			// Get the match ID for the bracket match relationship
			var matchID int
			s.DB.Model(&models.Match{}).Where("external_id = ?", m.Match.ID).Select("id").Scan(&matchID)

			// Get the bracket ID for the bracket match relationship
			var bracketID int
			s.DB.Model(&models.Bracket{}).Where("external_id = ?", b.BracketID).Select("id").Scan(&bracketID)

			// Create or update bracket match with proper foreign keys
			s.DB.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "external_id"}},
				DoUpdates: clause.AssignmentColumns([]string{"bracket_id", "match_id", "round_number", "position", "next_slot", "updated_at"}),
			}).Create(&models.BracketMatch{
				ExternalID:  m.ID,
				BracketID:   bracketID, // Use the actual bracket ID, not external ID
				MatchID:     matchID,
				RoundNumber: m.RoundNumber,
				Position:    m.Position,
				NextSlot:    m.NextSlot,
			})
		}
	}

	return nil
}

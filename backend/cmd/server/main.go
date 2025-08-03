package main

import (
	"log"
	"net/http"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"champion-tatami-control/internal/handlers"
	"champion-tatami-control/internal/models"
	"champion-tatami-control/internal/services"
)

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		// Preflight
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		h.ServeHTTP(w, r)
	})
}

func main() {
	dsn := "host=localhost user=user password=password dbname=tournament_local port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatal("failed to connect to database: ", err)
	}

	db.AutoMigrate(&models.Tournament{}, &models.Athlete{}, &models.Match{}, &models.Bracket{}, &models.BracketMatch{}, &models.MatchState{}, &models.OutboxItem{}, &models.GlobalSetting{})

	// Initialize services
	syncService := services.NewSyncService(db)

	apiMux := http.NewServeMux()

	// Tournament routes
	apiMux.HandleFunc("GET /tournaments", func(w http.ResponseWriter, r *http.Request) {
		handlers.GetTournaments(db)(w, r)
	})

	apiMux.HandleFunc("GET /tournaments/{id}", func(w http.ResponseWriter, r *http.Request) {
		handlers.GetTournamentByID(db)(w, r)
	})

	apiMux.HandleFunc("POST /tournaments/{id}/sync", handlers.SyncTournament(syncService))

	apiMux.HandleFunc("GET /tournaments/{id}/brackets", handlers.GetTournamentBrackets(db))

	apiMux.HandleFunc("GET /brackets/{id}/matches", handlers.GetBracketMatches(db))

	apiMux.HandleFunc("GET /external/tournaments", handlers.GetExternalTournament())

	apiMux.HandleFunc("GET /settings/current-tournament", handlers.GetCurrentTournament(db))
	apiMux.HandleFunc("POST /settings/current-tournament", handlers.SetCurrentTournament(db))

	mux := http.NewServeMux()
	mux.Handle("/api/", http.StripPrefix("/api", withCORS(apiMux)))

	log.Println("Server running on :8080")
	if err := http.ListenAndServe(":8080", withCORS(mux)); err != nil {
		log.Fatal("failed to start server: ", err)
	}
}

package main

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"outbox-worker/internal/config"
	"outbox-worker/internal/database"
	"outbox-worker/internal/http"
	"outbox-worker/internal/logger"
	"outbox-worker/internal/processor"
)

func main() {
	// Load environment variables
	if err := godotenv.Load("../.env"); err != nil {
		// Use standard log for startup messages before loggerInstance is initialized
		log.Printf("No .env file found, using system environment variables")
	}

	// Load configuration
	cfg := config.LoadConfig()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	// Initialize loggerInstance
	loggerInstance := logger.NewLogger(cfg.LogLevel)
	loggerInstance.Info("Starting outbox service...")

	// Setup database connection
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		loggerInstance.Error("Failed to connect to database: %v", err)
		log.Fatal("Failed to connect to database:", err)
	}
	defer pool.Close()

	loggerInstance.Info("Successfully connected to database")
	loggerInstance.Debug("Configuration: interval=%v, batch_size=%d, http_timeout=%v, log_level=%s",
		cfg.ProcessingInterval, cfg.BatchSize, cfg.HTTPTimeout, cfg.LogLevel)

	// Initialize components
	repo := database.NewOutboxRepository(pool, loggerInstance)
	httpClient := http.NewHTTPClient(cfg, loggerInstance)
	processor := processor.NewOutboxProcessor(repo, httpClient, loggerInstance)

	// Start processing
	processor.Run(ctx, cfg.ProcessingInterval, cfg.BatchSize)
}

# Outbox Service

A Go service for processing outbox items from a PostgreSQL database and sending HTTP requests to external APIs.

## Structure

The service is organized into several modules:

- **`main.go`** - Entry point and service initialization
- **`config.go`** - Configuration management
- **`models.go`** - Data models and database operations
- **`http_client.go`** - HTTP client for sending requests
- **`processor.go`** - Main processing logic

## Configuration

The service can be configured using environment variables:

| Variable              | Default  | Description                                  |
| --------------------- | -------- | -------------------------------------------- |
| `DATABASE_URL`        | Required | PostgreSQL connection string                 |
| `EXTERNAL_API_TOKEN`  | ""       | Bearer token for external API authentication |
| `PROCESSING_INTERVAL` | "5s"     | Interval between processing batches          |
| `BATCH_SIZE`          | 10       | Number of items to process per batch         |
| `HTTP_TIMEOUT`        | "10s"    | HTTP request timeout                         |
| `MAX_RETRIES`         | 3        | Maximum number of retries per item           |
| `LOG_LEVEL`           | "info"   | Logging level (debug, info, warn, error)     |

## Database Schema

The service expects an `outbox_items` table with the following structure:

```sql
CREATE TABLE outbox_items (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER,
    match_id INTEGER,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Features

- **Batch Processing**: Processes items in configurable batches
- **Retry Logic**: Automatically retries failed requests up to a configurable limit
- **Comprehensive Logging**: Detailed logging for debugging and monitoring
- **Graceful Shutdown**: Handles context cancellation properly
- **Connection Pooling**: Uses pgx connection pool for efficient database access
- **Error Handling**: Robust error handling with detailed error messages

## Running the Service

1. Set up your environment variables (see Configuration section)
2. Ensure the database is accessible and the `outbox_items` table exists
3. Run the service:

```bash
cd outbox
go run .
```

## Logging

The service provides configurable logging with different levels:

- **ERROR**: Only error messages
- **WARN**: Warning and error messages  
- **INFO**: Information, warning, and error messages (default)
- **DEBUG**: All messages including detailed debug information

### Log Levels

- **ERROR**: Critical errors that prevent operation
- **WARN**: Non-critical issues that should be investigated
- **INFO**: General operational information (startup, batch completion, etc.)
- **DEBUG**: Detailed information for troubleshooting (individual item processing, HTTP requests, etc.)

Set the `LOG_LEVEL` environment variable to control verbosity. Default is "info" for balanced logging.

## Error Handling

- Database connection errors are fatal and will stop the service
- Individual item processing errors are logged but don't stop the batch
- HTTP request failures are retried up to the configured limit
- Transaction errors are logged and the batch continues with remaining items

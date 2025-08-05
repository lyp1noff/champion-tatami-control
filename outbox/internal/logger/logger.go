package logger

import (
	"log"
	"strings"
)

// LogLevel represents the logging level
type LogLevel int

const (
	LogLevelError LogLevel = iota
	LogLevelWarn
	LogLevelInfo
	LogLevelDebug
)

// Logger provides structured logging with configurable levels
type Logger struct {
	level LogLevel
}

// NewLogger creates a new logger instance
func NewLogger(level string) *Logger {
	var logLevel LogLevel
	switch strings.ToLower(level) {
	case "debug":
		logLevel = LogLevelDebug
	case "info":
		logLevel = LogLevelInfo
	case "warn":
		logLevel = LogLevelWarn
	case "error":
		logLevel = LogLevelError
	default:
		logLevel = LogLevelInfo // Default to info level
	}

	return &Logger{level: logLevel}
}

// Debug logs debug messages
func (l *Logger) Debug(format string, args ...interface{}) {
	if l.level >= LogLevelDebug {
		log.Printf("[DEBUG] "+format, args...)
	}
}

// Info logs info messages
func (l *Logger) Info(format string, args ...interface{}) {
	if l.level >= LogLevelInfo {
		log.Printf("[INFO] "+format, args...)
	}
}

// Warn logs warning messages
func (l *Logger) Warn(format string, args ...interface{}) {
	if l.level >= LogLevelWarn {
		log.Printf("[WARN] "+format, args...)
	}
}

// Error logs error messages
func (l *Logger) Error(format string, args ...interface{}) {
	if l.level >= LogLevelError {
		log.Printf("[ERROR] "+format, args...)
	}
}

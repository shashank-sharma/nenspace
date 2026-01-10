package logging

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

type LogEntry struct {
	Level     string                 `json:"level"`
	Timestamp string                 `json:"timestamp"`
	Source    string                 `json:"source"`
	Message   string                 `json:"message"`
	Context   map[string]interface{} `json:"context"`
	TraceID   string                 `json:"trace_id"`
	ProjectId string                 `json:"-"`
}

type LoggingService struct {
	app         core.App
	config      *Config
	buffer      chan *LogEntry
	flushTicker *time.Ticker
	workers     chan struct{}
	wg          sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc

	logsBuffered    int64
	logsFlushed     int64
	errors          int64
	bufferOverflows int64

	mu sync.RWMutex
}

func NewLoggingService(app core.App) *LoggingService {
	config := DefaultConfig()
	ctx, cancel := context.WithCancel(context.Background())

	s := &LoggingService{
		app:         app,
		config:      config,
		buffer:      make(chan *LogEntry, config.BufferSize),
		flushTicker: time.NewTicker(config.FlushInterval),
		workers:     make(chan struct{}, config.WorkerPoolSize),
		ctx:         ctx,
		cancel:      cancel,
	}

	s.wg.Add(1)
	go s.worker()

	return s
}

type IngestResult struct {
	Success   bool     `json:"success"`
	Processed int      `json:"processed"`
	Failed    int      `json:"failed"`
	Errors    []string `json:"errors,omitempty"`
}

func (s *LoggingService) IngestLogs(ctx context.Context, projectId string, entries []LogEntry) (*IngestResult, error) {
	logger.LogDebug(fmt.Sprintf("Ingesting %d logs for project %s", len(entries), projectId))
	if len(entries) > 1000 {
		return nil, errors.New("batch size exceeds limit of 1000")
	}

	result := &IngestResult{
		Processed: 0,
		Failed:    0,
		Errors:    []string{},
	}

	now := time.Now()

	for i := range entries {
		entry := &entries[i]
		entry.ProjectId = projectId

		if entry.Level == "" {
			entry.Level = "info"
		}

		if entry.Message == "" {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("entry %d: message is required", i))
			continue
		}
		if len(entry.Message) > 64*1024 {
			entry.Message = entry.Message[:64*1024-3] + "..."
		}

		if entry.Timestamp != "" {
			ts, err := time.Parse(time.RFC3339, entry.Timestamp)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("entry %d: invalid timestamp format", i))
				continue
			}

			if ts.Before(now.Add(-24*time.Hour)) || ts.After(now.Add(24*time.Hour)) {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("entry %d: timestamp outside ±24h window", i))
				continue
			}
		} else {
			entry.Timestamp = now.Format(time.RFC3339)
		}

		atomic.AddInt64(&s.logsBuffered, 1)
		select {
		case s.buffer <- entry:
			result.Processed++
		default:

			atomic.AddInt64(&s.bufferOverflows, 1)
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("entry %d: buffer full, log dropped", i))
		}
	}

	result.Success = result.Failed == 0
	return result, nil
}

func (s *LoggingService) Shutdown(ctx context.Context) error {
	logger.LogInfo("Shutting down logging service...")

	s.flushTicker.Stop()

	s.cancel()

	remainingLogs := s.drainBuffer()
	if len(remainingLogs) > 0 {
		if err := s.writeBatch(ctx, remainingLogs); err != nil {
			logger.LogError("Error flushing logs during shutdown: %v", err)
		}
	}

	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		logger.LogInfo("Logging service shut down successfully")
		return nil
	case <-ctx.Done():
		return fmt.Errorf("shutdown timeout: %w", ctx.Err())
	}
}

func (s *LoggingService) worker() {
	defer s.wg.Done()

	var batch []*LogEntry

	for {
		select {
		case <-s.ctx.Done():

			if len(batch) > 0 {
				s.processBatch(batch)
			}
			return

		case <-s.flushTicker.C:

			if len(batch) > 0 {
				s.processBatch(batch)
				batch = nil
			}

			remaining := s.drainBuffer()
			if len(remaining) > 0 {
				s.processBatch(remaining)
			}

		case entry := <-s.buffer:

			batch = append(batch, entry)

			if len(batch) >= s.config.BatchSize {
				s.processBatch(batch)
				batch = nil
			}
		}
	}
}

func (s *LoggingService) processBatch(logs []*LogEntry) {
	s.workers <- struct{}{}
	s.wg.Add(1)
	go func(lgs []*LogEntry) {
		defer func() { <-s.workers }()
		defer s.wg.Done()

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := s.writeBatch(ctx, lgs); err != nil {
			logger.LogError("Error flushing logs: %v", err)
		}
	}(logs)
}

func (s *LoggingService) drainBuffer() []*LogEntry {
	logs := make([]*LogEntry, 0, s.config.BatchSize)
	for {
		select {
		case entry := <-s.buffer:
			logs = append(logs, entry)
		default:
			return logs
		}
	}
}

func (s *LoggingService) drainBufferUpTo(n int) []*LogEntry {
	logs := make([]*LogEntry, 0, n)
	for i := 0; i < n; i++ {
		select {
		case entry := <-s.buffer:
			logs = append(logs, entry)
		default:
			return logs
		}
	}
	return logs
}

func (s *LoggingService) writeBatch(ctx context.Context, entries []*LogEntry) error {
	if len(entries) == 0 {
		return nil
	}

	logger.LogInfo(fmt.Sprintf("Flushing batch of %d logs to database", len(entries)))

	var lastErr error
	for attempt := 0; attempt < s.config.RetryAttempts; attempt++ {
		if attempt > 0 {
			logger.LogWarning(fmt.Sprintf("Retry attempt %d for log batch write", attempt+1))
			select {
			case <-time.After(s.config.RetryBackoff * time.Duration(attempt)):
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		lastErr = query.RunInTransaction(func(txApp core.App) error {
			for _, entry := range entries {
				ts, _ := time.Parse(time.RFC3339, entry.Timestamp)

				logModel := &models.Log{
					Project: entry.ProjectId,
					Level:   entry.Level,
					Source:  entry.Source,
					Message: entry.Message,
					TraceID: entry.TraceID,
				}
				logModel.Timestamp.Scan(ts)

				if err := logModel.SetContextMap(entry.Context); err != nil {
					logger.LogError("Failed to set log context map", "error", err)
					continue
				}

				if err := query.SaveRecordWithApp(txApp, logModel); err != nil {
					atomic.AddInt64(&s.errors, 1)
					logger.LogError("Failed to save log record", "error", err, "project", entry.ProjectId)
					return err
				}
				atomic.AddInt64(&s.logsFlushed, 1)
			}
			return nil
		})

		if lastErr == nil {
			logger.LogInfo(fmt.Sprintf("Successfully flushed batch of %d logs", len(entries)))
			return nil
		}
	}

	return fmt.Errorf("failed to write batch after %d attempts: %w", s.config.RetryAttempts, lastErr)
}

type LoggingStats struct {
	LogsBuffered    int64 `json:"logs_buffered"`
	LogsFlushed     int64 `json:"logs_flushed"`
	Errors          int64 `json:"errors"`
	BufferOverflows int64 `json:"buffer_overflows"`
}

func (s *LoggingService) GetStats() LoggingStats {
	return LoggingStats{
		LogsBuffered:    atomic.LoadInt64(&s.logsBuffered),
		LogsFlushed:     atomic.LoadInt64(&s.logsFlushed),
		Errors:          atomic.LoadInt64(&s.errors),
		BufferOverflows: atomic.LoadInt64(&s.bufferOverflows),
	}
}

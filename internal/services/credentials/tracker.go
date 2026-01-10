package credentials

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/store"
	"github.com/shashank-sharma/backend/internal/util"
)

type Tracker struct {
	config      *Config
	buffer      chan *UsageEvent
	flushTicker *time.Ticker
	workers     chan struct{}
	wg          sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc

	// Stats
	eventsBuffered  int64
	eventsFlushed   int64
	errors          int64
	bufferOverflows int64

	mu sync.RWMutex
}

func NewTracker(config *Config) *Tracker {
	if config == nil {
		config = DefaultConfig()
	}

	ctx, cancel := context.WithCancel(context.Background())

	tracker := &Tracker{
		config:      config,
		buffer:      make(chan *UsageEvent, config.BufferSize),
		flushTicker: time.NewTicker(config.FlushInterval),
		workers:     make(chan struct{}, config.WorkerPoolSize),
		ctx:         ctx,
		cancel:      cancel,
	}

	tracker.wg.Add(1)
	go tracker.worker()

	return tracker
}

func (t *Tracker) TrackUsage(ctx context.Context, event *UsageEvent) error {
	atomic.AddInt64(&t.eventsBuffered, 1)

	select {
	case t.buffer <- event:
		return nil
	case <-time.After(100 * time.Millisecond):
		select {
		case t.buffer <- event:
			return nil
		default:
			atomic.AddInt64(&t.bufferOverflows, 1)
			logger.LogWarning("Credential usage buffer full, dropping oldest event")

			select {
			case <-t.buffer:
				select {
				case t.buffer <- event:
					return nil
				default:
					return fmt.Errorf("buffer full, event dropped")
				}
			default:
				return fmt.Errorf("buffer full, event dropped")
			}
		}
	}
}

func (t *Tracker) Flush(ctx context.Context) error {
	events := t.drainBuffer()
	if len(events) == 0 {
		return nil
	}

	return t.writeBatch(ctx, events)
}

func (t *Tracker) Shutdown(ctx context.Context) error {
	logger.LogInfo("Shutting down credential usage tracker...")

	t.flushTicker.Stop()

	t.cancel()

	if err := t.Flush(ctx); err != nil {
		logger.LogError("Error flushing events during shutdown: %v", err)
	}

	done := make(chan struct{})
	go func() {
		t.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		logger.LogInfo("Credential usage tracker shut down successfully")
		return nil
	case <-ctx.Done():
		return fmt.Errorf("shutdown timeout: %w", ctx.Err())
	}
}

func (t *Tracker) GetStats() TrackerStats {
	return TrackerStats{
		EventsBuffered:  atomic.LoadInt64(&t.eventsBuffered),
		EventsFlushed:   atomic.LoadInt64(&t.eventsFlushed),
		Errors:          atomic.LoadInt64(&t.errors),
		BufferOverflows: atomic.LoadInt64(&t.bufferOverflows),
	}
}

func (t *Tracker) worker() {
	defer t.wg.Done()

	for {
		select {
		case <-t.ctx.Done():
			events := t.drainBuffer()
			if len(events) > 0 {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				_ = t.writeBatch(ctx, events)
				cancel()
			}
			return

		case <-t.flushTicker.C:
			events := t.drainBuffer()
			if len(events) > 0 {
				t.workers <- struct{}{}
				t.wg.Add(1)
				go func(evts []*UsageEvent) {
					defer func() { <-t.workers }()
					defer t.wg.Done()

					ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
					defer cancel()

					if err := t.writeBatch(ctx, evts); err != nil {
						logger.LogError("Error flushing credential usage events: %v", err)
					}
				}(events)
			}

		case event := <-t.buffer:
			events := []*UsageEvent{event}
			events = append(events, t.drainBufferUpTo(t.config.BatchSize-1)...)

			if len(events) >= t.config.BatchSize {
				t.workers <- struct{}{}
				t.wg.Add(1)
				go func(evts []*UsageEvent) {
					defer func() { <-t.workers }()
					defer t.wg.Done()

					ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
					defer cancel()

					if err := t.writeBatch(ctx, evts); err != nil {
						logger.LogError("Error flushing credential usage events: %v", err)
					}
				}(events)
			} else {
				for i := len(events) - 1; i > 0; i-- {
					select {
					case t.buffer <- events[i]:
					default:
					}
				}
			}
		}
	}
}

func (t *Tracker) drainBuffer() []*UsageEvent {
	events := make([]*UsageEvent, 0, t.config.BatchSize)
	for {
		select {
		case event := <-t.buffer:
			events = append(events, event)
		default:
			return events
		}
	}
}

func (t *Tracker) drainBufferUpTo(n int) []*UsageEvent {
	events := make([]*UsageEvent, 0, n)
	for i := 0; i < n; i++ {
		select {
		case event := <-t.buffer:
			events = append(events, event)
		default:
			return events
		}
	}
	return events
}

func (t *Tracker) writeBatch(ctx context.Context, events []*UsageEvent) error {
	if len(events) == 0 {
		return nil
	}

	dao := store.GetDao()
	collection, err := dao.FindCollectionByNameOrId("credential_usage")
	if err != nil {
		return nil
	}

	var lastErr error
	for attempt := 0; attempt < t.config.RetryAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-time.After(t.config.RetryBackoff * time.Duration(attempt)):
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		records := make([]*core.Record, 0, len(events))
		for _, event := range events {
			record := core.NewRecord(collection)
			record.Id = util.GenerateRandomId()

			// Set fields
			record.Set("credential_type", event.CredentialType)
			record.Set("credential_id", event.CredentialID)
			record.Set("user", event.UserID)
			record.Set("service", event.Service)
			record.Set("endpoint", event.Endpoint)
			record.Set("method", event.Method)
			record.Set("status_code", event.StatusCode)
			record.Set("response_time_ms", event.ResponseTimeMs)
			record.Set("tokens_used", event.TokensUsed)
			record.Set("request_size_bytes", event.RequestSize)
			record.Set("response_size_bytes", event.ResponseSize)

			if event.ErrorType != "" {
				record.Set("error_type", event.ErrorType)
			}
			if event.ErrorMessage != "" {
				record.Set("error_message", event.ErrorMessage)
			}

			timestamp := types.DateTime{}
			timestamp.Scan(event.Timestamp)
			record.Set("timestamp", timestamp)

			if event.Metadata != nil && len(event.Metadata) > 0 {
				metadataJSON, err := json.Marshal(event.Metadata)
				if err == nil {
					var metadataRaw types.JSONRaw
					if err := metadataRaw.Scan(metadataJSON); err == nil {
						record.Set("metadata", metadataRaw)
					}
				}
			}

			records = append(records, record)
		}

		lastErr = nil
		for _, record := range records {
			if err := dao.Save(record); err != nil {
				lastErr = err
				logger.LogError("Error saving credential usage record: %v", err)
				atomic.AddInt64(&t.errors, 1)
			} else {
				atomic.AddInt64(&t.eventsFlushed, 1)
			}
		}

		if lastErr == nil {
			logger.LogDebug("Flushed %d credential usage events", len(events))
			return nil
		}
	}

	return fmt.Errorf("failed to write batch after %d attempts: %w", t.config.RetryAttempts, lastErr)
}

var _ UsageTracker = (*Tracker)(nil)

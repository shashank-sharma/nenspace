package cron

import (
	"fmt"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/tools/cron"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

type Scheduler struct {
	cronScheduler *cron.Cron
	executor      *Executor
	mutex         sync.RWMutex
	activeJobs    map[string]bool
	reloadTicker  *time.Ticker
	stopChan      chan struct{}
}

func NewScheduler(executor *Executor) *Scheduler {
	return &Scheduler{
		cronScheduler: cron.New(),
		executor:      executor,
		activeJobs:    make(map[string]bool),
		stopChan:      make(chan struct{}),
	}
}

func (s *Scheduler) Start() error {
	s.cronScheduler.Start()
	logger.LogInfo("Cron scheduler started")

	s.reloadTicker = time.NewTicker(5 * time.Minute)
	go s.periodicReload()

	if err := s.ReloadCrons(); err != nil {
		logger.LogError("Failed to reload crons on startup", "error", err)
		return err
	}

	return nil
}

func (s *Scheduler) Stop() {
	close(s.stopChan)
	if s.reloadTicker != nil {
		s.reloadTicker.Stop()
	}
	s.cronScheduler.Stop()
	logger.LogInfo("Cron scheduler stopped")
}

func (s *Scheduler) periodicReload() {
	for {
		select {
		case <-s.reloadTicker.C:
			if err := s.ReloadCrons(); err != nil {
				logger.LogError("Failed to reload crons periodically", "error", err)
			}
		case <-s.stopChan:
			return
		}
	}
}

func (s *Scheduler) ReloadCrons() error {
	crons, err := query.FindAllByFilter[*models.Cron](map[string]interface{}{
		"is_active": true,
	})
	if err != nil {
		return fmt.Errorf("failed to load crons: %w", err)
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	activeCronIds := make(map[string]bool)
	for _, cronRecord := range crons {
		activeCronIds[cronRecord.Id] = true
		if !s.activeJobs[cronRecord.Id] {
			if err := s.addCronToScheduler(cronRecord); err != nil {
				logger.LogError("Failed to add cron to scheduler", "cronId", cronRecord.Id, "error", err)
			}
		}
	}

	for cronId := range s.activeJobs {
		if !activeCronIds[cronId] {
			s.activeJobs[cronId] = false
		}
	}

	logger.LogInfo("Reloaded crons from database", "count", len(crons))
	return nil
}

func (s *Scheduler) AddCron(cronRecord *models.Cron) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !cronRecord.IsActive {
		s.activeJobs[cronRecord.Id] = false
		return nil
	}

	if s.activeJobs[cronRecord.Id] {
		s.activeJobs[cronRecord.Id] = false
	}

	return s.addCronToScheduler(cronRecord)
}

func (s *Scheduler) RemoveCron(cronId string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.activeJobs[cronId] = false
	logger.LogInfo("Removed cron from scheduler", "cronId", cronId)

	return nil
}

func (s *Scheduler) ExecuteCron(cronId string) error {
	cronRecord, err := query.FindById[*models.Cron](cronId)
	if err != nil {
		return fmt.Errorf("cron not found: %w", err)
	}

	return s.executor.Execute(cronRecord)
}

func (s *Scheduler) addCronToScheduler(cronRecord *models.Cron) error {
	cronId := cronRecord.Id
	schedule := cronRecord.Schedule

	jobFunc := func() {
		s.mutex.RLock()
		isActive := s.activeJobs[cronId]
		s.mutex.RUnlock()

		if !isActive {
			return
		}

		cronRecord, err := query.FindById[*models.Cron](cronId)
		if err != nil {
			logger.LogError("Cron record not found during execution", "cronId", cronId, "error", err)
			return
		}

		if !cronRecord.IsActive {
			s.mutex.Lock()
			s.activeJobs[cronId] = false
			s.mutex.Unlock()
			return
		}

		if err := s.executor.Execute(cronRecord); err != nil {
			logger.LogError("Cron execution failed", "cronId", cronId, "error", err)
		}
	}

	if err := s.cronScheduler.Add(cronId, schedule, jobFunc); err != nil {
		return fmt.Errorf("failed to add cron job: %w", err)
	}

	s.activeJobs[cronId] = true
	logger.LogInfo("Added cron to scheduler", "cronId", cronId, "schedule", schedule)

	nextRun := s.getNextRunTime(schedule)
	cronRecord.NextRun = parseTimeToDateTime(nextRun)
	cronRecord.RefreshUpdated()
	query.SaveRecord(cronRecord)

	return nil
}

func (s *Scheduler) getNextRunTime(schedule string) time.Time {
	now := time.Now()

	if len(schedule) < 5 {
		return now.Add(1 * time.Minute)
	}

	parts := parseCronSchedule(schedule)
	if parts == nil {
		return now.Add(1 * time.Minute)
	}

	minute, hour, day := parts[0], parts[1], parts[2]

	if minute == "*" || minute == "*/1" {
		return now.Add(1 * time.Minute)
	}

	if minute == "*/5" {
		return now.Add(5 * time.Minute)
	}

	if minute == "*/15" {
		return now.Add(15 * time.Minute)
	}

	if minute == "*/30" {
		return now.Add(30 * time.Minute)
	}

	if hour == "*" && minute == "0" {
		return now.Add(1 * time.Hour)
	}

	if day == "*" && hour == "0" && minute == "0" {
		return now.Add(24 * time.Hour)
	}

	return now.Add(1 * time.Hour)
}


package hooks

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/cron"
)

type CronHookConfig struct {
	CronService   *cron.CronService
	CronScheduler *cron.Scheduler
}

func RegisterCronHooks(pb core.App, config *CronHookConfig) {
	pb.OnRecordAfterCreateSuccess("track_devices").BindFunc(func(e *core.RecordEvent) error {
		devices, err := query.CountRecords[*models.TrackDevice](map[string]interface{}{})
		if err == nil && devices == 1 {
			createData := cron.CreateCronData{
				Name:              "track-device",
				Description:       "Track device online/offline status",
				Schedule:          "*/1 * * * *",
				WebhookURL:        "http://localhost:8090/api/internal/cron/track-device",
				WebhookMethod:     "POST",
				TimeoutSeconds:    30,
				NotifyOnSuccess:   false,
				NotifyOnFailure:   true,
				MaxRetries:        0,
				RetryDelaySeconds: 60,
			}

			if _, err := config.CronService.CreateSystemCron("track-device", createData); err != nil {
				logger.LogError("Failed to create track-device system cron", "error", err)
			} else {
				logger.LogInfo("Created track-device system cron")
			}
		}

		return e.Next()
	})

	pb.OnRecordAfterDeleteSuccess("track_devices").BindFunc(func(e *core.RecordEvent) error {
		devices, err := query.CountRecords[*models.TrackDevice](map[string]interface{}{})
		if err == nil && devices == 0 {
			if err := config.CronService.DeleteSystemCron("track-device"); err != nil {
				logger.LogError("Failed to delete track-device system cron", "error", err)
			} else {
				logger.LogInfo("Deleted track-device system cron")
			}
		}

		return e.Next()
	})

	pb.OnRecordAfterCreateSuccess("newsletter_settings").BindFunc(func(e *core.RecordEvent) error {
		isEnabled := e.Record.GetBool("is_enabled")
		if isEnabled {
			createData := cron.CreateCronData{
				Name:              "newsletter-inactivity-check",
				Description:       "Check for inactive newsletters",
				Schedule:          "0 3 * * *",
				WebhookURL:        "http://localhost:8090/api/internal/cron/newsletter-inactivity-check",
				WebhookMethod:     "POST",
				TimeoutSeconds:    30,
				NotifyOnSuccess:   false,
				NotifyOnFailure:   true,
				MaxRetries:        0,
				RetryDelaySeconds: 60,
			}

			if _, err := config.CronService.CreateSystemCron("newsletter-inactivity-check", createData); err != nil {
				logger.LogError("Failed to create newsletter-inactivity-check system cron", "error", err)
			} else {
				logger.LogInfo("Created newsletter-inactivity-check system cron")
			}
		}

		return e.Next()
	})

	pb.OnRecordAfterUpdateSuccess("newsletter_settings").BindFunc(func(e *core.RecordEvent) error {
		isEnabled := e.Record.GetBool("is_enabled")
		existing, err := config.CronService.GetSystemCron("newsletter-inactivity-check")

		if isEnabled && err != nil {
			createData := cron.CreateCronData{
				Name:              "newsletter-inactivity-check",
				Description:       "Check for inactive newsletters",
				Schedule:          "0 3 * * *",
				WebhookURL:        "http://localhost:8090/api/internal/cron/newsletter-inactivity-check",
				WebhookMethod:     "POST",
				TimeoutSeconds:    30,
				NotifyOnSuccess:   false,
				NotifyOnFailure:   true,
				MaxRetries:        0,
				RetryDelaySeconds: 60,
			}

			if _, err := config.CronService.CreateSystemCron("newsletter-inactivity-check", createData); err != nil {
				logger.LogError("Failed to create newsletter-inactivity-check system cron", "error", err)
			} else {
				logger.LogInfo("Created newsletter-inactivity-check system cron")
			}
		} else if !isEnabled && err == nil && existing != nil {
			if err := config.CronService.DeleteSystemCron("newsletter-inactivity-check"); err != nil {
				logger.LogError("Failed to delete newsletter-inactivity-check system cron", "error", err)
			} else {
				logger.LogInfo("Deleted newsletter-inactivity-check system cron")
			}
		}

		return e.Next()
	})

	pb.OnRecordAfterCreateSuccess("crons").BindFunc(func(e *core.RecordEvent) error {
		logger.LogInfo("Cron created")
		cronId := e.Record.Id

		cronRecord, err := query.FindById[*models.Cron](cronId)
		if err != nil {
			return e.Next()
		}

		if cronRecord.IsSystem {
			return e.Next()
		}

		if cronRecord.IsActive && config.CronScheduler != nil {
			if err := config.CronScheduler.AddCron(cronRecord); err != nil {
				logger.LogError("Failed to add cron to scheduler", "cronId", cronId, "error", err)
			}
		}

		return e.Next()
	})

	pb.OnRecordAfterUpdateSuccess("crons").BindFunc(func(e *core.RecordEvent) error {
		cronId := e.Record.Id

		cronRecord, err := query.FindById[*models.Cron](cronId)
		if err != nil {
			return e.Next()
		}

		if cronRecord.IsSystem {
			return e.Next()
		}

		if config.CronScheduler != nil {
			if cronRecord.IsActive {
				if err := config.CronScheduler.AddCron(cronRecord); err != nil {
					logger.LogError("Failed to update cron in scheduler", "cronId", cronId, "error", err)
				}
			} else {
				if err := config.CronScheduler.RemoveCron(cronId); err != nil {
					logger.LogError("Failed to remove cron from scheduler", "cronId", cronId, "error", err)
				}
			}
		}

		return e.Next()
	})

	pb.OnRecordAfterDeleteSuccess("crons").BindFunc(func(e *core.RecordEvent) error {
		cronId := e.Record.Id

		if config.CronScheduler != nil {
			if err := config.CronScheduler.RemoveCron(cronId); err != nil {
				logger.LogError("Failed to remove cron from scheduler", "cronId", cronId, "error", err)
			}
		}

		return e.Next()
	})
}

func boolPtr(b bool) *bool {
	return &b
}

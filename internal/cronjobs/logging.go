package cronjobs

import (
	"time"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

func CleanupLogs() {
	logger.LogInfo("Starting logs retention cleanup")

	projects, err := query.FindAllByFilter[*models.LoggingProject](map[string]interface{}{})
	if err != nil {
		logger.LogError("Failed to fetch logging projects for cleanup", "error", err)
		return
	}

	for _, project := range projects {
		if project.Retention <= 0 {
			continue
		}

		cutoff := time.Now().AddDate(0, 0, -project.Retention)
		cutoffStr := cutoff.Format("2006-01-02 15:04:05")

		totalDeleted := 0
		for {
			rowsAffected, err := query.DeleteBatch[*models.Log](map[string]interface{}{
				"project": project.Id,
				"timestamp": map[string]interface{}{
					"lte": cutoffStr,
				},
			}, 1000)

			if err != nil {
				logger.LogError("Failed to delete logs batch", "project", project.Slug, "error", err)
				break
			}

			if rowsAffected == 0 {
				break
			}

			totalDeleted += int(rowsAffected)
			time.Sleep(50 * time.Millisecond)
		}

		if totalDeleted > 0 {
			logger.LogInfo("Logs cleanup completed", "project", project.Slug, "deleted", totalDeleted)
		}
	}
}

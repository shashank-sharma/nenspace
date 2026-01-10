package cronjobs

import (
	"context"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/credentials"
)

// AggregateCredentialStats aggregates and updates credential usage statistics
func AggregateCredentialStats() {
	logger.LogInfo("Starting credential stats aggregation...")

	statsService := credentials.NewStatsService()

	var results []struct {
		CredentialType string `db:"credential_type"`
		CredentialID   string `db:"credential_id"`
	}

	err := query.BaseQuery[*models.CredentialUsage]().
		Select("credential_type", "credential_id").
		Distinct(true).
		All(&results)

	if err != nil {
		logger.LogDebug("Error fetching credential usage stats: %v. This might be because the collection doesn't exist yet.", err)
		return
	}

	ctx := context.Background()
	updated := 0
	errCount := 0

	for _, res := range results {
		if res.CredentialType == "" || res.CredentialID == "" {
			continue
		}

		if err := statsService.UpdateCredentialCollectionStats(ctx, res.CredentialType, res.CredentialID); err != nil {
			logger.LogError("Error updating stats for credential %s:%s: %v", res.CredentialType, res.CredentialID, err)
			errCount++
		} else {
			updated++
		}
	}

	logger.LogInfo("Credential stats aggregation completed: %d updated, %d errors", updated, errCount)
}

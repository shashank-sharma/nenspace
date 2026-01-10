package cronjobs

import (
	"time"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

func TrackDevices() error {
	activeDevices, err := query.FindAllByFilter[*models.TrackDevice](map[string]interface{}{
		"is_active": true,
		"is_online": true,
		"updated": map[string]interface{}{
			"lte": time.Now().Add(-6 * time.Minute),
		},
	})

	if err != nil {
		logger.LogError("No queries found")
	}
	for _, activeDevice := range activeDevices {
		if err = query.UpdateRecord[*models.TrackDevice](activeDevice.Id, map[string]interface{}{
			"is_online": false,
		}); err != nil {
			logger.LogError("Failed updating the tracking device records")
		}
	}
	return nil
}

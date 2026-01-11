package newsletter

import (
	"fmt"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

// ScanExistingMessages scans all existing messages for newsletters
func (s *Service) ScanExistingMessages(userId string) {
	logger.LogInfo(fmt.Sprintf("Starting newsletter scan for user: %s", userId))

	settings, err := s.GetSettings(userId)
	if err != nil {
		logger.LogError("Failed to get settings for scan", err)
		return
	}

	now := types.NowDateTime()
	updateData := map[string]interface{}{
		"scan_status":     "scanning",
		"error_message":   "",
		"scan_started_at": now,
	}

	total, err := query.CountRecords[*models.MailMessage](map[string]interface{}{"user": userId})
	if err == nil {
		updateData["total_messages"] = int(total)
	}

	if err := query.UpdateRecord[*models.NewsletterSettings](settings.Id, updateData); err != nil {
		logger.LogError("Failed to update scan status to scanning", err)
		return
	}

	batchSize := 100
	processedCount := settings.ProcessedMessages
	lastId := settings.LastScannedId

	for {
		messages, err := query.FindAllByFilterWithPagination[*models.MailMessage](
			map[string]interface{}{"user": userId},
			batchSize,
			processedCount,
		)

		if err != nil {
			s.markScanFailed(settings.Id, fmt.Sprintf("failed to fetch messages: %v", err))
			return
		}

		if len(messages) == 0 {
			break
		}

		for _, msg := range messages {
			if err := s.ProcessMailMessage(userId, msg); err != nil {
				logger.LogError(fmt.Sprintf("Failed to process message %s in scan", msg.Id), err)
			}
			processedCount++
			lastId = msg.Id
		}

		// Update progress after each batch
		countNewsletters, _ := query.CountRecords[*models.Newsletter](map[string]interface{}{"user": userId})

		batchUpdate := map[string]interface{}{
			"processed_messages":   processedCount,
			"last_scanned_id":      lastId,
			"detected_newsletters": int(countNewsletters),
		}

		if err := query.UpdateRecord[*models.NewsletterSettings](settings.Id, batchUpdate); err != nil {
			logger.LogError("Failed to update scan progress", err)
		}

		time.Sleep(10 * time.Millisecond)
	}

	completionUpdate := map[string]interface{}{
		"scan_status":       "completed",
		"scan_completed_at": types.NowDateTime(),
	}

	if err := query.UpdateRecord[*models.NewsletterSettings](settings.Id, completionUpdate); err != nil {
		logger.LogError("Failed to update scan status to completed", err)
	}

	logger.LogInfo(fmt.Sprintf("Newsletter scan completed for user: %s. Processed %d messages.", userId, processedCount))
}

func (s *Service) markScanFailed(settingsId string, errMsg string) {
	updateData := map[string]interface{}{
		"scan_status":   "failed",
		"error_message": errMsg,
	}
	if err := query.UpdateRecord[*models.NewsletterSettings](settingsId, updateData); err != nil {
		logger.LogError("Failed to update scan status to failed", err)
	}
}

// ResetStaleNewsletterScans finds scans that were interrupted (e.g. server crash) and resumes them
func ResetStaleNewsletterScans(s *Service) error {
	logger.LogInfo("Checking for stale newsletter scans...")

	staleSettings, err := query.FindAllByFilter[*models.NewsletterSettings](map[string]interface{}{
		"scan_status": "scanning",
	})
	if err != nil {
		return err
	}

	if len(staleSettings) == 0 {
		logger.LogInfo("No stale newsletter scans found")
		return nil
	}

	logger.LogInfo(fmt.Sprintf("Found %d stale newsletter scan(s), resuming...", len(staleSettings)))

	for _, settings := range staleSettings {
		// Resume in background
		go s.ScanExistingMessages(settings.User)
	}

	return nil
}

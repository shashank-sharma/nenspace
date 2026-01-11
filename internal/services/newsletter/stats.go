package newsletter

import (
	"math"
	"time"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

// UpdateNewsletterStats recalculates statistics for a newsletter record
func UpdateNewsletterStats(newsletter *models.Newsletter) error {
	filter := map[string]interface{}{
		"newsletter": newsletter.Id,
	}

	totalCount, err := query.CountRecords[*models.NewsletterEmail](filter)
	if err != nil {
		return err
	}

	newsletter.TotalCount = int(totalCount)

	if totalCount > 0 {
		if totalCount > 1 {
			duration := newsletter.LastSeen.Time().Sub(newsletter.FirstSeen.Time())
			days := duration.Hours() / 24
			newsletter.FrequencyDays = days / float64(totalCount-1)
		}
	}

	return query.SaveRecord(newsletter)
}

// ComputeFrequency calculates the average days between emails for a newsletter
func ComputeFrequency(newsletterId string) (float64, error) {
	n, err := query.FindById[*models.Newsletter](newsletterId)
	if err != nil {
		return 0, err
	}
	return n.FrequencyDays, nil
}

// MarkInactiveNewsletters identifies newsletters that haven't sent an email in a while
func MarkInactiveNewsletters() error {
	newsletters, err := query.FindAllByFilter[*models.Newsletter](map[string]interface{}{
		"is_active": true,
	})
	if err != nil {
		return err
	}

	now := time.Now()
	count := 0

	for _, n := range newsletters {
		// If frequency is 0 (only 1 email), use a default of 30 days
		freq := n.FrequencyDays
		if freq <= 0 {
			freq = 30
		}

		// Mark as inactive if not seen in 3x frequency (min 60 days)
		threshold := freq * 3
		if threshold < 60 {
			threshold = 60
		}

		if now.Sub(n.LastSeen.Time()).Hours()/24 > threshold {
			n.IsActive = false
			if err := query.SaveRecord(n); err != nil {
				logger.LogError("Failed to mark newsletter as inactive: "+n.Id, err)
			} else {
				count++
			}
		}
	}

	if count > 0 {
		logger.LogInfo("Marked newsletters as inactive", "count", count)
	}

	return nil
}

// CalculateInitialStats handles the first few emails of a newsletter
func CalculateInitialStats(newsletter *models.Newsletter, msgDate time.Time) {
	if newsletter.TotalCount == 0 {
		newsletter.FirstSeen.Scan(msgDate)
		newsletter.LastSeen.Scan(msgDate)
		newsletter.TotalCount = 1
		newsletter.IsActive = true
	} else {
		newsletter.TotalCount++

		if msgDate.After(newsletter.LastSeen.Time()) {
			newsletter.LastSeen.Scan(msgDate)
		}
		if msgDate.Before(newsletter.FirstSeen.Time()) {
			newsletter.FirstSeen.Scan(msgDate)
		}

		// Update frequency
		if newsletter.TotalCount > 1 {
			duration := newsletter.LastSeen.Time().Sub(newsletter.FirstSeen.Time())
			days := math.Abs(duration.Hours() / 24)
			newsletter.FrequencyDays = days / float64(newsletter.TotalCount-1)
		}
	}
}

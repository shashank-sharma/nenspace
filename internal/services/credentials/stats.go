package credentials

import (
	"context"
	"fmt"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/store"
)

type CredentialStats struct {
	CredentialType   string
	CredentialID     string
	TotalRequests    int64
	SuccessCount     int64
	FailureCount     int64
	SuccessRate      float64
	TotalTokens      int64
	LastUsedAt       time.Time
	AvgResponseTime  float64
	TotalConnections int64
}

type StatsService struct{}

func NewStatsService() *StatsService {
	return &StatsService{}
}

func (s *StatsService) AggregateStats(ctx context.Context, credentialType, credentialID string) (*CredentialStats, error) {
	dao := store.GetDao()

	query := dao.DB().Select("*").From("credential_usage").
		Where(dbx.HashExp{
			"credential_type": credentialType,
			"credential_id":   credentialID,
		}).
		OrderBy("timestamp DESC").
		Limit(10000)

	var dbxRecords []dbx.NullStringMap
	if err := query.All(&dbxRecords); err != nil {
		return &CredentialStats{
			CredentialType: credentialType,
			CredentialID:   credentialID,
		}, nil
	}

	if len(dbxRecords) == 0 {
		return &CredentialStats{
			CredentialType: credentialType,
			CredentialID:   credentialID,
		}, nil
	}

	// Aggregate in memory
	var totalRequests int64
	var successCount int64
	var failureCount int64
	var totalTokens int64
	var totalResponseTime int64
	var lastUsedAt time.Time
	var totalConnections int64

	for _, dbxRecord := range dbxRecords {
		totalRequests++

		statusCodeVal := dbxRecord["status_code"]
		var statusCode int
		if statusCodeVal.Valid {
			if code, err := parseInt(statusCodeVal.String); err == nil {
				statusCode = code
			}
		}

		if statusCode >= 200 && statusCode < 400 {
			successCount++
		} else {
			failureCount++
		}

		if tokensVal := dbxRecord["tokens_used"]; tokensVal.Valid {
			if tokens, err := parseInt64(tokensVal.String); err == nil {
				totalTokens += tokens
			}
		}

		if rtVal := dbxRecord["response_time_ms"]; rtVal.Valid {
			if rt, err := parseInt64(rtVal.String); err == nil {
				totalResponseTime += rt
			}
		}

		if tsVal := dbxRecord["timestamp"]; tsVal.Valid {
			if ts, err := time.Parse(time.RFC3339, tsVal.String); err == nil {
				if ts.After(lastUsedAt) {
					lastUsedAt = ts
				}
			}
		}

		if credentialType == "security_key" {
			if methodVal := dbxRecord["method"]; methodVal.Valid && methodVal.String == "SSH_CONNECT" {
				totalConnections++
			}
		}
	}

	var successRate float64
	if totalRequests > 0 {
		successRate = float64(successCount) / float64(totalRequests)
	}

	var avgResponseTime float64
	if totalRequests > 0 {
		avgResponseTime = float64(totalResponseTime) / float64(totalRequests)
	}

	return &CredentialStats{
		CredentialType:   credentialType,
		CredentialID:     credentialID,
		TotalRequests:    totalRequests,
		SuccessCount:     successCount,
		FailureCount:     failureCount,
		SuccessRate:      successRate,
		TotalTokens:      totalTokens,
		LastUsedAt:       lastUsedAt,
		AvgResponseTime:  avgResponseTime,
		TotalConnections: totalConnections,
	}, nil
}

// Helper functions for parsing
func parseInt(s string) (int, error) {
	var result int
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}

func parseInt64(s string) (int64, error) {
	var result int64
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}

func (s *StatsService) UpdateCredentialCollectionStats(ctx context.Context, credentialType, credentialID string) error {
	stats, err := s.AggregateStats(ctx, credentialType, credentialID)
	if err != nil {
		return fmt.Errorf("failed to aggregate stats: %w", err)
	}

	dao := store.GetDao()
	collectionName := GetCollectionName(credentialType)
	if collectionName == "" {
		return fmt.Errorf("unknown credential type: %s", credentialType)
	}

	record, err := dao.FindRecordById(collectionName, credentialID)
	if err != nil {
		return fmt.Errorf("failed to find credential record: %w", err)
	}

	updateData := map[string]interface{}{
		"total_requests":    stats.TotalRequests,
		"total_tokens_used": stats.TotalTokens,
		"success_rate":      stats.SuccessRate,
	}

	if !stats.LastUsedAt.IsZero() {
		lastUsed := types.DateTime{}
		lastUsed.Scan(stats.LastUsedAt)
		updateData["last_used_at"] = lastUsed
	}

	if credentialType == "security_key" {
		updateData["total_connections"] = stats.TotalConnections
	}

	for key, value := range updateData {
		record.Set(key, value)
	}

	if err := dao.Save(record); err != nil {
		return fmt.Errorf("failed to update credential stats: %w", err)
	}

	return nil
}

func (s *StatsService) AggregateAllUserStats(ctx context.Context, userID string) (map[string]*CredentialStats, error) {
	dao := store.GetDao()

	query := dao.DB().Select("*").From("credential_usage").
		Where(dbx.HashExp{"user": userID}).
		OrderBy("timestamp DESC").
		Limit(50000)

	var dbxRecords []dbx.NullStringMap
	if err := query.All(&dbxRecords); err != nil {
		return nil, fmt.Errorf("failed to query stats: %w", err)
	}

	statsMap := make(map[string]*CredentialStats)

	for _, dbxRecord := range dbxRecords {
		credTypeVal := dbxRecord["credential_type"]
		credIDVal := dbxRecord["credential_id"]
		credType := ""
		credID := ""
		if credTypeVal.Valid {
			credType = credTypeVal.String
		}
		if credIDVal.Valid {
			credID = credIDVal.String
		}
		key := fmt.Sprintf("%s:%s", credType, credID)

		stats, exists := statsMap[key]
		if !exists {
			stats = &CredentialStats{
				CredentialType: credType,
				CredentialID:   credID,
			}
			statsMap[key] = stats
		}

		stats.TotalRequests++

		statusCodeVal := dbxRecord["status_code"]
		var statusCode int
		if statusCodeVal.Valid {
			if code, err := parseInt(statusCodeVal.String); err == nil {
				statusCode = code
			}
		}

		if statusCode >= 200 && statusCode < 400 {
			stats.SuccessCount++
		} else {
			stats.FailureCount++
		}

		if tokensVal := dbxRecord["tokens_used"]; tokensVal.Valid {
			if tokens, err := parseInt64(tokensVal.String); err == nil {
				stats.TotalTokens += tokens
			}
		}

		if tsVal := dbxRecord["timestamp"]; tsVal.Valid {
			if ts, err := time.Parse(time.RFC3339, tsVal.String); err == nil {
				if ts.After(stats.LastUsedAt) {
					stats.LastUsedAt = ts
				}
			}
		}

		if credType == "security_key" {
			if methodVal := dbxRecord["method"]; methodVal.Valid && methodVal.String == "SSH_CONNECT" {
				stats.TotalConnections++
			}
		}
	}

	for _, stats := range statsMap {
		if stats.TotalRequests > 0 {
			stats.SuccessRate = float64(stats.SuccessCount) / float64(stats.TotalRequests)
		}
	}

	return statsMap, nil
}

func GetCollectionName(credentialType string) string {
	switch credentialType {
	case "token":
		return "tokens"
	case "dev_token":
		return "dev_tokens"
	case "api_key":
		return "api_keys"
	case "security_key":
		return "security_keys"
	default:
		return ""
	}
}

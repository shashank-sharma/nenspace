package filemanager

import (
	"fmt"

	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

const DefaultQuotaBytes = 1073741824

func GetQuotaInfo(app core.App, userId string) (quotaBytes int64, usedBytes int64, err error) {
	quota, err := query.FindByFilter[*models.UserStorageQuota](map[string]interface{}{
		"user": userId,
	})

	if err != nil {
		return DefaultQuotaBytes, 0, nil
	}

	quotaBytes = quota.QuotaBytes
	if quotaBytes == 0 {
		quotaBytes = DefaultQuotaBytes
	}

	usedBytes = quota.UsedBytes
	return quotaBytes, usedBytes, nil
}

func CheckQuotaAvailable(app core.App, userId string, fileSize int64) (bool, error) {
	quotaBytes, usedBytes, err := GetQuotaInfo(app, userId)
	if err != nil {
		return false, err
	}

	availableBytes := quotaBytes - usedBytes
	return availableBytes >= fileSize, nil
}

func UpdateQuotaUsage(app core.App, userId string, deltaBytes int64) error {
	quota, err := query.FindByFilter[*models.UserStorageQuota](map[string]interface{}{
		"user": userId,
	})

	if err != nil {
		newQuota := &models.UserStorageQuota{
			User:       userId,
			QuotaBytes: DefaultQuotaBytes,
			UsedBytes:  deltaBytes,
		}

		if err := query.SaveRecord(newQuota); err != nil {
			return fmt.Errorf("failed to create quota record: %w", err)
		}
		return nil
	}

	newUsed := quota.UsedBytes + deltaBytes
	if newUsed < 0 {
		newUsed = 0
	}

	quota.UsedBytes = newUsed
	if err := query.SaveRecord(quota); err != nil {
		return fmt.Errorf("failed to update quota: %w", err)
	}

	return nil
}

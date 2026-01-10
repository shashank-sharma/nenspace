package filemanager

import (
	"fmt"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/hooks/helpers"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/filemanager"
)

func RegisterQuotaHooks(pb *pocketbase.PocketBase) {
	pb.OnRecordCreateRequest("user_storage_quotas").BindFunc(func(e *core.RecordRequestEvent) error {
		return validateQuotaCreate(e)
	})

	pb.OnRecordUpdateRequest("user_storage_quotas").BindFunc(func(e *core.RecordRequestEvent) error {
		return validateQuotaUpdate(e)
	})
}

func validateQuotaCreate(e *core.RecordRequestEvent) error {
	userId := e.Record.GetString("user")
	if userId == "" {
		return fmt.Errorf("user field is required")
	}

	quotaBytes := helpers.GetInt64FromRecord(e.Record, "quota_bytes")
	if quotaBytes < 0 {
		return fmt.Errorf("quota must be greater than or equal to 0")
	}

	if quotaBytes == 0 {
		e.Record.Set("quota_bytes", filemanager.DefaultQuotaBytes)
	}

	return e.Next()
}

func validateQuotaUpdate(e *core.RecordRequestEvent) error {
	if helpers.HasField(e.Record, "quota_bytes") {
		quotaBytes := helpers.GetInt64FromRecord(e.Record, "quota_bytes")
		if quotaBytes < 0 {
			return fmt.Errorf("quota must be greater than or equal to 0")
		}
	}

	if helpers.HasField(e.Record, "used_bytes") {
		usedBytes := helpers.GetInt64FromRecord(e.Record, "used_bytes")
		if usedBytes < 0 {
			return fmt.Errorf("used bytes must be greater than or equal to 0")
		}
		existingQuota, err := query.FindById[*models.UserStorageQuota](e.Record.Id)
		if err != nil {
			return fmt.Errorf("quota record not found: %w", err)
		}
		if !helpers.IsAdmin(existingQuota.User) {
			return fmt.Errorf("cannot modify used_bytes directly - it is managed automatically")
		}
	}

	return e.Next()
}




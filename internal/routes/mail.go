package routes

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/mail"
	"github.com/shashank-sharma/backend/internal/services/oauth"
	"github.com/shashank-sharma/backend/internal/util"
)

type MailAuthData struct {
	Code       string `json:"code"`
	Provider   string `json:"provider"`
	MailSyncID string `json:"mail_sync_id,omitempty"` // Optional: ID of existing mail sync to update
}

func RegisterMailRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, mailService *mail.MailService) {
	// Mail
	mailRouter := apiRouter.Group(path)
	mailRouter.GET("/auth/redirect", func(e *core.RequestEvent) error {
		return MailAuthHandler(mailService, e)
	})

	mailRouter.POST("/auth/callback", func(e *core.RequestEvent) error {
		return MailAuthCallback(mailService, e)
	})

	mailRouter.POST("/sync", func(e *core.RequestEvent) error {
		return MailSyncHandler(mailService, e)
	})

	mailRouter.GET("/sync/status", func(e *core.RequestEvent) error {
		return MailSyncStatusHandler(mailService, e)
	})

	mailRouter.GET("/sync/inactive", func(e *core.RequestEvent) error {
		return MailInactiveSyncsHandler(mailService, e)
	})
}

// ResetStaleSyncStatuses resumes any mail syncs that are marked as "in_progress"
// but are not actually running (e.g., after a server crash/restart)
// It resumes the sync using the available checkpoint (last_sync_state) if present
func ResetStaleSyncStatuses(ms *mail.MailService) error {
	logger.LogInfo("Checking for stale mail sync statuses...")

	// Find all mail syncs with status "in_progress"
	staleSyncs, err := query.FindAllByFilter[*models.MailSync](map[string]interface{}{
		"sync_status": "in_progress",
	})
	if err != nil {
		logger.LogError("Failed to query stale sync statuses", err)
		return err
	}

	if len(staleSyncs) == 0 {
		logger.LogInfo("No stale mail sync statuses found")
		return nil
	}

	logger.LogInfo(fmt.Sprintf("Found %d stale mail sync(s), resuming sync with checkpoint", len(staleSyncs)))

	// Resume each stale sync using the checkpoint
	resumedCount := 0
	for _, mailSync := range staleSyncs {
		// Check if mail sync is active before resuming
		if !mailSync.IsActive {
			logger.LogInfo(fmt.Sprintf("Skipping inactive mail sync %s (user: %s)", mailSync.Id, mailSync.User))
			// Set status to inactive instead of in_progress
			updateData := map[string]interface{}{
				"sync_status": "inactive",
			}
			if err := query.UpdateRecord[*models.MailSync](mailSync.Id, updateData); err != nil {
				logger.LogError(fmt.Sprintf("Failed to update inactive sync status for mail sync %s", mailSync.Id), err)
			}
			continue
		}

		// Reload the mail sync to get latest state
		reloadedSync, err := query.FindById[*models.MailSync](mailSync.Id)
		if err != nil {
			logger.LogError(fmt.Sprintf("Failed to reload mail sync %s", mailSync.Id), err)
			continue
		}

		// Recovery logic for stale syncs:
		// 1. If full sync checkpoint exists -> MUST resume full sync (even if last_sync_state exists)
		// 2. If last_sync_state exists but no checkpoint -> use incremental sync (normal case)
		// 3. If neither exists -> this was an initial full sync that failed, start fresh full sync
		//
		// IMPORTANT: Do NOT recover last_sync_state if checkpoint doesn't exist AND last_sync_state is empty,
		// because that means it was an initial full sync that failed. Recovering would cause incremental sync
		// to run, skipping the full sync that never completed.
		if !reloadedSync.LastFullSyncCheckpoint.IsZero() {
			logger.LogInfo(fmt.Sprintf("Mail sync %s has full sync checkpoint at %v, will resume full sync (checkpoint takes priority)",
				reloadedSync.Id, reloadedSync.LastFullSyncCheckpoint))
			// Clear any recovered last_sync_state to prevent incremental sync attempt
			// The checkpoint indicates full sync is incomplete
			if reloadedSync.LastSyncState != "" {
				logger.LogWarning(fmt.Sprintf("Mail sync %s has both checkpoint and last_sync_state, clearing last_sync_state to ensure full sync completes first",
					reloadedSync.Id))
				reloadedSync.LastSyncState = ""
			}
		} else if reloadedSync.LastSyncState == "" {
			// Both checkpoint and last_sync_state are empty
			// This could be:
			// 1. Initial full sync that failed before checkpoint was saved
			// 2. Fresh sync with no messages yet
			//
			// Try to recover checkpoint from database (oldest message's date)
			// If messages exist, we should resume full sync from that point
			// If no messages exist, start fresh full sync
			allMessages, findErr := query.FindAllByFilter[*models.MailMessage](map[string]interface{}{
				"mail_sync": reloadedSync.Id,
			})
			if findErr == nil && len(allMessages) > 0 {
				// Find the oldest message by internal_date to use as checkpoint
				var oldestMsg *models.MailMessage
				for _, msg := range allMessages {
					if oldestMsg == nil ||
						(!msg.InternalDate.IsZero() &&
							(oldestMsg.InternalDate.IsZero() || msg.InternalDate.Time().Before(oldestMsg.InternalDate.Time()))) {
						oldestMsg = msg
					}
				}
				if oldestMsg != nil && !oldestMsg.InternalDate.IsZero() {
					// Messages exist but no checkpoint - recover checkpoint from oldest message
					// This means full sync was interrupted before checkpoint was saved
					checkpointUpdate := types.DateTime{}
					checkpointUpdate.Scan(oldestMsg.InternalDate.Time())
					updateData := map[string]interface{}{
						"last_full_sync_checkpoint": checkpointUpdate,
					}
					if updateErr := query.UpdateRecord[*models.MailSync](reloadedSync.Id, updateData); updateErr == nil {
						reloadedSync.LastFullSyncCheckpoint = checkpointUpdate
						logger.LogInfo(fmt.Sprintf("Recovered full sync checkpoint from oldest message for mail sync %s: %v (will resume full sync)",
							reloadedSync.Id, checkpointUpdate))
					} else {
						logger.LogError(fmt.Sprintf("Failed to save recovered checkpoint for mail sync %s", reloadedSync.Id), updateErr)
					}
				}
			} else {
				// No messages exist - this is truly a fresh sync
				logger.LogInfo(fmt.Sprintf("Mail sync %s has no checkpoint, no last_sync_state, and no messages - will start fresh full sync",
					reloadedSync.Id))
			}
			// Explicitly ensure last_sync_state remains empty to prevent incremental sync
			reloadedSync.LastSyncState = ""
		} else {
			// last_sync_state exists and no checkpoint - this is normal, incremental sync will run
			logger.LogInfo(fmt.Sprintf("Mail sync %s has last_sync_state (%s) but no checkpoint - will use incremental sync",
				reloadedSync.Id, reloadedSync.LastSyncState))
		}

		// Resume sync in background (it will use last_sync_state checkpoint if available)
		go func(sync *models.MailSync) {
			logger.LogInfo(fmt.Sprintf("Resuming stale sync for mail sync %s (user: %s, checkpoint: %s)",
				sync.Id, sync.User, sync.LastSyncState))

			err := ms.SyncMessages(sync)

			updateData := map[string]interface{}{}

			if err != nil {
				logger.LogError(fmt.Sprintf("Resumed sync failed for mail sync %s", sync.Id), err)
				// Store error message in sync_status field
				errorMsg := err.Error()
				if len(errorMsg) > 200 {
					errorMsg = errorMsg[:200] + "..."
				}
				updateData["sync_status"] = "failed: " + errorMsg
			} else {
				// Only update last_synced on successful sync
				updateData["sync_status"] = "completed"
				updateData["last_synced"] = types.NowDateTime()
			}

			if err := query.UpdateRecord[*models.MailSync](sync.Id, updateData); err != nil {
				logger.LogError(fmt.Sprintf("Failed to update final sync status for mail sync %s", sync.Id), err)
			}
		}(reloadedSync)

		resumedCount++
		logger.LogInfo(fmt.Sprintf("Resumed stale sync for mail sync %s (user: %s)", mailSync.Id, mailSync.User))
	}

	logger.LogInfo(fmt.Sprintf("Successfully resumed %d/%d stale mail syncs", resumedCount, len(staleSyncs)))
	return nil
}

// MailAuthHandler initiates the OAuth flow for Gmail
func MailAuthHandler(ms *mail.MailService, e *core.RequestEvent) error {
	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"url": ms.GetAuthUrl(),
	})
}

// MailAuthCallback handles the OAuth callback from Gmail
func MailAuthCallback(ms *mail.MailService, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	mailAuthData := &MailAuthData{}
	if err := e.BindBody(mailAuthData); err != nil {
		logger.LogError("Failed to parse request body", "error", err)
		return util.RespondError(e, util.NewBadRequestError("Invalid request body"))
	}

	googleConfig := ms.GetConfig()
	token, err := googleConfig.Exchange(e.Request.Context(), mailAuthData.Code)
	if err != nil {
		logger.LogError("Token exchange failed", "error", err)
		return util.RespondError(e, util.ErrUnauthorized)
	}

	client := googleConfig.Client(e.Request.Context(), token)
	userInfo, err := oauth.FetchUserInfo(client)
	if err != nil {
		logger.LogError("Failed to fetch user info", "error", err)
		return util.RespondError(e, util.ErrUnauthorized)
	}

	expiry := types.DateTime{}
	expiry.Scan(token.Expiry)

	mailToken := &models.Token{
		User:         userId,
		Provider:     "gmail",
		Account:      userInfo.Email,
		AccessToken:  token.AccessToken,
		TokenType:    token.TokenType,
		RefreshToken: token.RefreshToken,
		Expiry:       expiry,
		Scope:        token.TokenType,
		IsActive:     true,
	}

	// Use typed filter for token upsert
	tokenFilter := &query.TokenFilter{
		BaseFilter: query.BaseFilter{},
		Provider:   "gmail",
		Account:    userInfo.Email,
	}
	if err := query.UpsertRecord[*models.Token](mailToken, tokenFilter.ToMap()); err != nil {
		logger.LogError("Failed to save token", "error", err, "userId", userId)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	// If mail_sync_id is provided, update that specific mail sync
	var mailSync *models.MailSync
	if mailAuthData.MailSyncID != "" {
		// Find the existing mail sync
		mailSync, err = query.FindById[*models.MailSync](mailAuthData.MailSyncID)
		if err != nil {
			logger.LogError(fmt.Sprintf("Failed to find mail sync %s", mailAuthData.MailSyncID), err)
			return util.RespondWithError(e, util.ErrNotFound, fmt.Errorf("mail sync not found"))
		}

		// Verify it belongs to the user
		if mailSync.User != userId {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		// Fetch labels using the new token
		labelsJSON, err := ms.FetchLabelsForToken(mailToken.Id)
		if err != nil {
			logger.LogError("Failed to fetch labels", "error", err, "userId", userId)
			return util.RespondWithError(e, util.ErrInternalServer, err)
		}

		// Update the specific mail sync with new token and labels
		updateData := map[string]interface{}{
			"is_active":   true,
			"token":       mailToken.Id,
			"sync_status": "ready",
			"labels":      labelsJSON,
		}
		if err := query.UpdateRecord[*models.MailSync](mailAuthData.MailSyncID, updateData); err != nil {
			logger.LogError(fmt.Sprintf("Failed to update mail sync %s", mailAuthData.MailSyncID), err)
			return util.RespondWithError(e, util.ErrInternalServer, err)
		}

		// Reload to get updated record
		mailSync, err = query.FindById[*models.MailSync](mailAuthData.MailSyncID)
		if err != nil {
			logger.LogError(fmt.Sprintf("Failed to reload mail sync %s", mailAuthData.MailSyncID), err)
		}
	} else {
		// Normal flow: create or update mail sync based on user/provider
		mailSync, err = ms.InitializeLabels(mailToken.Id, userId)
		if err != nil {
			logger.LogError("Failed to initialize labels", "error", err, "userId", userId)
			return util.RespondWithError(e, util.ErrInternalServer, err)
		}

		// If mail sync was inactive, reactivate it with the new token
		if mailSync != nil && !mailSync.IsActive {
			updateData := map[string]interface{}{
				"is_active":   true,
				"token":       mailToken.Id,
				"sync_status": "ready",
			}
			if err := query.UpdateRecord[*models.MailSync](mailSync.Id, updateData); err != nil {
				logger.LogError(fmt.Sprintf("Failed to reactivate mail sync %s", mailSync.Id), err)
			} else {
				logger.LogInfo(fmt.Sprintf("Reactivated mail sync %s with new token", mailSync.Id))
			}
		} else if mailSync != nil {
			// Update token even if sync was already active (in case of re-auth)
			updateData := map[string]interface{}{
				"token": mailToken.Id,
			}
			if err := query.UpdateRecord[*models.MailSync](mailSync.Id, updateData); err != nil {
				logger.LogError(fmt.Sprintf("Failed to update mail sync %s token", mailSync.Id), err)
			}
		}
	}

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"message": "Mail authentication successful",
	})
}

// MailSyncHandler triggers a non-blocking mail sync
func MailSyncHandler(ms *mail.MailService, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	// Find active mail sync configuration using typed filter
	// TODO: Assumption that mailsync is possible by only 1 provider
	isActive := true
	filter := &query.MailSyncFilter{
		BaseFilter: query.BaseFilter{
			User:     userId,
			IsActive: &isActive,
		},
	}
	mailSync, err := query.FindByFilter[*models.MailSync](filter.ToMap())
	if err != nil {
		return util.RespondError(e, util.ErrNotFound)
	}

	// Check if mail sync is inactive
	if !mailSync.IsActive {
		return util.RespondError(e, util.NewBadRequestError("Mail sync is inactive - please re-authenticate"))
	}

	// Atomically check and set sync_status to in_progress to prevent race conditions
	// First, try to update only if status is not already in_progress
	// Note: This is a best-effort check. For true atomicity, we'd need database-level locking
	// or a conditional update query, but PocketBase doesn't support that directly.
	// We check again after reload to minimize race window.
	if mailSync.SyncStatus == "in_progress" {
		// Double-check by reloading the record
		reloadedSync, reloadErr := query.FindById[*models.MailSync](mailSync.Id)
		if reloadErr == nil && reloadedSync.SyncStatus == "in_progress" {
			return util.RespondError(e, util.NewBadRequestError("Mail sync is already in progress. Please wait for it to complete."))
		}
		// If reload failed or status changed, proceed (might be stale state)
	}

	// Only update sync_status to in_progress, don't update last_synced yet
	syncStatus := map[string]interface{}{
		"sync_status": "in_progress",
	}

	if err := query.UpdateRecord[*models.MailSync](mailSync.Id, syncStatus); err != nil {
		logger.LogError("Failed to update sync status", err)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	go func() {
		logger.LogInfo("Starting async mail sync for user: " + userId)

		err := ms.SyncMessages(mailSync)

		updateData := map[string]interface{}{}

		if err != nil {
			logger.LogError("Mail sync failed", err)
			// Store error message in sync_status field (we'll parse it in the status handler)
			// Format: "failed: <error message>"
			// Don't update last_synced on error
			errorMsg := err.Error()
			// Truncate if too long (sync_status field might have length limits)
			if len(errorMsg) > 200 {
				errorMsg = errorMsg[:200] + "..."
			}
			updateData["sync_status"] = "failed: " + errorMsg
		} else {
			// Only update last_synced on successful sync
			updateData["sync_status"] = "completed"
			updateData["last_synced"] = types.NowDateTime()
		}

		if err := query.UpdateRecord[*models.MailSync](mailSync.Id, updateData); err != nil {
			logger.LogError("Failed to update final sync status", err)
		}
	}()

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"message": "Mail sync started in background",
		"status":  "in_progress",
	})
}

// MailSyncStatusHandler checks the status of the mail sync
func MailSyncStatusHandler(ms *mail.MailService, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	// Use typed filter for mail sync query
	isActive := true
	filter := &query.MailSyncFilter{
		BaseFilter: query.BaseFilter{
			User:     userId,
			IsActive: &isActive,
		},
	}
	mailSync, err := query.FindByFilter[*models.MailSync](filter.ToMap())
	if err != nil {
		return util.RespondError(e, util.ErrNotFound)
	}

	// Use typed filter for message count
	messageFilter := &query.MailSyncFilter{
		BaseFilter: query.BaseFilter{
			User: userId,
		},
		MailSyncID: mailSync.Id,
	}
	messageCount, err := query.CountRecords[*models.MailMessage](messageFilter.ToMap())
	if err != nil {
		logger.LogError("Failed to count messages", err)
		messageCount = 0
	}

	// Parse error message from sync_status if it starts with "failed: "
	status := mailSync.SyncStatus
	errorMessage := ""
	needsReauth := false

	if len(status) > 7 && status[:7] == "failed:" {
		errorMessage = strings.TrimSpace(status[7:]) // Extract error message after "failed: "
		status = "failed"                            // Set status to just "failed"
		// Check if error indicates re-authentication is needed
		if strings.Contains(strings.ToLower(errorMessage), "re-authenticate") ||
			strings.Contains(strings.ToLower(errorMessage), "token expired") ||
			strings.Contains(strings.ToLower(errorMessage), "inactive") {
			needsReauth = true
		}
	} else if status == "inactive" {
		// Status is already "inactive", set needs reauth
		errorMessage = "Token expired - re-authentication required"
		needsReauth = true
	}

	response := map[string]interface{}{
		"id":            mailSync.Id,
		"status":        status,
		"last_synced":   mailSync.LastSynced,
		"message_count": messageCount,
		"is_active":     mailSync.IsActive,
		"needs_reauth":  needsReauth || !mailSync.IsActive,
	}

	// Include error message if present
	if errorMessage != "" {
		response["error_message"] = errorMessage
	}

	return util.RespondSuccess(e, http.StatusOK, response)
}

// MailInactiveSyncsHandler returns all inactive mail syncs for the user
func MailInactiveSyncsHandler(ms *mail.MailService, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	// Find all inactive mail syncs for the user
	isActive := false
	filter := &query.MailSyncFilter{
		BaseFilter: query.BaseFilter{
			User:     userId,
			IsActive: &isActive,
		},
	}

	mailSyncs, err := query.FindAllByFilter[*models.MailSync](filter.ToMap())
	if err != nil {
		logger.LogError("Failed to find inactive mail syncs", err)
		return util.RespondWithError(e, util.ErrInternalServer, err)
	}

	// Format response
	syncs := make([]map[string]interface{}, 0, len(mailSyncs))
	for _, sync := range mailSyncs {
		syncs = append(syncs, map[string]interface{}{
			"id":          sync.Id,
			"provider":    sync.Provider,
			"sync_status": sync.SyncStatus,
			"last_synced": sync.LastSynced,
			"created":     sync.Created,
		})
	}

	return util.RespondSuccess(e, http.StatusOK, map[string]interface{}{
		"syncs": syncs,
	})
}

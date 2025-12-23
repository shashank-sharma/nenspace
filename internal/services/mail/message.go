package mail

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"google.golang.org/api/gmail/v1"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

const (
	// Gmail label constants
	labelUNREAD    = "UNREAD"
	labelIMPORTANT = "IMPORTANT"
	labelSTARRED   = "STARRED"
	labelSPAM      = "SPAM"
	labelINBOX     = "INBOX"
	labelTRASH     = "TRASH"
	labelDRAFT     = "DRAFT"
	labelSENT      = "SENT"

	// Sync configuration
	numWorkers         = 5
	messagesBufferSize = 100
	maxResultsPerPage  = 100
)

// SyncStats tracks synchronization statistics
type SyncStats struct {
	MessagesProcessed int
	MessagesFailed    int
	StartTime         time.Time
	Duration          time.Duration
}

// SyncMessages synchronizes messages from Gmail for the given MailSync configuration
// It attempts incremental sync first, falling back to full sync if needed
func (ms *MailService) SyncMessages(mailSync *models.MailSync) error {
	if mailSync == nil {
		return fmt.Errorf("mailSync cannot be nil")
	}

	// Create a context with a longer timeout for the entire sync operation
	// This context will be used for OAuth token refresh operations
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	stats := &SyncStats{
		StartTime: time.Now(),
	}

	client, err := ms.FetchClient(ctx, mailSync.Token)
	if err != nil {
		// Check if error is about inactive token
		errMsg := err.Error()
		if strings.Contains(errMsg, "is marked as inactive") || strings.Contains(errMsg, "please re-authenticate") {
			// Mark mail sync as inactive
			updateData := map[string]interface{}{
				"is_active":   false,
				"sync_status": "inactive",
			}
			if updateErr := query.UpdateRecord[*models.MailSync](mailSync.Id, updateData); updateErr != nil {
				logger.LogError(fmt.Sprintf("Failed to mark mail sync %s as inactive", mailSync.Id), updateErr)
			}
			return fmt.Errorf("mail sync is inactive: token expired - please re-authenticate: %w", err)
		}
		return fmt.Errorf("failed to fetch OAuth client: %w", err)
	}

	gmailService, err := ms.GetGmailService(ctx, client)
	if err != nil {
		return fmt.Errorf("failed to create Gmail service: %w", err)
	}

	// CRITICAL: If full sync checkpoint exists, we MUST complete full sync first
	// Even if last_sync_state exists (recovered), we cannot do incremental sync
	// until full sync is complete (checkpoint cleared)
	if !mailSync.LastFullSyncCheckpoint.IsZero() {
		logger.LogInfo(fmt.Sprintf("Resuming interrupted full sync for user %s from checkpoint %v (full sync must complete before incremental)",
			mailSync.User, mailSync.LastFullSyncCheckpoint))
		if err := ms.fullSync(ctx, gmailService, mailSync, stats); err != nil {
			return fmt.Errorf("full sync failed: %w", err)
		}
		stats.Duration = time.Since(stats.StartTime)
		logger.LogInfo(fmt.Sprintf("Full sync completed: processed %d messages, %d failed in %v",
			stats.MessagesProcessed, stats.MessagesFailed, stats.Duration))
		return nil
	}

	// Only attempt incremental sync if:
	// 1. We have a last_sync_state (history_id)
	// 2. AND no full sync checkpoint exists (full sync is complete)
	if mailSync.LastSyncState != "" {
		logger.LogInfo(fmt.Sprintf("Attempting incremental sync for user %s", mailSync.User))
		if err := ms.incrementalSync(ctx, gmailService, mailSync, stats); err == nil {
			stats.Duration = time.Since(stats.StartTime)
			logger.LogInfo(fmt.Sprintf("Incremental sync completed: processed %d messages in %v",
				stats.MessagesProcessed, stats.Duration))
			return nil
		}
		logger.LogInfo("Incremental sync failed, falling back to full sync")
	}

	// Start new full sync (no checkpoint, no last_sync_state, or incremental failed)
	logger.LogInfo(fmt.Sprintf("Starting full sync for user %s", mailSync.User))
	if err := ms.fullSync(ctx, gmailService, mailSync, stats); err != nil {
		return fmt.Errorf("full sync failed: %w", err)
	}

	stats.Duration = time.Since(stats.StartTime)
	logger.LogInfo(fmt.Sprintf("Full sync completed: processed %d messages, %d failed in %v",
		stats.MessagesProcessed, stats.MessagesFailed, stats.Duration))

	return nil
}

// fullSync performs a complete synchronization of all messages
// If last_full_sync_checkpoint is set, it resumes from that point (processes messages older than checkpoint)
func (ms *MailService) fullSync(ctx context.Context, srv *gmail.Service, mailSync *models.MailSync, stats *SyncStats) error {
	// Track the oldest message's internal_date we've processed
	// This will be updated periodically and used as checkpoint
	var oldestProcessedDate time.Time
	var oldestProcessedMutex sync.Mutex
	checkpointUpdateInterval := 50
	lastCheckpointUpdate := 0

	// If resuming, start from the checkpoint date
	if !mailSync.LastFullSyncCheckpoint.IsZero() {
		oldestProcessedDate = mailSync.LastFullSyncCheckpoint.Time()
		logger.LogInfo(fmt.Sprintf("Resuming full sync from checkpoint: %v", oldestProcessedDate))
	}

	messagesChannel := make(chan *gmail.Message, messagesBufferSize)
	errorChannel := make(chan error, numWorkers)
	var wg sync.WaitGroup

	// Start worker goroutines
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					logger.LogInfo(fmt.Sprintf("Worker %d: context cancelled, stopping", workerID))
					return
				case msg, ok := <-messagesChannel:
					if !ok {
						// Channel closed, no more messages
						return
					}

					// If resuming from checkpoint, check message date to skip already-processed messages
					// Gmail returns messages newest-first, so messages with date >= checkpoint are already processed
					if !oldestProcessedDate.IsZero() {
						// Get message metadata to check date (lightweight call)
						metadataMsg, err := srv.Users.Messages.Get("me", msg.Id).Format("metadata").MetadataHeaders("internalDate").Do()
						if err != nil {
							// If we can't get metadata, process it anyway (better safe than sorry)
							logger.LogWarning(fmt.Sprintf("Worker %d: failed to get metadata for %s, processing anyway", workerID, msg.Id))
						} else {
							msgDate := time.Unix(0, metadataMsg.InternalDate*int64(time.Millisecond))
							// If message date is newer than or equal to checkpoint, it's already processed
							if !msgDate.Before(oldestProcessedDate) {
								// Message already processed, skip
								continue
							}
						}
					}

					msgDate, err := ms.processMessage(ctx, srv, msg.Id, mailSync)
					if err != nil {
						stats.MessagesFailed++
						logger.LogError(fmt.Sprintf("Worker %d failed to process message %s", workerID, msg.Id), err)
						select {
						case errorChannel <- fmt.Errorf("worker %d: message %s: %w", workerID, msg.Id, err):
						default:
						}
					} else {
						stats.MessagesProcessed++

						// Update oldest processed date for checkpoint tracking
						oldestProcessedMutex.Lock()
						if oldestProcessedDate.IsZero() || msgDate.Before(oldestProcessedDate) {
							oldestProcessedDate = msgDate
						}
						oldestProcessedMutex.Unlock()

						// Periodically update checkpoint in database
						// Also update if we've processed messages but haven't updated in a while
						shouldUpdate := stats.MessagesProcessed-lastCheckpointUpdate >= checkpointUpdateInterval
						if shouldUpdate {
							oldestProcessedMutex.Lock()
							currentOldest := oldestProcessedDate
							oldestProcessedMutex.Unlock()

							if !currentOldest.IsZero() {
								checkpointUpdate := types.DateTime{}
								checkpointUpdate.Scan(currentOldest)
								updateData := map[string]interface{}{
									"last_full_sync_checkpoint": checkpointUpdate,
								}
								if updateErr := query.UpdateRecord[*models.MailSync](mailSync.Id, updateData); updateErr != nil {
									logger.LogError(fmt.Sprintf("Failed to update full sync checkpoint for mail sync %s", mailSync.Id), updateErr)
								} else {
									logger.LogInfo(fmt.Sprintf("Updated full sync checkpoint to %v (processed %d messages)", currentOldest, stats.MessagesProcessed))
								}
								lastCheckpointUpdate = stats.MessagesProcessed
							}
						}
					}
				}
			}
		}(i)
	}

	// Fetch messages in background
	go func() {
		defer close(messagesChannel)
		pageToken := ""

		for {
			select {
			case <-ctx.Done():
				logger.LogInfo("Context cancelled during message fetch")
				return
			default:
			}

			// Fetch messages from INBOX label
			req := srv.Users.Messages.List("me").LabelIds(labelINBOX).MaxResults(maxResultsPerPage)
			if pageToken != "" {
				req.PageToken(pageToken)
			}

			resp, err := req.Do()
			if err != nil {
				// Check for rate limiting (429)
				errMsg := strings.ToLower(err.Error())
				if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "rate limit") || strings.Contains(errMsg, "quota exceeded") {
					logger.LogWarning("Gmail API rate limit hit during message listing, will retry on next sync")
					select {
					case errorChannel <- fmt.Errorf("rate limit exceeded: %w", err):
					default:
					}
					return
				}
				logger.LogError("Failed to list messages", err)
				select {
				case errorChannel <- fmt.Errorf("failed to list messages: %w", err):
				default:
				}
				return
			}

			for _, msg := range resp.Messages {
				messagesChannel <- msg
			}

			pageToken = resp.NextPageToken
			if pageToken == "" {
				break
			}
		}
	}()

	wg.Wait()
	close(errorChannel)

	// Check for errors
	var syncError error
	select {
	case err := <-errorChannel:
		if err != nil {
			syncError = fmt.Errorf("error during sync: %w", err)
		}
	default:
	}

	// Try to update sync state - even on error, try to recover from messages
	profile, err := srv.Users.GetProfile("me").Do()
	var historyIdStr string
	if err != nil {
		logger.LogWarning(fmt.Sprintf("Failed to get profile for mail sync %s, attempting recovery from messages", mailSync.Id))
		// Try to recover from latest message
		recoveredHistoryId, recoverErr := ms.RecoverLastSyncStateFromMessages(mailSync.Id)
		if recoverErr != nil {
			logger.LogError(fmt.Sprintf("Failed to recover last_sync_state for mail sync %s", mailSync.Id), recoverErr)
			// If we can't recover and there was a sync error, return the sync error
			if syncError != nil {
				return syncError
			}
			return fmt.Errorf("failed to get profile and failed to recover: %w", err)
		}
		historyIdStr = recoveredHistoryId
	} else {
		historyIdStr = strconv.FormatUint(profile.HistoryId, 10)
	}

	// Prepare update data
	updateData := map[string]interface{}{}

	// On successful full sync completion:
	// 1. Clear the full sync checkpoint (we're done with full sync)
	// 2. Set last_sync_state to current history_id (for future incremental syncs)
	// 3. Update last_synced timestamp
	if syncError == nil {
		// Full sync completed successfully
		updateData["last_full_sync_checkpoint"] = nil // Clear checkpoint
		updateData["last_sync_state"] = historyIdStr
		updateData["last_synced"] = types.NowDateTime()
		logger.LogInfo(fmt.Sprintf("Full sync completed successfully, cleared checkpoint and set history_id to %s", historyIdStr))
	} else {
		// Full sync failed - preserve checkpoint so we can resume
		// Update checkpoint with the oldest message we processed (even if < 50 messages)
		oldestProcessedMutex.Lock()
		finalOldest := oldestProcessedDate
		oldestProcessedMutex.Unlock()

		if !finalOldest.IsZero() {
			checkpointUpdate := types.DateTime{}
			checkpointUpdate.Scan(finalOldest)
			updateData["last_full_sync_checkpoint"] = checkpointUpdate
			logger.LogInfo(fmt.Sprintf("Full sync failed, preserving checkpoint at %v for resume (processed %d messages)", finalOldest, stats.MessagesProcessed))
		} else if stats.MessagesProcessed > 0 {
			// If we processed messages but oldestProcessedDate is still zero (edge case)
			// Try to recover checkpoint from the latest processed message in database
			// Find the OLDEST message (not latest) to use as checkpoint
			// We need to find messages ordered by internal_date ASC (oldest first)
			// Since FindLatestByColumn orders DESC, we'll query all and find the oldest
			allMessages, findErr := query.FindAllByFilter[*models.MailMessage](map[string]interface{}{
				"mail_sync": mailSync.Id,
			})
			if findErr == nil && len(allMessages) > 0 {
				// Find the oldest message by internal_date
				var oldestMsg *models.MailMessage
				for _, msg := range allMessages {
					if oldestMsg == nil ||
						(!msg.InternalDate.IsZero() &&
							(oldestMsg.InternalDate.IsZero() || msg.InternalDate.Time().Before(oldestMsg.InternalDate.Time()))) {
						oldestMsg = msg
					}
				}
				if oldestMsg != nil && !oldestMsg.InternalDate.IsZero() {
					updateData["last_full_sync_checkpoint"] = oldestMsg.InternalDate
					logger.LogInfo(fmt.Sprintf("Full sync failed, preserving checkpoint from oldest message at %v (processed %d messages but oldest date not tracked)", oldestMsg.InternalDate, stats.MessagesProcessed))
				}
			}
		}
		// Don't update last_sync_state or last_synced on failure
	}

	if len(updateData) > 0 {
		if err := query.UpdateRecord[*models.MailSync](mailSync.Id, updateData); err != nil {
			logger.LogError(fmt.Sprintf("Failed to update sync state for mail sync %s", mailSync.Id), err)
			// Don't fail the sync if we can't update the state, but log it
		}
	}

	// Return the sync error if there was one
	if syncError != nil {
		return syncError
	}

	return nil
}

// RecoverLastSyncStateFromMessages attempts to recover last_sync_state from the latest mail message
// by reading history_id from external_data. This is useful when sync fails mid-way.
func (ms *MailService) RecoverLastSyncStateFromMessages(mailSyncId string) (string, error) {
	// Find the latest mail message for this mail sync, ordered by received_date
	latestMessage, err := query.FindLatestByColumn[*models.MailMessage](
		"received_date",
		map[string]interface{}{
			"mail_sync": mailSyncId,
		},
	)
	if err != nil {
		// Check if error is because no messages exist (empty mailbox)
		if strings.Contains(strings.ToLower(err.Error()), "no rows") ||
			strings.Contains(strings.ToLower(err.Error()), "not found") ||
			strings.Contains(strings.ToLower(err.Error()), "record not found") {
			return "", fmt.Errorf("no messages found in mailbox - cannot recover checkpoint")
		}
		return "", fmt.Errorf("failed to find latest message: %w", err)
	}

	// Parse external_data to extract history_id
	if latestMessage.ExternalData == "" {
		return "", fmt.Errorf("latest message has no external_data")
	}

	var externalData map[string]interface{}
	if err := json.Unmarshal([]byte(latestMessage.ExternalData), &externalData); err != nil {
		return "", fmt.Errorf("failed to parse external_data: %w", err)
	}

	historyId, ok := externalData["history_id"]
	if !ok {
		return "", fmt.Errorf("history_id not found in external_data")
	}

	// Convert to string (history_id is typically a uint64, but JSON unmarshals numbers as float64)
	var historyIdStr string
	switch v := historyId.(type) {
	case float64:
		historyIdStr = strconv.FormatUint(uint64(v), 10)
	case string:
		historyIdStr = v
	case uint64:
		historyIdStr = strconv.FormatUint(v, 10)
	default:
		historyIdStr = fmt.Sprintf("%v", historyId)
	}

	logger.LogInfo(fmt.Sprintf("Recovered last_sync_state from message %s: history_id=%s", latestMessage.Id, historyIdStr))
	return historyIdStr, nil
}

// processMessage processes a single Gmail message and stores it in the database
// Returns the message's internal_date for checkpoint tracking
func (ms *MailService) processMessage(ctx context.Context, srv *gmail.Service, messageId string, mailSync *models.MailSync) (time.Time, error) {
	if messageId == "" {
		return time.Time{}, fmt.Errorf("message ID cannot be empty")
	}

	msg, err := srv.Users.Messages.Get("me", messageId).Format("full").Do()
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to get message %s: %w", messageId, err)
	}

	body := ms.extractMessageBody(msg.Payload)
	from, to := ms.extractEmailAddresses(msg.Payload.Headers)
	subject := ms.extractHeader(msg.Payload.Headers, "Subject")

	// Parse dates
	internalDate := types.DateTime{}
	receivedDate := types.DateTime{}
	msgInternalDate := time.Unix(0, msg.InternalDate*int64(time.Millisecond))
	internalDate.Scan(msgInternalDate)

	if receivedStr := ms.extractHeader(msg.Payload.Headers, "Received"); receivedStr != "" {
		if parsedTime, err := time.Parse(time.RFC1123Z, receivedStr); err == nil {
			receivedDate.Scan(parsedTime)
		}
	}
	if receivedDate.IsZero() {
		receivedDate = internalDate
	}

	// Process labels
	flags := ms.processLabels(msg.LabelIds)

	// Prepare external data
	externalData := map[string]interface{}{
		"history_id":    msg.HistoryId,
		"label_ids":     msg.LabelIds,
		"size_estimate": msg.SizeEstimate,
	}

	externalDataStr, err := json.Marshal(externalData)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to marshal external data: %w", err)
	}

	mailMessage := &models.MailMessage{
		User:         mailSync.User,
		MailSync:     mailSync.Id,
		MessageId:    msg.Id,
		ThreadId:     msg.ThreadId,
		From:         from,
		To:           to,
		Subject:      subject,
		Snippet:      msg.Snippet,
		Body:         body,
		IsUnread:     flags.isUnread,
		IsImportant:  flags.isImportant,
		IsStarred:    flags.isStarred,
		IsSpam:       flags.isSpam,
		IsInbox:      flags.isInbox,
		IsTrash:      flags.isTrash,
		IsDraft:      flags.isDraft,
		IsSent:       flags.isSent,
		InternalDate: internalDate,
		ReceivedDate: receivedDate,
		ExternalData: string(externalDataStr),
	}

	upsertFilter := map[string]interface{}{
		"message_id": msg.Id,
	}

	if err := query.UpsertRecord[*models.MailMessage](mailMessage, upsertFilter); err != nil {
		return time.Time{}, fmt.Errorf("failed to upsert message %s: %w", messageId, err)
	}

	return msgInternalDate, nil
}

// messageFlags holds the boolean flags for a message
type messageFlags struct {
	isUnread    bool
	isImportant bool
	isStarred   bool
	isSpam      bool
	isInbox     bool
	isTrash     bool
	isDraft     bool
	isSent      bool
}

// processLabels extracts label information from Gmail label IDs
func (ms *MailService) processLabels(labelIds []string) messageFlags {
	flags := messageFlags{}

	for _, labelId := range labelIds {
		switch labelId {
		case labelUNREAD:
			flags.isUnread = true
		case labelIMPORTANT:
			flags.isImportant = true
		case labelSTARRED:
			flags.isStarred = true
		case labelSPAM:
			flags.isSpam = true
		case labelINBOX:
			flags.isInbox = true
		case labelTRASH:
			flags.isTrash = true
		case labelDRAFT:
			flags.isDraft = true
		case labelSENT:
			flags.isSent = true
		}
	}

	return flags
}

// incrementalSync performs an incremental synchronization using Gmail history API
func (ms *MailService) incrementalSync(ctx context.Context, srv *gmail.Service, mailSync *models.MailSync, stats *SyncStats) error {
	historyId, err := strconv.ParseUint(mailSync.LastSyncState, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid history ID %s: %w", mailSync.LastSyncState, err)
	}

	req := srv.Users.History.List("me").StartHistoryId(historyId)
	var processedMsgIds = make(map[string]bool)
	pageToken := ""

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("context cancelled during incremental sync")
		default:
		}

		if pageToken != "" {
			req.PageToken(pageToken)
		}

		resp, err := req.Do()
		if err != nil {
			// Check for specific Gmail API errors
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "historyidnotfound") || strings.Contains(errMsg, "history id not found") {
				logger.LogWarning(fmt.Sprintf("History ID %d is too old or not found, falling back to full sync", historyId))
				return fmt.Errorf("history ID expired or not found: %w", err)
			}
			// Check for rate limiting (429)
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "rate limit") || strings.Contains(errMsg, "quota exceeded") {
				logger.LogWarning("Gmail API rate limit hit during incremental sync")
				return fmt.Errorf("rate limit exceeded: %w", err)
			}
			return fmt.Errorf("failed to get history: %w", err)
		}

		// Process added messages
		for _, history := range resp.History {
			for _, added := range history.MessagesAdded {
				if !processedMsgIds[added.Message.Id] {
					_, err := ms.processMessage(ctx, srv, added.Message.Id, mailSync)
					if err != nil {
						stats.MessagesFailed++
						logger.LogError(fmt.Sprintf("Error processing added message %s", added.Message.Id), err)
					} else {
						stats.MessagesProcessed++
					}
					processedMsgIds[added.Message.Id] = true
				}
			}

			// Process label changes
			for _, labelChanged := range history.LabelsAdded {
				if !processedMsgIds[labelChanged.Message.Id] {
					_, err := ms.processMessage(ctx, srv, labelChanged.Message.Id, mailSync)
					if err != nil {
						stats.MessagesFailed++
						logger.LogError(fmt.Sprintf("Error processing label change for message %s", labelChanged.Message.Id), err)
					} else {
						stats.MessagesProcessed++
					}
					processedMsgIds[labelChanged.Message.Id] = true
				}
			}
		}

		pageToken = resp.NextPageToken
		if pageToken == "" {
			break
		}
	}

	// Update sync state - try to get from profile, fallback to recovery from messages
	profile, err := srv.Users.GetProfile("me").Do()
	var historyIdStr string
	if err != nil {
		logger.LogWarning(fmt.Sprintf("Failed to get profile for mail sync %s, attempting recovery from messages", mailSync.Id))
		// Try to recover from latest message
		recoveredHistoryId, recoverErr := ms.RecoverLastSyncStateFromMessages(mailSync.Id)
		if recoverErr != nil {
			logger.LogError(fmt.Sprintf("Failed to recover last_sync_state for mail sync %s", mailSync.Id), recoverErr)
			return fmt.Errorf("failed to get profile and failed to recover: %w", err)
		}
		historyIdStr = recoveredHistoryId
	} else {
		historyIdStr = strconv.FormatUint(profile.HistoryId, 10)
	}

	updateData := map[string]interface{}{
		"last_sync_state": historyIdStr,
		"last_synced":     types.NowDateTime(),
	}

	if err := query.UpdateRecord[*models.MailSync](mailSync.Id, updateData); err != nil {
		return fmt.Errorf("failed to update sync state: %w", err)
	}

	return nil
}

// extractMessageBody extracts the message body from a Gmail message part
// Prefers HTML over plain text
func (ms *MailService) extractMessageBody(payload *gmail.MessagePart) string {
	if payload == nil {
		return ""
	}

	// Check if this part has body data
	if payload.Body != nil && payload.Body.Data != "" {
		data, err := base64.URLEncoding.DecodeString(payload.Body.Data)
		if err != nil {
			logger.LogError(fmt.Sprintf("Failed to decode message body: %v", err), nil)
			return ""
		}
		return string(data)
	}

	// Recursively check parts
	if len(payload.Parts) > 0 {
		var htmlPart, plainPart string
		for _, part := range payload.Parts {
			switch part.MimeType {
			case "text/html":
				htmlPart = ms.extractMessageBody(part)
			case "text/plain":
				plainPart = ms.extractMessageBody(part)
			}
		}
		// Prefer HTML over plain text
		if htmlPart != "" {
			return htmlPart
		}
		return plainPart
	}

	return ""
}

// extractEmailAddresses extracts From and To addresses from message headers
func (ms *MailService) extractEmailAddresses(headers []*gmail.MessagePartHeader) (string, string) {
	var from, to string
	for _, header := range headers {
		if header == nil {
			continue
		}
		switch header.Name {
		case "From":
			from = header.Value
		case "To":
			to = header.Value
		}
	}
	return from, to
}

// extractHeader extracts a specific header value from message headers
func (ms *MailService) extractHeader(headers []*gmail.MessagePartHeader, name string) string {
	if name == "" {
		return ""
	}

	for _, header := range headers {
		if header != nil && header.Name == name {
			return header.Value
		}
	}
	return ""
}

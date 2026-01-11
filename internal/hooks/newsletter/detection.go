package newsletter

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/services/newsletter"
)

func RegisterNewsletterHooks(pb *pocketbase.PocketBase, newsletterService *newsletter.Service) {
	pb.OnRecordCreate("mail_messages").BindFunc(func(e *core.RecordEvent) error {
		return processMailForNewsletter(e, newsletterService)
	})

	pb.OnRecordCreate("newsletter_settings").BindFunc(func(e *core.RecordEvent) error {
		if e.Record.GetBool("is_enabled") {
			userId := e.Record.GetString("user")
			go newsletterService.ScanExistingMessages(userId)
		}
		return e.Next()
	})

	pb.OnRecordUpdate("newsletter_settings").BindFunc(func(e *core.RecordEvent) error {
		// Only trigger if is_enabled changed from false to true
		if e.Record.GetBool("is_enabled") && e.Record.GetString("scan_status") != "scanning" && e.Record.GetString("scan_status") != "completed" {
			userId := e.Record.GetString("user")
			go newsletterService.ScanExistingMessages(userId)
		}
		return e.Next()
	})
}

func processMailForNewsletter(e *core.RecordEvent, newsletterService *newsletter.Service) error {
	userId := e.Record.GetString("user")
	if userId == "" {
		return e.Next()
	}

	// Map Record to MailMessage model
	mailMessage := &models.MailMessage{}
	mailMessage.Id = e.Record.Id
	mailMessage.User = userId
	mailMessage.MailSync = e.Record.GetString("mail_sync")
	mailMessage.MessageId = e.Record.GetString("message_id")
	mailMessage.ThreadId = e.Record.GetString("thread_id")
	mailMessage.From = e.Record.GetString("from")
	mailMessage.To = e.Record.GetString("to")
	mailMessage.Subject = e.Record.GetString("subject")
	mailMessage.Snippet = e.Record.GetString("snippet")
	mailMessage.Body = e.Record.GetString("body")
	mailMessage.IsUnread = e.Record.GetBool("is_unread")
	mailMessage.IsImportant = e.Record.GetBool("is_important")
	mailMessage.IsStarred = e.Record.GetBool("is_starred")
	mailMessage.IsSpam = e.Record.GetBool("is_spam")
	mailMessage.IsInbox = e.Record.GetBool("is_inbox")
	mailMessage.IsTrash = e.Record.GetBool("is_trash")
	mailMessage.IsDraft = e.Record.GetBool("is_draft")
	mailMessage.IsSent = e.Record.GetBool("is_sent")
	mailMessage.InternalDate = e.Record.GetDateTime("internal_date")
	mailMessage.ReceivedDate = e.Record.GetDateTime("received_date")
	mailMessage.ExternalData = e.Record.GetString("external_data")

	// Process in a separate goroutine to not block the sync process
	go func(m *models.MailMessage) {
		if err := newsletterService.ProcessMailMessage(m.User, m); err != nil {
			logger.LogError("Failed to process newsletter for email "+m.Id, err)
		}
	}(mailMessage)

	return e.Next()
}

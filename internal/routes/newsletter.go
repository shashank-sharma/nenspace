package routes

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/services/newsletter"
	"github.com/shashank-sharma/backend/internal/util"
)

func RegisterNewsletterRoutes(g *router.RouterGroup[*core.RequestEvent], newsletterService *newsletter.Service) {
	g.POST("/scan", func(e *core.RequestEvent) error {
		return handleManualScan(newsletterService, e)
	})

	g.GET("/status", func(e *core.RequestEvent) error {
		return handleGetScanStatus(newsletterService, e)
	})
}

func handleManualScan(s *newsletter.Service, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	settings, err := s.GetSettings(userId)
	if err != nil {
		return util.RespondError(e, util.ErrNotFound)
	}

	if settings.ScanStatus == "scanning" {
		return util.RespondError(e, util.NewBadRequestError("Scan already in progress"))
	}

	// Start scan in background
	go s.ScanExistingMessages(userId)

	return e.JSON(http.StatusOK, map[string]string{
		"message": "Newsletter scan started",
	})
}

func handleGetScanStatus(s *newsletter.Service, e *core.RequestEvent) error {
	userId, ok := e.Get("userId").(string)
	if !ok || userId == "" {
		return util.RespondError(e, util.ErrUnauthorized)
	}

	settings, err := s.GetSettings(userId)
	if err != nil {
		return util.RespondError(e, util.ErrNotFound)
	}

	return e.JSON(http.StatusOK, settings)
}

func ResetStaleNewsletterScans(s *newsletter.Service) error {
	return newsletter.ResetStaleNewsletterScans(s)
}

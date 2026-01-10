package routes

import (
	"fmt"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/services/filemanager"
	"github.com/shashank-sharma/backend/internal/util"
)

func RegisterFileManagerRoutes(apiRouter *router.RouterGroup[*core.RequestEvent]) {
	apiRouter.GET("/custom/files/download-zip", DownloadZipHandler())
}

func DownloadZipHandler() func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		if token == "" {
			token = e.Request.URL.Query().Get("token")
		}

		if token == "" {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		userId, err := util.GetUserId(token)
		if err != nil {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		folderIdsStr := e.Request.URL.Query().Get("folderIds")
		fileIdsStr := e.Request.URL.Query().Get("fileIds")

		var folderIds []string
		if folderIdsStr != "" {
			folderIds = strings.Split(folderIdsStr, ",")
		}

		var fileIds []string
		if fileIdsStr != "" {
			fileIds = strings.Split(fileIdsStr, ",")
		}

		if len(folderIds) == 0 && len(fileIds) == 0 {
			return util.RespondError(e, util.NewBadRequestError("No folders or files selected for download"))
		}

		e.Response.Header().Set("Content-Type", "application/zip")
		e.Response.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"download-%s.zip\"", util.GenerateRandomId()[:8]))
		e.Response.Header().Set("Cache-Control", "no-cache")
		e.Response.Header().Set("Connection", "keep-alive")

		if err := filemanager.StreamSelectionAsZip(userId, folderIds, fileIds, e.Response); err != nil {
			return err
		}

		return nil
	}
}

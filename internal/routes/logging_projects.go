package routes

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/util"
)

func RegisterLoggingProjectRoutes(e *core.ServeEvent) {
	e.Router.POST("/api/logging/projects", CreateLoggingProject)
}

type CreateProjectRequest struct {
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	Retention int    `json:"retention"`
}

func CreateLoggingProject(e *core.RequestEvent) error {

	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusUnauthorized, map[string]interface{}{
			"error": "Authentication required",
		})
	}

	var req CreateProjectRequest
	if err := e.BindBody(&req); err != nil {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
	}

	if req.Name == "" || req.Slug == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "Name and Slug are required",
		})
	}

	var plaintextToken string
	var project *models.LoggingProject

	err = query.RunInTransaction(func(txApp core.App) error {

		var err error
		plaintextToken, err = util.GenerateSecureToken("dev")
		if err != nil {
			return err
		}

		devToken := &models.DevToken{
			User:        userId,
			Token:       plaintextToken,
			Name:        "Logging: " + req.Name,
			Environment: "production",
			IsActive:    true,
		}
		if err := query.SaveRecordWithApp(txApp, devToken); err != nil {
			return err
		}

		project = &models.LoggingProject{
			Name:      req.Name,
			Slug:      req.Slug,
			Retention: req.Retention,
			Active:    true,
			DevToken:  devToken.Id,
		}
		if err := query.SaveRecordWithApp(txApp, project); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to create logging project: " + err.Error(),
		})
	}

	return e.JSON(http.StatusCreated, map[string]interface{}{
		"project": project,
		"token":   plaintextToken,
	})
}

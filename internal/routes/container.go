package routes

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/container"
	"github.com/shashank-sharma/backend/internal/util"
)

// ErrorAccessDenied is returned when a user doesn't have access to a resource
var ErrorAccessDenied = fmt.Errorf("access denied")

func RegisterContainerRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, containerService *container.ContainerService) {

	containerRouter := apiRouter.Group(path)
	// Container routes
	containerRouter.GET("", ListContainersHandler(containerService))
	containerRouter.GET("/{id}", GetContainerHandler(containerService))
	containerRouter.POST("", CreateContainerHandler(containerService))
	containerRouter.POST("/{id}/start", StartContainerHandler(containerService))
	containerRouter.POST("/{id}/stop", StopContainerHandler(containerService))
	containerRouter.POST("/{id}/pause", PauseContainerHandler(containerService))
	containerRouter.POST("/{id}/resume", ResumeContainerHandler(containerService))
	containerRouter.DELETE("/{id}", DeleteContainerHandler(containerService))
	containerRouter.GET("/{id}/logs", GetContainerLogsHandler(containerService))
	containerRouter.GET("/{id}/stats", GetContainerStatsHandler(containerService))

	// Container image routes
	containerRouter.GET("/images", ListImagesHandler(containerService))
	containerRouter.POST("/images", CreateImageHandler(containerService))
	containerRouter.DELETE("/images/{id}", DeleteImageHandler(containerService))
	containerRouter.POST("/images/{id}/build", BuildImageHandler(containerService))
	containerRouter.POST("/images/{id}/pull", PullImageHandler(containerService))

	logger.LogInfo("Container routes registered")

}

// ListContainersHandler returns all containers for the current user
func ListContainersHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		includePublic := e.Request.URL.Query().Get("include_public") == "true"

		containers, err := containerService.ListContainers(userId, includePublic)
		logger.LogInfo("Containers: %v", containers)
		if err != nil {
			logger.LogError("Failed to list containers: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to list containers",
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"containers": containers,
		})
	}
}

// GetContainerHandler returns details for a specific container
func GetContainerHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := e.Get("userId").(string)
		if !ok || userId == "" {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		containerId := e.Request.PathValue("id")
		if containerId == "" {
			return util.RespondError(e, util.NewBadRequestError("Container ID is required"))
		}

		container, err := getContainerDetails(containerService, containerId, userId)
		if err != nil {
			logger.LogError("Failed to get container details", "error", err, "containerId", containerId)
			return util.RespondWithError(e, util.ErrInternalServer, err)
		}

		return util.RespondSuccess(e, http.StatusOK, container)
	}
}

// CreateContainerHandler creates a new container
func CreateContainerHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		userId, ok := e.Get("userId").(string)
		if !ok || userId == "" {
			return util.RespondError(e, util.ErrUnauthorized)
		}

		var request container.ContainerCreateRequest
		if err := e.BindBody(&request); err != nil {
			logger.LogError("Failed to parse request body", "error", err)
			return util.RespondError(e, util.NewBadRequestError("Invalid request body"))
		}

		logger.LogInfo("Creating container", "userId", userId)
		newContainer, err := containerService.CreateContainer(userId, request)
		if err != nil {
			logger.LogError("Failed to create container", "error", err, "userId", userId)
			return util.RespondWithError(e, util.ErrInternalServer, err)
		}

		return util.RespondSuccess(e, http.StatusCreated, newContainer)
	}
}

// StartContainerHandler starts a container
func StartContainerHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		containerId := e.Request.PathValue("id")
		if containerId == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Container ID is required",
			})
		}

		if err := verifyContainerAccess(containerService, containerId, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied",
			})
		}

		err = containerService.StartContainer(containerId)
		if err != nil {
			logger.LogError("Failed to start container: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to start container: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"message": "Container started successfully",
		})
	}
}

// StopContainerHandler stops a container
func StopContainerHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		containerId := e.Request.PathValue("id")
		if containerId == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Container ID is required",
			})
		}

		if err := verifyContainerAccess(containerService, containerId, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied",
			})
		}

		err = containerService.StopContainer(containerId)
		if err != nil {
			logger.LogError("Failed to stop container: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to stop container: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"message": "Container stopped successfully",
		})
	}
}

// PauseContainerHandler pauses a container
func PauseContainerHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		containerId := e.Request.PathValue("id")
		if containerId == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Container ID is required",
			})
		}

		if err := verifyContainerAccess(containerService, containerId, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied",
			})
		}

		err = containerService.PauseContainer(containerId)
		if err != nil {
			logger.LogError("Failed to pause container: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to pause container: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"message": "Container paused successfully",
		})
	}
}

// ResumeContainerHandler resumes a paused container
func ResumeContainerHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		containerId := e.Request.PathValue("id")
		if containerId == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Container ID is required",
			})
		}

		if err := verifyContainerAccess(containerService, containerId, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied",
			})
		}

		err = containerService.ResumeContainer(containerId)
		if err != nil {
			logger.LogError("Failed to resume container: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to resume container: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"message": "Container resumed successfully",
		})
	}
}

// DeleteContainerHandler deletes a container
func DeleteContainerHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		containerId := e.Request.PathValue("id")
		if containerId == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Container ID is required",
			})
		}

		if err := verifyContainerAccess(containerService, containerId, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied",
			})
		}

		err = containerService.DeleteContainer(containerId)
		if err != nil {
			logger.LogError("Failed to delete container: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to delete container: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"message": "Container deleted successfully",
		})
	}
}

// GetContainerLogsHandler gets logs for a container
func GetContainerLogsHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		containerId := e.Request.PathValue("id")
		if containerId == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Container ID is required",
			})
		}

		if err := verifyContainerAccess(containerService, containerId, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied",
			})
		}

		limitStr := e.Request.URL.Query().Get("limit")
		limit := 100
		if limitStr != "" {
			parsed, err := strconv.Atoi(limitStr)
			if err == nil && parsed > 0 {
				limit = parsed
			}
		}

		logs, err := containerService.GetContainerLogs(containerId, limit)
		if err != nil {
			logger.LogError("Failed to get container logs: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to get container logs",
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"logs": logs,
		})
	}
}

// GetContainerStatsHandler gets stats for a container
func GetContainerStatsHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		containerId := e.Request.PathValue("id")
		if containerId == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Container ID is required",
			})
		}

		if err := verifyContainerAccess(containerService, containerId, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied",
			})
		}

		limitStr := e.Request.URL.Query().Get("limit")
		limit := 60
		if limitStr != "" {
			parsed, err := strconv.Atoi(limitStr)
			if err == nil && parsed > 0 {
				limit = parsed
			}
		}

		stats, err := containerService.GetContainerStats(containerId, limit)
		if err != nil {
			logger.LogError("Failed to get container stats: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to get container stats",
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"stats": stats,
		})
	}
}

// ListImagesHandler returns all container images for the current user
func ListImagesHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		includePublic := e.Request.URL.Query().Get("include_public") == "true"

		images, err := containerService.ListImages(userId, includePublic)
		if err != nil {
			logger.LogError("Failed to list images: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to list images",
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"images": images,
		})
	}
}

// CreateImageHandler creates a new container image
func CreateImageHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		logger.LogInfo("Creating image")
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		logger.LogInfo("Parsing request body")
		var request container.ImageCreateRequest
		if err := e.BindBody(&request); err != nil {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Invalid request",
			})
		}

		logger.LogInfo("Creating image: ", containerService)
		newImage, err := containerService.CreateImage(userId, request)
		if err != nil {
			logger.LogError("Failed to create image: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to create image: " + err.Error(),
			})
		}

		return e.JSON(http.StatusCreated, newImage)
	}
}

// DeleteImageHandler deletes a container image
func DeleteImageHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		imageId := e.Request.PathValue("id")
		if imageId == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Image ID is required",
			})
		}

		if err := verifyImageAccess(containerService, imageId, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied",
			})
		}

		err = containerService.DeleteImage(imageId)
		if err != nil {
			logger.LogError("Failed to delete image: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to delete image: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"message": "Image deleted successfully",
		})
	}
}

// Helper functions

// getContainerDetails gets detailed information for a container
func getContainerDetails(containerService *container.ContainerService, containerId, userId string) (map[string]interface{}, error) {
	containers, err := containerService.ListContainers(userId, true)
	if err != nil {
		return nil, err
	}

	var container interface{}
	for _, c := range containers {
		if c.Id == containerId {
			container = c
			break
		}
	}

	if container == nil {
		return nil, err
	}

	logs, err := containerService.GetContainerLogs(containerId, 10)
	if err != nil {
		logs = nil
	}

	stats, err := containerService.GetContainerStats(containerId, 10)
	if err != nil {
		stats = nil
	}

	return map[string]interface{}{
		"container": container,
		"logs":      logs,
		"stats":     stats,
	}, nil
}

// verifyContainerAccess checks if a user has access to a container
func verifyContainerAccess(containerService *container.ContainerService, containerId, userId string) error {
	containers, err := containerService.ListContainers(userId, true)
	if err != nil {
		return err
	}

	for _, container := range containers {
		if container.Id == containerId {
			if container.User == userId || container.IsPublic {
				return nil
			}
			break
		}
	}

	return ErrorAccessDenied
}

// verifyImageAccess checks if a user has access to an image
func verifyImageAccess(containerService *container.ContainerService, imageId, userId string) error {
	images, err := containerService.ListImages(userId, true)
	if err != nil {
		return err
	}

	for _, image := range images {
		if image.Id == imageId {
			if image.User == userId || image.IsPublic {
				return nil
			}
			break
		}
	}

	return ErrorAccessDenied
}

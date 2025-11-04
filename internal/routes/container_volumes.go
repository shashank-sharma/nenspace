package routes

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/container"
	"github.com/shashank-sharma/backend/internal/util"
)

// ListVolumesHandler returns all volumes for the current user
func ListVolumesHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		includePublic := e.Request.URL.Query().Get("include_public") == "true"
		volumes, err := containerService.ListVolumes(userId, includePublic)
		if err != nil {
			logger.LogError("Failed to list volumes: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to list volumes: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"volumes": volumes,
		})
	}
}

// GetVolumeHandler returns details for a specific volume
func GetVolumeHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		volumeId := e.Request.PathValue("id")
		if volumeId == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Volume ID is required",
			})
		}

		if err := verifyVolumeAccess(containerService, volumeId, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied",
			})
		}

		volume, err := containerService.GetVolume(volumeId)
		if err != nil {
			logger.LogError("Failed to get volume: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to get volume: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, volume)
	}
}

// CreateVolumeHandler creates a new volume
func CreateVolumeHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		var request container.VolumeCreateOptions
		if err := e.BindBody(&request); err != nil {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Invalid request",
			})
		}

		volume, err := containerService.CreateVolume(userId, &request)
		if err != nil {
			logger.LogError("Failed to create volume: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to create volume: " + err.Error(),
			})
		}

		return e.JSON(http.StatusCreated, volume)
	}
}

// DeleteVolumeHandler deletes a volume
func DeleteVolumeHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		volumeId := e.Request.PathValue("id")
		if volumeId == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Volume ID is required",
			})
		}

		if err := verifyVolumeAccess(containerService, volumeId, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied",
			})
		}

		if err := containerService.RemoveVolume(volumeId); err != nil {
			logger.LogError("Failed to delete volume: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to delete volume: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"message": "Volume deleted successfully",
		})
	}
}

// MountVolumeHandler mounts a volume to a container
func MountVolumeHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		var request struct {
			VolumeID    string `json:"volume_id"`
			ContainerID string `json:"container_id"`
			Destination string `json:"destination"`
			ReadOnly    bool   `json:"readonly"`
		}

		if err := e.BindBody(&request); err != nil {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Invalid request",
			})
		}

		if err := verifyVolumeAccess(containerService, request.VolumeID, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied to volume",
			})
		}

		if err := verifyContainerAccess(containerService, request.ContainerID, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied to container",
			})
		}

		if err := containerService.MountVolume(request.VolumeID, request.ContainerID, request.Destination, request.ReadOnly); err != nil {
			logger.LogError("Failed to mount volume: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to mount volume: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"message": "Volume mounted successfully",
		})
	}
}

// UnmountVolumeHandler unmounts a volume from a container
func UnmountVolumeHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		var request struct {
			VolumeID    string `json:"volume_id"`
			ContainerID string `json:"container_id"`
		}

		if err := e.BindBody(&request); err != nil {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Invalid request",
			})
		}

		if err := verifyVolumeAccess(containerService, request.VolumeID, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied to volume",
			})
		}

		if err := verifyContainerAccess(containerService, request.ContainerID, userId); err != nil {
			return e.JSON(http.StatusForbidden, map[string]interface{}{
				"error": "Access denied to container",
			})
		}

		if err := containerService.UnmountVolume(request.VolumeID, request.ContainerID); err != nil {
			logger.LogError("Failed to unmount volume: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to unmount volume: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{
			"message": "Volume unmounted successfully",
		})
	}
}

// GetContainerHealthHandler gets health status of a container
func GetContainerHealthHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
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

		health, err := containerService.GetContainerHealth(containerId)
		if err != nil {
			logger.LogError("Failed to get container health: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to get container health: " + err.Error(),
			})
		}

		return e.JSON(http.StatusOK, health)
	}
}

// BuildImageHandler builds a container image
func BuildImageHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
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

		go func() {
			if err := containerService.BuildImage(imageId); err != nil {
				logger.LogError("Failed to build image: %v", err)
			}
		}()

		return e.JSON(http.StatusOK, map[string]interface{}{
			"message": "Image build started",
		})
	}
}

// PullImageHandler pulls a container image
func PullImageHandler(containerService *container.ContainerService) func(e *core.RequestEvent) error {
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

		var request struct {
			PullOptions map[string]string `json:"pull_options"`
		}

		if err := e.BindBody(&request); err != nil {
			request.PullOptions = map[string]string{}
		}

		go func() {
			if err := containerService.PullImage(imageId, request.PullOptions); err != nil {
				logger.LogError("Failed to pull image: %v", err)
			}
		}()

		return e.JSON(http.StatusOK, map[string]interface{}{
			"message": "Image pull started",
		})
	}
}

// Helper function to verify volume access
func verifyVolumeAccess(containerService *container.ContainerService, volumeId, userId string) error {
	volumes, err := containerService.ListVolumes(userId, true)
	if err != nil {
		return err
	}

	for _, volume := range volumes {
		if volume.Id == volumeId {
			if volume.User == userId || volume.IsPublic {
				return nil
			}
			break
		}
	}

	return ErrorAccessDenied
}

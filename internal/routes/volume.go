package routes

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/container"
)

// RegisterVolumeRoutes registers all volume-related routes
func RegisterVolumeRoutes(volumeRouter *router.RouterGroup[*core.RequestEvent], containerService *container.ContainerService) {
	// Volume routes
	volumeRouter.GET("/list", ListVolumesHandler(containerService))
	volumeRouter.GET("/{id}", GetVolumeHandler(containerService))
	volumeRouter.POST("/", CreateVolumeHandler(containerService))
	volumeRouter.DELETE("/{id}", DeleteVolumeHandler(containerService))
	volumeRouter.POST("/mount", MountVolumeHandler(containerService))
	volumeRouter.POST("/unmount", UnmountVolumeHandler(containerService))

	logger.LogInfo("Volume routes registered")
}


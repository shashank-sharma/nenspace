package container

import (
	"context"
	"fmt"
	"time"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

// InitializeFull performs complete initialization of all container subsystems
func (cs *ContainerService) InitializeFull() error {
	healthMonitor := NewHealthMonitor(cs, 30*time.Second)
	cs.healthMonitor = healthMonitor
	healthMonitor.Start()
	
	imageBuilder, err := NewImageBuilder(cs)
	if err != nil {
		logger.LogWarning("Failed to initialize image builder: %v, image building may be limited", err)
	} else {
		cs.imageBuilder = imageBuilder
	}
	
	// Initialize network manager if networking is enabled
	if cs.config.EnableNetworking {
		networkManager, err := NewNetworkManager(cs, cs.config.NetworkBridge, "172.30.0.0/16")
		if err != nil {
			logger.LogWarning("Failed to initialize network manager: %v, networking will be disabled", err)
		} else {
			cs.networkManager = networkManager
			
			if err := networkManager.SetupBridge(); err != nil {
				logger.LogWarning("Failed to setup bridge network: %v", err)
			}
		}
	}
	
	// Initialize volume manager
	volumeManager, err := NewVolumeManager(cs)
	if err != nil {
		logger.LogWarning("Failed to initialize volume manager: %v, volume management will be disabled", err)
	} else {
		cs.volumeManager = volumeManager
		if err := volumeManager.Initialize(); err != nil {
			logger.LogWarning("Failed to initialize volumes: %v", err)
		}
	}
	
	if cs.config.EnableAutostart {
		if err := cs.startAutostartContainers(); err != nil {
			logger.LogError("Failed to start autostart containers: %v", err)
		}
	}
	
	if cs.config.StatsInterval > 0 {
		go cs.collectStats()
	}
	
	logger.LogInfo("Container service fully initialized")
	return nil
}

// BuildImage builds a container image
func (cs *ContainerService) BuildImage(imageId string) error {
	if cs.imageBuilder == nil {
		return ErrImageBuilderNotAvailable
	}
	
	image, err := query.FindById[*models.ContainerImage](imageId)
	if err != nil {
		return err
	}
	
	return cs.imageBuilder.BuildImage(image)
}

// PullImage pulls a container image from a registry
func (cs *ContainerService) PullImage(imageId string, pullOptions map[string]string) error {
	if cs.imageBuilder == nil {
		return ErrImageBuilderNotAvailable
	}
	image, err := query.FindById[*models.ContainerImage](imageId)
	if err != nil {
		return err
	}
	
	return cs.imageBuilder.ImportImage(image, pullOptions)
}

// CreateVolume creates a new volume
func (cs *ContainerService) CreateVolume(userId string, options *VolumeCreateOptions) (*models.ContainerVolume, error) {
	if cs.volumeManager == nil {
		return nil, ErrVolumeManagerNotAvailable
	}
	
	return cs.volumeManager.CreateVolume(userId, options)
}

// RemoveVolume removes a volume
func (cs *ContainerService) RemoveVolume(volumeId string) error {
	if cs.volumeManager == nil {
		return ErrVolumeManagerNotAvailable
	}
	
	return cs.volumeManager.RemoveVolume(volumeId)
}

// GetVolume gets a volume
func (cs *ContainerService) GetVolume(volumeId string) (*models.ContainerVolume, error) {
	if cs.volumeManager == nil {
		return nil, ErrVolumeManagerNotAvailable
	}
	
	return cs.volumeManager.GetVolume(volumeId)
}

// ListVolumes lists volumes for a user
func (cs *ContainerService) ListVolumes(userId string, includePublic bool) ([]*models.ContainerVolume, error) {
	if cs.volumeManager == nil {
		return nil, ErrVolumeManagerNotAvailable
	}
	
	return cs.volumeManager.ListVolumes(userId, includePublic)
}

// ShutdownAll shuts down all containers and cleans up resources
func (cs *ContainerService) ShutdownAll(ctx context.Context) error {
	logger.LogInfo("Shutting down all container subsystems...")
	
	if cs.healthMonitor != nil {
		cs.healthMonitor.Stop()
	}
	
	if err := cs.Shutdown(ctx); err != nil {
		logger.LogError("Error shutting down containers: %v", err)
	}
	
	if cs.networkManager != nil {
		if err := cs.networkManager.CleanupBridge(); err != nil {
			logger.LogError("Error cleaning up network bridge: %v", err)
		}
	}
	
	logger.LogInfo("Container service shutdown complete")
	return nil
}

// GetContainerHealth gets the health status of a container
func (cs *ContainerService) GetContainerHealth(containerID string) (*ContainerHealth, error) {
	if cs.healthMonitor == nil {
		return nil, ErrHealthMonitorNotAvailable
	}
	
	return cs.healthMonitor.checkContainerHealth(containerID)
}

// RegisterContainer registers a container with the health monitor
func (cs *ContainerService) RegisterContainerWithHealthMonitor(containerID string, restartPolicy string, maxRetries int) error {
	if cs.healthMonitor == nil {
		return ErrHealthMonitorNotAvailable
	}
	
	cs.healthMonitor.RegisterContainer(containerID, restartPolicy, maxRetries)
	return nil
}

// SetContainerNetworking sets up networking for a container
func (cs *ContainerService) SetupContainerNetworking(containerID string) (string, error) {
	if cs.networkManager == nil {
		return "", ErrNetworkManagerNotAvailable
	}
	
	return cs.networkManager.ConnectContainer(containerID)
}

// CleanupContainerNetworking cleans up networking for a container
func (cs *ContainerService) CleanupContainerNetworking(containerID string) error {
	if cs.networkManager == nil {
		return ErrNetworkManagerNotAvailable
	}
	
	return cs.networkManager.DisconnectContainer(containerID)
}

// MountVolume mounts a volume to a container
func (cs *ContainerService) MountVolume(volumeId, containerId, destination string, readonly bool) error {
	if cs.volumeManager == nil {
		return ErrVolumeManagerNotAvailable
	}
	
	return cs.volumeManager.MountVolume(volumeId, containerId, destination, readonly)
}

// UnmountVolume unmounts a volume from a container
func (cs *ContainerService) UnmountVolume(volumeId, containerId string) error {
	if cs.volumeManager == nil {
		return ErrVolumeManagerNotAvailable
	}
	
	return cs.volumeManager.UnmountVolume(volumeId, containerId)
}

// Common error types
var (
	ErrImageBuilderNotAvailable   = fmt.Errorf("image builder not available")
	ErrVolumeManagerNotAvailable  = fmt.Errorf("volume manager not available")
	ErrNetworkManagerNotAvailable = fmt.Errorf("network manager not available")
	ErrHealthMonitorNotAvailable  = fmt.Errorf("health monitor not available")
)
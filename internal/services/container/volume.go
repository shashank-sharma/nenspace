package container

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/util"
)

// VolumeManager handles container volumes
type VolumeManager struct {
	service      *ContainerService
	volumesPath  string
	volumesMeta  map[string]*types.JSONRaw // volumeID -> metadata
	mu           sync.Mutex
}

// Volume represents a container volume
type Volume struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Driver      string                 `json:"driver"`
	Path        string                 `json:"path"`
	Size        int64                  `json:"size"`
	CreatedAt   string                 `json:"created_at"`
	Labels      map[string]string      `json:"labels"`
	Options     map[string]string      `json:"options"`
	Mountpoint  string                 `json:"mountpoint"`
	RefCount    int                    `json:"ref_count"`
	MountConfig map[string]interface{} `json:"mount_config"`
}

// NewVolumeManager creates a new volume manager
func NewVolumeManager(service *ContainerService) (*VolumeManager, error) {
	volumesPath := filepath.Join(service.basePath, "volumes")
	if err := os.MkdirAll(volumesPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create volumes directory: %w", err)
	}

	return &VolumeManager{
		service:     service,
		volumesPath: volumesPath,
		volumesMeta: make(map[string]*types.JSONRaw),
	}, nil
}

// Initialize initializes the volume manager
func (vm *VolumeManager) Initialize() error {
	// Load existing volumes
	vm.mu.Lock()
	defer vm.mu.Unlock()

	// Find volume records
	volumes, err := query.FindAllByFilter[*models.ContainerVolume](map[string]interface{}{})
	if err != nil {
		logger.LogWarning("Failed to load volumes: %v", err)
		return nil
	}

	// Load volume metadata
	for _, volume := range volumes {
		vm.volumesMeta[volume.Id] = &volume.Metadata
		
		// Ensure volume directory exists
		volumePath := filepath.Join(vm.volumesPath, volume.Id)
		if err := os.MkdirAll(volumePath, 0755); err != nil {
			logger.LogWarning("Failed to create volume directory for %s: %v", volume.Id, err)
		}
	}

	logger.LogInfo("Loaded %d volumes", len(vm.volumesMeta))
	return nil
}

// CreateVolume creates a new volume
func (vm *VolumeManager) CreateVolume(userId string, createOpts *VolumeCreateOptions) (*models.ContainerVolume, error) {
	vm.mu.Lock()
	defer vm.mu.Unlock()

	// Validate name
	if createOpts.Name == "" {
		return nil, fmt.Errorf("volume name is required")
	}

	// Check for duplicates
	existing, err := query.FindByFilter[*models.ContainerVolume](map[string]interface{}{
		"user": userId,
		"name": createOpts.Name,
	})

	if err == nil && existing != nil {
		return nil, fmt.Errorf("volume with name '%s' already exists", createOpts.Name)
	}

	// Create volume ID
	volumeId := util.GenerateRandomId()
	
	// Create volume directory
	volumePath := filepath.Join(vm.volumesPath, volumeId)
	if err := os.MkdirAll(volumePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create volume directory: %w", err)
	}

	// Set default driver if not specified
	if createOpts.Driver == "" {
		createOpts.Driver = "local"
	}

	// Create metadata
	volume := Volume{
		ID:         volumeId,
		Name:       createOpts.Name,
		Driver:     createOpts.Driver,
		Path:       volumePath,
		CreatedAt:  types.NowDateTime().Time().Format(types.DefaultDateLayout),
		Labels:     createOpts.Labels,
		Options:    createOpts.DriverOpts,
		Mountpoint: volumePath,
		RefCount:   0,
	}

	// Convert to JSON
	metadataJSON, err := json.Marshal(volume)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal volume metadata: %w", err)
	}

	var metadata types.JSONRaw
	if err := metadata.Scan(metadataJSON); err != nil {
		return nil, fmt.Errorf("failed to scan metadata: %w", err)
	}

	// Save the metadata to disk
	metadataPath := filepath.Join(volumePath, "metadata.json")
	if err := os.WriteFile(metadataPath, metadataJSON, 0644); err != nil {
		return nil, fmt.Errorf("failed to write metadata: %w", err)
	}

	// Create volume record
	volumeRecord := &models.ContainerVolume{
		User:        userId,
		Name:        createOpts.Name,
		Driver:      createOpts.Driver,
		Path:        volumePath,
		IsPublic:    createOpts.IsPublic,
		Description: createOpts.Description,
		Metadata:    metadata,
	}

	volumeRecord.Id = volumeId

	// Save the volume record to database
	if err := query.SaveRecord(volumeRecord); err != nil {
		return nil, fmt.Errorf("failed to save volume record: %w", err)
	}

	// Cache the metadata
	vm.volumesMeta[volumeId] = &metadata

	return volumeRecord, nil
}

// RemoveVolume removes a volume
func (vm *VolumeManager) RemoveVolume(volumeId string) error {
	vm.mu.Lock()
	defer vm.mu.Unlock()

	// Get volume
	volume, err := query.FindById[*models.ContainerVolume](volumeId)
	if err != nil {
		return fmt.Errorf("volume not found: %w", err)
	}

	// Check if volume is in use
	var metadata Volume
	if volume.Metadata != nil {
		if err := json.Unmarshal(volume.Metadata, &metadata); err == nil {
			if metadata.RefCount > 0 {
				return fmt.Errorf("volume is in use")
			}
		}
	}

	// Remove volume directory
	if err := os.RemoveAll(volume.Path); err != nil {
		logger.LogWarning("Failed to remove volume directory: %v", err)
	}

	// Remove volume record
	if err := query.DeleteById[*models.ContainerVolume](volumeId); err != nil {
		return fmt.Errorf("failed to delete volume record: %w", err)
	}

	// Remove from cache
	delete(vm.volumesMeta, volumeId)

	return nil
}

// GetVolume gets a volume
func (vm *VolumeManager) GetVolume(volumeId string) (*models.ContainerVolume, error) {
	// Get volume
	volume, err := query.FindById[*models.ContainerVolume](volumeId)
	if err != nil {
		return nil, fmt.Errorf("volume not found: %w", err)
	}

	return volume, nil
}

// ListVolumes lists volumes for a user
func (vm *VolumeManager) ListVolumes(userId string, includePublic bool) ([]*models.ContainerVolume, error) {
	var volumes []*models.ContainerVolume
	var err error

	if includePublic {
		// Get user's volumes and public volumes
		userVolumes, err := query.FindAllByFilter[*models.ContainerVolume](map[string]interface{}{
			"user": userId,
		})
		
		if err != nil {
			return nil, fmt.Errorf("failed to list user volumes: %w", err)
		}
		
		volumes = userVolumes
		
		// Add public volumes from other users
		publicVolumes, pubErr := query.FindAllByFilter[*models.ContainerVolume](map[string]interface{}{
			"is_public": true,
		})
		
		if pubErr == nil {
			for _, volume := range publicVolumes {
				if volume.User != userId {
					volumes = append(volumes, volume)
				}
			}
		}
	} else {
		// Get only user's volumes
		volumes, err = query.FindAllByFilter[*models.ContainerVolume](map[string]interface{}{
			"user": userId,
		})
		
		if err != nil {
			return nil, fmt.Errorf("failed to list user volumes: %w", err)
		}
	}

	return volumes, nil
}

// MountVolume mounts a volume to a container
func (vm *VolumeManager) MountVolume(volumeId, containerId, destination string, readonly bool) error {
	vm.mu.Lock()
	defer vm.mu.Unlock()

	// Get volume
	volume, err := query.FindById[*models.ContainerVolume](volumeId)
	if err != nil {
		return fmt.Errorf("volume not found: %w", err)
	}

	// Get container
	container, err := query.FindById[*models.Container](containerId)
	if err != nil {
		return fmt.Errorf("container not found: %w", err)
	}

	// Update volume metadata
	var metadata Volume
	if volume.Metadata != nil {
		if err := json.Unmarshal(volume.Metadata, &metadata); err != nil {
			return fmt.Errorf("failed to unmarshal volume metadata: %w", err)
		}
	}

	// Increment ref count
	metadata.RefCount++

	// Update mount config
	if metadata.MountConfig == nil {
		metadata.MountConfig = make(map[string]interface{})
	}
	metadata.MountConfig[containerId] = map[string]interface{}{
		"destination": destination,
		"readonly":    readonly,
	}

	// Save metadata
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal volume metadata: %w", err)
	}

	if err := volume.Metadata.Scan(metadataJSON); err != nil {
		return fmt.Errorf("failed to scan metadata: %w", err)
	}

	// Update volume record
	if err := query.SaveRecord(volume); err != nil {
		return fmt.Errorf("failed to update volume record: %w", err)
	}

	// Update volumesMeta cache
	vm.volumesMeta[volumeId] = &volume.Metadata

	// Update container volumes
	var volumes []map[string]interface{}
	if container.Volumes != nil {
		if err := json.Unmarshal(container.Volumes, &volumes); err != nil {
			volumes = make([]map[string]interface{}, 0)
		}
	}

	// Add volume to container
	volumes = append(volumes, map[string]interface{}{
		"volume_id":   volumeId,
		"destination": destination,
		"readonly":    readonly,
	})

	// Save container volumes
	volumesJSON, err := json.Marshal(volumes)
	if err != nil {
		return fmt.Errorf("failed to marshal container volumes: %w", err)
	}

	if err := container.Volumes.Scan(volumesJSON); err != nil {
		return fmt.Errorf("failed to scan container volumes: %w", err)
	}

	// Update container record
	if err := query.SaveRecord(container); err != nil {
		return fmt.Errorf("failed to update container record: %w", err)
	}

	return nil
}

// UnmountVolume unmounts a volume from a container
func (vm *VolumeManager) UnmountVolume(volumeId, containerId string) error {
	vm.mu.Lock()
	defer vm.mu.Unlock()

	// Get volume
	volume, err := query.FindById[*models.ContainerVolume](volumeId)
	if err != nil {
		return fmt.Errorf("volume not found: %w", err)
	}

	// Get container
	container, err := query.FindById[*models.Container](containerId)
	if err != nil {
		return fmt.Errorf("container not found: %w", err)
	}

	// Update volume metadata
	var metadata Volume
	if volume.Metadata != nil {
		if err := json.Unmarshal(volume.Metadata, &metadata); err != nil {
			return fmt.Errorf("failed to unmarshal volume metadata: %w", err)
		}
	}

	// Check if volume is mounted to this container
	if metadata.MountConfig == nil || metadata.MountConfig[containerId] == nil {
		return fmt.Errorf("volume is not mounted to this container")
	}

	// Decrement ref count
	metadata.RefCount--
	if metadata.RefCount < 0 {
		metadata.RefCount = 0
	}

	// Remove mount config
	delete(metadata.MountConfig, containerId)

	// Save metadata
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal volume metadata: %w", err)
	}

	if err := volume.Metadata.Scan(metadataJSON); err != nil {
		return fmt.Errorf("failed to scan metadata: %w", err)
	}

	// Update volume record
	if err := query.SaveRecord(volume); err != nil {
		return fmt.Errorf("failed to update volume record: %w", err)
	}

	// Update volumesMeta cache
	vm.volumesMeta[volumeId] = &volume.Metadata

	// Update container volumes
	var volumes []map[string]interface{}
	if container.Volumes != nil {
		if err := json.Unmarshal(container.Volumes, &volumes); err == nil {
			// Filter out the volume
			newVolumes := make([]map[string]interface{}, 0)
			for _, vol := range volumes {
				if id, ok := vol["volume_id"].(string); !ok || id != volumeId {
					newVolumes = append(newVolumes, vol)
				}
			}
			volumes = newVolumes
		}
	}

	// Save container volumes
	volumesJSON, err := json.Marshal(volumes)
	if err != nil {
		return fmt.Errorf("failed to marshal container volumes: %w", err)
	}

	if err := container.Volumes.Scan(volumesJSON); err != nil {
		return fmt.Errorf("failed to scan container volumes: %w", err)
	}

	// Update container record
	if err := query.SaveRecord(container); err != nil {
		return fmt.Errorf("failed to update container record: %w", err)
	}

	return nil
}

// VolumeCreateOptions contains options for creating a volume
type VolumeCreateOptions struct {
	Name        string            `json:"name"`
	Driver      string            `json:"driver"`
	DriverOpts  map[string]string `json:"driver_opts"`
	Labels      map[string]string `json:"labels"`
	IsPublic    bool              `json:"is_public"`
	Description string            `json:"description"`
}
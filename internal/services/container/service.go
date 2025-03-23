package container

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/util"
)

type ContainerService struct {
	basePath string
	sudoPath string
	criuPath string
	runcPath string
	checkpointPath string
	imagesPath string
	containersPath string
	runcDataPath string
	mu sync.Mutex
	config ContainerConfig
	activeContainers map[string]*containerProcess
	imageBuilder *ImageBuilder
	networkManager *NetworkManager
	volumeManager *VolumeManager
	healthMonitor *HealthMonitor
}

// containerProcess holds information about a running container process
type containerProcess struct {
	containerID string
	cmd         *exec.Cmd
	done        chan struct{}
}

// ContainerConfig holds configuration for container service
type ContainerConfig struct {
	EnableAutostart bool
	StatsInterval int
	MaxLogs int
	DefaultCPUShare int
	DefaultMemoryMB int
	EnableNetworking bool
	NetworkBridge    string
	StoragePath string
	DisablePrivileged bool
}

// OCISpec represents the OCI runtime specification
type OCISpec struct {
	Ociversion string `json:"ociVersion"`
	Process    struct {
		Terminal bool     `json:"terminal"`
		User     User     `json:"user"`
		Args     []string `json:"args"`
		Env      []string `json:"env"`
		Cwd      string   `json:"cwd"`
		Capabilities struct {
			Bounding    []string `json:"bounding"`
			Effective   []string `json:"effective"`
			Inheritable []string `json:"inheritable"`
			Permitted   []string `json:"permitted"`
		} `json:"capabilities"`
		Rlimits []struct {
			Type string `json:"type"`
			Hard uint64 `json:"hard"`
			Soft uint64 `json:"soft"`
		} `json:"rlimits"`
		NoNewPrivileges bool `json:"noNewPrivileges"`
	} `json:"process"`
	Root struct {
		Path     string `json:"path"`
		Readonly bool   `json:"readonly"`
	} `json:"root"`
	Hostname string `json:"hostname"`
	Mounts   []struct {
		Destination string   `json:"destination"`
		Type        string   `json:"type"`
		Source      string   `json:"source"`
		Options     []string `json:"options,omitempty"`
	} `json:"mounts"`
	Linux struct {
		UIDMappings []struct {
			ContainerID uint32 `json:"containerId"`
			HostID      uint32 `json:"hostId"`
			Size        uint32 `json:"size"`
		} `json:"uidMappings"`
		GIDMappings []struct {
			ContainerID uint32 `json:"containerId"`
			HostID      uint32 `json:"hostId"`
			Size        uint32 `json:"size"`
		} `json:"gidMappings"`
		// TODO: Resource complicates things
		// Resources struct {
		// 	Devices []struct {
		// 		Allow  bool   `json:"allow"`
		// 		Type   string `json:"type"`
		// 		Major  int    `json:"major"`
		// 		Minor  int    `json:"minor"`
		// 		Access string `json:"access"`
		// 	} `json:"devices"`
		// 	Memory struct {
		// 		Limit int64 `json:"limit"`
		// 		Swap  int64 `json:"swap"`
		// 	} `json:"memory"`
		// 	CPU struct {
		// 		Shares   int   `json:"shares"`
		// 		Quota    int64 `json:"quota"`
		// 		Period   int64 `json:"period"`
		// 		Cpus     string `json:"cpus"`
		// 		Mems     string `json:"mems"`
		// 		Realtime struct {
		// 			Runtime int64 `json:"runtime"`
		// 			Period  int64 `json:"period"`
		// 		} `json:"realtime"`
		// 	} `json:"cpu"`
		// } `json:"resources"`
		Namespaces []struct {
			Type string `json:"type"`
			Path string `json:"path,omitempty"`
		} `json:"namespaces"`
		MaskedPaths []string `json:"maskedPaths"`
		ReadonlyPaths []string `json:"readonlyPaths"`
	} `json:"linux"`
}

// User defines the user in the process struct
type User struct {
	UID            uint32   `json:"uid"`
	GID            uint32   `json:"gid"`
	AdditionalGids []uint32 `json:"additionalGids,omitempty"`
}

// ContainerResources defines resource allocations for a container
type ContainerResources struct {
	CPUShares int   `json:"cpu_shares"`
	Memory    int64 `json:"memory"`
	MemorySwap int64 `json:"memory_swap"`
	CPUPeriod  int64 `json:"cpu_period"`
	CPUQuota   int64 `json:"cpu_quota"`
	CPUSet     string `json:"cpuset"`
}

// ContainerNetworkConfig defines network configuration for a container
type ContainerNetworkConfig struct {
	Enable    bool     `json:"enable"`
	Bridge    string   `json:"bridge"`
	Ports     []string `json:"ports"` // Format: "host_port:container_port/protocol"
	DNSServers []string `json:"dns_servers"`
	DNSOptions []string `json:"dns_options"`
	DNSSearch  []string `json:"dns_search"`
	ExtraHosts []string `json:"extra_hosts"` // Format: "hostname:IP"
}

// ContainerVolume defines a volume mount for a container
type ContainerVolume struct {
	Source      string `json:"source"`
	Destination string `json:"destination"`
	ReadOnly    bool   `json:"readonly"`
}

// NewContainerService creates a new container service
func NewContainerService(config ContainerConfig) (*ContainerService, error) {
	if config.StoragePath == "" {
		config.StoragePath = "./container_data"
	}

	logger.LogInfo("Creating container service", "config", config)

	basePath := config.StoragePath
	checkpointPath := filepath.Join(basePath, "checkpoints")
	imagesPath := filepath.Join(basePath, "images")
	containersPath := filepath.Join(basePath, "containers")
	runcDataPath := filepath.Join(basePath, "runc-data")

	for _, path := range []string{basePath, checkpointPath, imagesPath, containersPath, runcDataPath} {
		if err := os.MkdirAll(path, 0755); err != nil {
			return nil, fmt.Errorf("failed to create directory %s: %w", path, err)
		}
		logger.LogDebug("Created directory", "path", path)
	}

	runcPath, err := exec.LookPath("runc")
	if err != nil {
		logger.LogWarning("runc not found in PATH, using default '/usr/bin/runc'")
		runcPath = "/usr/bin/runc"
	}

	criuPath, err := exec.LookPath("criu")
	if err != nil {
		logger.LogWarning("criu not found in PATH, using default '/usr/bin/criu'")
		criuPath = "/usr/bin/criu"
	}

	// TODO: Remove sudo
	sudoPath, err := exec.LookPath("sudo")
	if err != nil {
		logger.LogWarning("sudo not found in PATH, using default '/usr/bin/sudo'")
		sudoPath = "/usr/bin/sudo"
	}

	service := &ContainerService{
		basePath:         basePath,
		sudoPath:         sudoPath,
		criuPath:         criuPath,
		runcPath:         runcPath,
		runcDataPath:     runcDataPath,
		checkpointPath:   checkpointPath,
		imagesPath:       imagesPath,
		containersPath:   containersPath,
		config:           config,
		activeContainers: make(map[string]*containerProcess),
	}

	if err := service.verifyRunc(); err != nil {
		return nil, err
	}

	if err := service.verifyCriu(); err != nil {
		logger.LogWarning("CRIU verification failed, container pausing will be unavailable: %v", err)
	}

	return service, nil
}

// Initialize starts the container service
func (cs *ContainerService) Initialize() error {
	if cs.config.StatsInterval > 0 {
		go cs.collectStats()
	}

	if cs.config.EnableAutostart {
		if err := cs.startAutostartContainers(); err != nil {
			logger.LogError("Failed to start autostart containers: %v", err)
		}
	}

	return nil
}

// verifyRunc checks if runc is available and working
func (cs *ContainerService) verifyRunc() error {
	cmd := exec.Command(cs.runcPath, "--version")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("runc verification failed: %w, output: %s", err, output)
	}
	logger.LogInfo("runc verified: %s", strings.TrimSpace(string(output)))
	return nil
}

// verifyCriu checks if criu is available and working
func (cs *ContainerService) verifyCriu() error {
	cmd := exec.Command(cs.sudoPath, cs.criuPath, "check")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("criu verification failed: %w, output: %s", err, output)
	}
	logger.LogInfo("criu verified: %s", strings.TrimSpace(string(output)))
	return nil
}

// startAutostartContainers starts all containers marked for autostart
func (cs *ContainerService) startAutostartContainers() error {
	containers, err := query.FindAllByFilter[*models.Container](map[string]interface{}{
		"is_autostart": true,
		"status": map[string]interface{}{
			"gte": "created",
		},
	})

	if err != nil {
		return fmt.Errorf("failed to fetch autostart containers: %w", err)
	}

	for _, container := range containers {
		logger.LogInfo("Autostarting container: %s (%s)", container.Name, container.Id)
		err := cs.StartContainer(container.Id)
		if err != nil {
			logger.LogError("Failed to autostart container %s: %v", container.Id, err)
		}
	}

	return nil
}

// collectStats periodically collects stats for all running containers
func (cs *ContainerService) collectStats() {
	ticker := time.NewTicker(time.Duration(cs.config.StatsInterval) * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		containers, err := query.FindAllByFilter[*models.Container](map[string]interface{}{
			"status": "running",
		})

		if err != nil {
			logger.LogError("Failed to fetch running containers for stats collection: %v", err)
			continue
		}

		for _, container := range containers {
			if _, exists := cs.activeContainers[container.Id]; !exists {
				cs.updateContainerStatus(container.Id, "exited")
				continue
			}

			stat, err := cs.getContainerStats(container.Id)
			if err != nil {
				logger.LogError("Failed to collect stats for container %s: %v", container.Id, err)
				continue
			}

			if err := query.SaveRecord(stat); err != nil {
				logger.LogError("Failed to save container stats: %v", err)
			}
		}
	}
}

// getContainerStats collects the current stats for a container
func (cs *ContainerService) getContainerStats(containerID string) (*models.ContainerStat, error) {
	// Get container info
	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		return nil, fmt.Errorf("container not found: %w", err)
	}

	stat := &models.ContainerStat{
		User:        container.User,
		ContainerID: containerID,
		Timestamp:   types.NowDateTime(),
	}

	cgroupPath := filepath.Join("/sys/fs/cgroup", "memory", "runc-"+containerID)
	
	memUsageBytes, err := readCgroupFile(filepath.Join(cgroupPath, "memory.usage_in_bytes"))
	if err == nil {
		stat.MemoryUsage = memUsageBytes
	}

	memLimitBytes, err := readCgroupFile(filepath.Join(cgroupPath, "memory.limit_in_bytes"))
	if err == nil {
		stat.MemoryLimit = memLimitBytes
	}

	cpuUsage, err := cs.calculateCPUUsage(containerID)
	if err == nil {
		stat.CPUUsage = cpuUsage
	}

	netStats, err := cs.getNetworkStats(containerID)
	if err == nil {
		stat.NetworkRx = netStats.rx
		stat.NetworkTx = netStats.tx
	}

	blockStats, err := cs.getBlockStats(containerID)
	if err == nil {
		stat.BlockRead = blockStats.read
		stat.BlockWrite = blockStats.write
	}

	pidCount, err := cs.getPidCount(containerID)
	if err == nil {
		stat.PIDCount = pidCount
	}

	return stat, nil
}

type networkStats struct {
	rx int64
	tx int64
}

type blockStats struct {
	read  int64
	write int64
}

// readCgroupFile reads a cgroup file and returns its value as int64
func readCgroupFile(path string) (int64, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(strings.TrimSpace(string(content)), 10, 64)
}

// calculateCPUUsage calculates CPU usage percentage for a container
func (cs *ContainerService) calculateCPUUsage(containerID string) (float64, error) {
	// TODO: Implement
	return 0.0, nil
}

// getNetworkStats gets network stats for a container
func (cs *ContainerService) getNetworkStats(containerID string) (networkStats, error) {
	// TODO: Implement
	return networkStats{}, nil
}

// getBlockStats gets block I/O stats for a container
func (cs *ContainerService) getBlockStats(containerID string) (blockStats, error) {
	// TODO: Implement
	return blockStats{}, nil
}

// getPidCount gets the number of processes in a container
func (cs *ContainerService) getPidCount(containerID string) (int, error) {
	// TODO: Implement
	return 0, nil
}

// CreateContainer creates a new container
func (cs *ContainerService) CreateContainer(userId string, request ContainerCreateRequest) (*models.Container, error) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	logger.LogDebug("Creating container", "request", request)
	image, err := query.FindById[*models.ContainerImage](request.ImageID)
	if err != nil {
		return nil, fmt.Errorf("image not found: %w", err)
	}

	if request.Name == "" {
		return nil, fmt.Errorf("container name is required")
	}

	logger.LogDebug("Checking for duplicate name")
	existingContainer, err := query.FindByFilter[*models.Container](map[string]interface{}{
		"user": userId,
		"name": request.Name,
	})

	if err == nil && existingContainer != nil {
		return nil, fmt.Errorf("container with name '%s' already exists", request.Name)
	}

	if request.Resources == nil {
		request.Resources = &ContainerResources{
			CPUShares: cs.config.DefaultCPUShare,
			Memory:    int64(cs.config.DefaultMemoryMB * 1024 * 1024),
		}
	}

	containerID := util.GenerateRandomId()
	containerDir := filepath.Join(cs.containersPath, containerID)
	logger.LogDebug("Creating container directory", "containerDir", containerDir)
	if err := os.MkdirAll(containerDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create container directory: %w", err)
	}

	rootfsPath := filepath.Join(containerDir, "rootfs")
	if err := cs.prepareRootfs(image, rootfsPath); err != nil {
		return nil, fmt.Errorf("failed to prepare rootfs: %w", err)
	}

	logger.LogDebug("Creating runtime spec")
	spec, err := cs.createRuntimeSpec(containerID, request, rootfsPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create runtime spec: %w", err)
	}

	logger.LogDebug("Saving runtime spec", "containerDir", containerDir)
	specPath := filepath.Join(containerDir, "scripts/config.json")
	specJSON, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal runtime spec: %w", err)
	}

	if err := os.WriteFile(specPath, specJSON, 0644); err != nil {
		return nil, fmt.Errorf("failed to write runtime spec: %w", err)
	}

	container := &models.Container{
		User:          userId,
		Name:          request.Name,
		ImageID:       request.ImageID,
		Status:        "created",
		IsAutostart:   request.IsAutostart,
		IsPublic:      request.IsPublic,
	}

	container.Id = containerID

	// Set JSON fields
	if request.Config != nil {
		configJSON, _ := json.Marshal(request.Config)
		container.Config.Scan(configJSON)
	}

	if request.Resources != nil {
		resourcesJSON, _ := json.Marshal(request.Resources)
		container.Resources.Scan(resourcesJSON)
	}

	if request.Network != nil {
		networkJSON, _ := json.Marshal(request.Network)
		container.Network.Scan(networkJSON)
	}

	if request.Volumes != nil {
		volumesJSON, _ := json.Marshal(request.Volumes)
		container.Volumes.Scan(volumesJSON)
	}

	logger.LogDebug("Saving container to database")
	if err := query.SaveRecord(container); err != nil {
		return nil, fmt.Errorf("failed to save container record: %w", err)
	}

	logger.LogDebug("Creating log")
	cs.createLog(container.Id, "system", "Container created", "info")

	return container, nil
}

// ContainerCreateRequest represents a request to create a container
type ContainerCreateRequest struct {
	Name        string                 `json:"name"`
	ImageID     string                 `json:"image_id"`
	Command     []string               `json:"command"`
	Entrypoint  []string               `json:"entrypoint"`
	Env         []string               `json:"env"`
	WorkingDir  string                 `json:"working_dir"`
	Resources   *ContainerResources    `json:"resources"`
	Network     *ContainerNetworkConfig `json:"network"`
	Volumes     []ContainerVolume      `json:"volumes"`
	Config      map[string]interface{} `json:"config"`
	IsAutostart bool                   `json:"is_autostart"`
	IsPublic    bool                   `json:"is_public"`
}

// prepareRootfs prepares the rootfs for a container
func (cs *ContainerService) prepareRootfs(image *models.ContainerImage, rootfsPath string) error {
	if err := os.MkdirAll(rootfsPath, 0755); err != nil {
		return fmt.Errorf("failed to create rootfs directory: %w", err)
	}
	
	buildDir := filepath.Join(cs.imagesPath, image.Id, "rootfs")
	
	buildDirInfo, err := os.Stat(buildDir)
	if err != nil {
		return fmt.Errorf("rootfs source directory does not exist: %w", err)
	}
	
	if !buildDirInfo.IsDir() {
		return fmt.Errorf("rootfs source path is not a directory: %s", buildDir)
	}
	
	logger.LogDebug("Copying rootfs", "buildDir", buildDir, "rootfsPath", rootfsPath)
	
	cmd := exec.Command("cp", "-a", buildDir+"/.", rootfsPath+"/")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to copy rootfs from build directory: %w, output: %s", err, string(output))
	}
	
	logger.LogDebug("Successfully copied rootfs contents")
	return nil
}

// createRuntimeSpec creates an OCI runtime spec for a container
func (cs *ContainerService) createRuntimeSpec(id string, request ContainerCreateRequest, rootfsPath string) (*OCISpec, error) {
	if (request.WorkingDir == "") {
		request.WorkingDir = "/"
	}
	spec := OCISpec{
		Ociversion: "1.2.0",
		Process: struct {
			Terminal bool     `json:"terminal"`
			User     User     `json:"user"`
			Args     []string `json:"args"`
			Env      []string `json:"env"`
			Cwd      string   `json:"cwd"`
			Capabilities struct {
				Bounding    []string `json:"bounding"`
				Effective   []string `json:"effective"`
				Inheritable []string `json:"inheritable"`
				Permitted   []string `json:"permitted"`
			} `json:"capabilities"`
			Rlimits []struct {
				Type string `json:"type"`
				Hard uint64 `json:"hard"`
				Soft uint64 `json:"soft"`
			} `json:"rlimits"`
			NoNewPrivileges bool `json:"noNewPrivileges"`
		}{
			Terminal: false,
			User: User{
				UID: 0,
				GID: 0,
			},
			Args: request.Command,
			Env:  request.Env,
			Cwd:  request.WorkingDir,
			NoNewPrivileges: cs.config.DisablePrivileged,
		},
		Root: struct {
			Path     string `json:"path"`
			Readonly bool   `json:"readonly"`
		}{
			Path:     "rootfs",
			Readonly: true,
		},
		Hostname: id,
	}

	// Add default namespaces
	spec.Linux.Namespaces = []struct {
		Type string `json:"type"`
		Path string `json:"path,omitempty"`
	}{
		{Type: "pid"},
		{Type: "ipc"},
		{Type: "uts"},
		{Type: "mount"},
		{Type: "cgroup"},
		{Type: "user"},
		{Type: "network"},
	}

	spec.Linux.UIDMappings = []struct {
		ContainerID uint32 `json:"containerId"`
		HostID      uint32 `json:"hostId"`
		Size        uint32 `json:"size"`
	}{
		{ContainerID: 0, HostID: 502, Size: 1},
	}

	spec.Linux.GIDMappings = []struct {
		ContainerID uint32 `json:"containerId"`
		HostID      uint32 `json:"hostId"`
		Size        uint32 `json:"size"`
	}{
		{ContainerID: 0, HostID: 1001, Size: 1},
	}

	spec.Linux.MaskedPaths = []string{
		"/proc/acpi",
		"/proc/asound",
		"/proc/kcore",
		"/proc/keys",
		"/proc/latency_stats",
		"/proc/timer_list",
		"/proc/timer_stats",
		"/proc/sched_debug",
		"/sys/firmware",
		"/proc/scsi",
	}
	spec.Linux.ReadonlyPaths = []string{
		"/proc/bus",
		"/proc/fs",
		"/proc/irq",
		"/proc/sys",
		"/proc/sysrq-trigger",
	}

	spec.Process.Rlimits = []struct {
		Type string `json:"type"`
		Hard uint64 `json:"hard"`
		Soft uint64 `json:"soft"`
	}{
		{Type: "RLIMIT_NOFILE", Hard: 1024, Soft: 1024},
	}

	spec.Process.Capabilities.Bounding = []string{"CAP_AUDIT_WRITE", "CAP_KILL", "CAP_NET_BIND_SERVICE"}
	spec.Process.Capabilities.Effective = []string{"CAP_AUDIT_WRITE", "CAP_KILL", "CAP_NET_BIND_SERVICE"}
	spec.Process.Capabilities.Permitted = []string{"CAP_AUDIT_WRITE", "CAP_KILL", "CAP_NET_BIND_SERVICE"}

	// Add network namespace if networking is enabled
	if request.Network != nil && request.Network.Enable {
		spec.Linux.Namespaces = append(spec.Linux.Namespaces, struct {
			Type string `json:"type"`
			Path string `json:"path,omitempty"`
		}{Type: "network"})
	}

	// Add resource limits
	// if request.Resources != nil {
	// 	spec.Linux.Resources.CPU.Shares = request.Resources.CPUShares
	// 	if request.Resources.CPUQuota > 0 {
	// 		spec.Linux.Resources.CPU.Quota = request.Resources.CPUQuota
	// 	}
	// 	if request.Resources.CPUPeriod > 0 {
	// 		spec.Linux.Resources.CPU.Period = request.Resources.CPUPeriod
	// 	}
	// 	if request.Resources.CPUSet != "" {
	// 		spec.Linux.Resources.CPU.Cpus = request.Resources.CPUSet
	// 	}
		
	// 	spec.Linux.Resources.Memory.Limit = request.Resources.Memory
	// 	if request.Resources.MemorySwap > 0 {
	// 		spec.Linux.Resources.Memory.Swap = request.Resources.MemorySwap
	// 	}
	// }

	// Add basic mounts
	spec.Mounts = []struct {
		Destination string   `json:"destination"`
		Type        string   `json:"type"`
		Source      string   `json:"source"`
		Options     []string `json:"options,omitempty"`
	}{
		{
			Destination: "/proc",
			Type:        "proc",
			Source:      "proc",
		},
		{
			Destination: "/dev",
			Type:        "tmpfs",
			Source:      "tmpfs",
			Options:     []string{"nosuid", "strictatime", "mode=755", "size=65536k"},
		},
		{
			Destination: "/dev/pts",
			Type:        "devpts",
			Source:      "devpts",
			Options:     []string{"nosuid", "noexec", "newinstance", "ptmxmode=0666", "mode=0620"},
		},
		{
			Destination: "/dev/shm",
			Type:        "tmpfs",
			Source:      "shm",
			Options:     []string{"nosuid", "noexec", "nodev", "mode=1777", "size=65536k"},
		},
		{
			Destination: "/dev/mqueue",
			Type:        "mqueue",
			Source:      "mqueue",
			Options:     []string{"nosuid", "noexec", "nodev"},
		},
		{
			Destination: "/sys",
			Type:        "none",
			Source:      "/sys",
			Options:     []string{"rbind", "nosuid", "noexec", "nodev", "ro"},
		},
		{
			Destination: "/sys/fs/cgroup",
			Type:        "cgroup",
			Source:      "cgroup",
			Options:     []string{"nosuid", "noexec", "nodev", "relatime"},
		},
	}

	// Add volume mounts
	if request.Volumes != nil {
		for _, volume := range request.Volumes {
			options := []string{"rbind"}
			if volume.ReadOnly {
				options = append(options, "ro")
			}
			
			spec.Mounts = append(spec.Mounts, struct {
				Destination string   `json:"destination"`
				Type        string   `json:"type"`
				Source      string   `json:"source"`
				Options     []string `json:"options,omitempty"`
			}{
				Destination: volume.Destination,
				Type:        "bind",
				Source:      volume.Source,
				Options:     options,
			})
		}
	}

	return &spec, nil
}

// StartContainer starts a container
func (cs *ContainerService) StartContainer(containerID string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		return fmt.Errorf("container not found: %w", err)
	}

	if container.Status == "running" {
		return fmt.Errorf("container is already running")
	}

	if container.Status == "paused" {
		return cs.ResumeContainer(containerID)
	}

	containerDir := filepath.Join(cs.containersPath, containerID)
	
	logger.LogDebug("Container path", "containerDir", containerDir)
	if _, err := os.Stat(containerDir); os.IsNotExist(err) {
		return fmt.Errorf("container directory does not exist")
	}

	logger.LogDebug("Starting container with runc", "runcPath", cs.runcPath, "containerID", containerID)
	cmd := exec.Command(cs.runcPath, "--root", cs.runcDataPath, "run", "-d", "--bundle", containerDir, containerID)
	
	stdoutFile, err := os.Create(filepath.Join(containerDir, "stdout.log"))
	if err != nil {
		return fmt.Errorf("failed to create stdout log file: %w", err)
	}
	
	stderrFile, err := os.Create(filepath.Join(containerDir, "stderr.log"))
	if err != nil {
		stdoutFile.Close()
		return fmt.Errorf("failed to create stderr log file: %w", err)
	}

	cmd.Stdout = stdoutFile
	cmd.Stderr = stderrFile
	
	logger.LogDebug("Runc command", "command", cmd.String())
	err = cmd.Start()
	if err != nil {
		cs.createLog(containerID, "system", fmt.Sprintf("Failed to start container: %v", err), "error")
		return fmt.Errorf("failed to start container: %w", err)
	}

	done := make(chan struct{})
	cs.activeContainers[containerID] = &containerProcess{
		containerID: containerID,
		cmd:         cmd,
		done:        done,
	}

	container.Status = "running"
	container.StartedAt = types.NowDateTime()
	
	if err := query.SaveRecord(container); err != nil {
		logger.LogError("Failed to update container status: %v", err)
	}

	go func() {
		err := cmd.Wait()
		close(done)
		
		cs.mu.Lock()
		delete(cs.activeContainers, containerID)
		cs.mu.Unlock()
		
		if err != nil {
			exitErr, ok := err.(*exec.ExitError)
			if ok {
				cs.createLog(containerID, "system", fmt.Sprintf("Container exited with code %d", exitErr.ExitCode()), "info")
				logger.LogDebug("Container exited with code", "code", exitErr)
			} else {
				cs.createLog(containerID, "system", fmt.Sprintf("Container exited with error: %v", err), "error")
			}
			logger.LogDebug("Container exited with error", "error", err)
			cs.updateContainerStatus(containerID, "exited")
		} else {
			cs.createLog(containerID, "system", "Container created successfully", "info")
			cs.updateContainerStatus(containerID, "running")
		}
	}()

	cs.createLog(containerID, "system", "Container started", "info")
	
	return nil
}

// StopContainer stops a container
func (cs *ContainerService) StopContainer(containerID string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		return fmt.Errorf("container not found: %w", err)
	}

	if container.Status == "stopped" || container.Status == "exited" || container.Status == "created" {
		return fmt.Errorf("container is not running")
	}

	// If container is paused, resume it first
	// if container.Status == "paused" {
	// 	cs.mu.Unlock()
	// 	err := cs.ResumeContainer(containerID)
	// 	cs.mu.Lock()
	// 	if err != nil {
	// 		return fmt.Errorf("failed to resume container before stopping: %w", err)
	// 	}
	// }

	cmd := exec.Command(cs.runcPath, "--root", cs.runcDataPath, "kill", containerID, "KILL")
	output, err := cmd.CombinedOutput()
	logger.LogDebug("Stop container command", "command", cmd.String(), "output", output)
	if err != nil {
		cs.createLog(containerID, "system", fmt.Sprintf("Failed to kill container: %v, output: %s", err, output), "error")
		return fmt.Errorf("failed to stop container: %w", err)
	}

	if process, exists := cs.activeContainers[containerID]; exists {
		select {
		case <-process.done:
		case <-time.After(10 * time.Second):
			forceCmd := exec.Command(cs.runcPath, "--root", cs.runcDataPath, "kill", containerID, "KILL")
			forceCmd.Run()
		}
		
		delete(cs.activeContainers, containerID)
	}

	container.Status = "stopped"
	container.StoppedAt = types.NowDateTime()
	
	if err := query.SaveRecord(container); err != nil {
		logger.LogError("Failed to update container status: %v", err)
	}

	deleteCmd := exec.Command(cs.runcPath, "--root", cs.runcDataPath, "delete", containerID)
	deleteCmd.Run()

	cs.createLog(containerID, "system", "Container stopped", "info")
	
	return nil
}

// PauseContainer pauses a running container
func (cs *ContainerService) PauseContainer(containerID string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		return fmt.Errorf("container not found: %w", err)
	}

	if container.Status != "running" {
		return fmt.Errorf("container is not running")
	}

	checkpointDir := filepath.Join(cs.checkpointPath, containerID)
	if err := os.MkdirAll(checkpointDir, 0755); err != nil {
		return fmt.Errorf("failed to create checkpoint directory: %w", err)
	}

	cmd := exec.Command(cs.runcPath, "--root", cs.runcDataPath, "checkpoint", "--image-path", checkpointDir, containerID)
	output, err := cmd.CombinedOutput()
	if err != nil {
		cs.createLog(containerID, "system", fmt.Sprintf("Failed to checkpoint container: %v, output: %s", err, output), "error")
		return fmt.Errorf("failed to checkpoint container: %w", err)
	}

	container.Status = "paused"
	container.LastPausedAt = types.NowDateTime()
	container.CheckpointPath = checkpointDir
	
	if err := query.SaveRecord(container); err != nil {
		logger.LogError("Failed to update container status: %v", err)
	}

	if process, exists := cs.activeContainers[containerID]; exists {
		select {
		case <-process.done:
		case <-time.After(5 * time.Second):
			forceCmd := exec.Command(cs.runcPath, "--root", cs.runcDataPath, "kill", containerID, "KILL")
			forceCmd.Run()
		}
		
		delete(cs.activeContainers, containerID)
	}

	cs.createLog(containerID, "system", "Container paused with checkpoint", "info")
	
	return nil
}

// ResumeContainer resumes a paused container
func (cs *ContainerService) ResumeContainer(containerID string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		return fmt.Errorf("container not found: %w", err)
	}

	if container.Status != "paused" {
		return fmt.Errorf("container is not paused")
	}

	if container.CheckpointPath == "" {
		return fmt.Errorf("checkpoint path not found")
	}

	containerDir := filepath.Join(cs.containersPath, containerID)
	
	if _, err := os.Stat(containerDir); os.IsNotExist(err) {
		return fmt.Errorf("container directory does not exist")
	}

	cmd := exec.Command(cs.runcPath, "--root", cs.runcDataPath, "restore", "-d", "--image-path", container.CheckpointPath, "--bundle", containerDir, containerID)
	output, err := cmd.CombinedOutput()
	if err != nil {
		cs.createLog(containerID, "system", fmt.Sprintf("Failed to restore container: %v, output: %s", err, output), "error")
		return fmt.Errorf("failed to restore container: %w", err)
	}

	container.Status = "running"
	container.LastResumedAt = types.NowDateTime()
	
	if err := query.SaveRecord(container); err != nil {
		logger.LogError("Failed to update container status: %v", err)
	}

	done := make(chan struct{})
	cs.activeContainers[containerID] = &containerProcess{
		containerID: containerID,
		cmd:         nil, // TODO: Implement command object when resuming with runc/criu
		done:        done,
	}

	go cs.monitorRestoredContainer(containerID, done)
	cs.createLog(containerID, "system", "Container resumed from checkpoint", "info")
	
	return nil
}

// monitorRestoredContainer monitors a restored container
func (cs *ContainerService) monitorRestoredContainer(containerID string, done chan struct{}) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			cmd := exec.Command(cs.runcPath, "--root", cs.runcDataPath, "state", containerID)
			output, err := cmd.CombinedOutput()
			if err != nil {
				logger.LogError("Container %s exited: %v", containerID, err)
				close(done)
				
				cs.mu.Lock()
				delete(cs.activeContainers, containerID)
				cs.mu.Unlock()
				
				cs.updateContainerStatus(containerID, "exited")
				return
			}
			
			var state struct {
				Status string `json:"status"`
			}
			
			if err := json.Unmarshal(output, &state); err != nil {
				logger.LogError("Failed to parse container state: %v", err)
				continue
			}
			
			if state.Status != "running" {
				logger.LogInfo("Container %s state changed to %s", containerID, state.Status)
				close(done)
				
				cs.mu.Lock()
				delete(cs.activeContainers, containerID)
				cs.mu.Unlock()
				
				cs.updateContainerStatus(containerID, state.Status)
				return
			}
		}
	}
}

// DeleteContainer deletes a container
func (cs *ContainerService) DeleteContainer(containerID string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		return fmt.Errorf("container not found: %w", err)
	}

	if container.Status == "running" || container.Status == "paused" {
		return fmt.Errorf("container is still running or paused, stop it first")
	}

	containerDir := filepath.Join(cs.containersPath, containerID)
	
	if err := os.RemoveAll(containerDir); err != nil {
		logger.LogError("Failed to remove container directory: %v", err)
	}

	if container.CheckpointPath != "" {
		if err := os.RemoveAll(container.CheckpointPath); err != nil {
			logger.LogError("Failed to remove checkpoint directory: %v", err)
		}
	}

	if err := query.DeleteById[*models.Container](containerID); err != nil {
		return fmt.Errorf("failed to delete container record: %w", err)
	}

	logger.LogInfo("Container %s deleted", containerID)

	return nil
}

// ListContainers lists all containers for a user
func (cs *ContainerService) ListContainers(userId string, includePublic bool) ([]*models.Container, error) {
	var containers []*models.Container
	var err error

	if includePublic {
		containers, err = query.FindAllByFilter[*models.Container](map[string]interface{}{
			"user": userId,
		})
	} else {
		containers, err = query.FindAllByFilter[*models.Container](map[string]interface{}{
			"user": userId,
		})
		
		publicContainers, pubErr := query.FindAllByFilter[*models.Container](map[string]interface{}{
			"is_public": true,
		})
		
		if pubErr == nil {
			for _, container := range publicContainers {
				if container.User != userId {
					containers = append(containers, container)
				}
			}
		}
	}

	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	return containers, nil
}

// GetContainerLogs gets logs for a container
func (cs *ContainerService) GetContainerLogs(containerID string, limit int) ([]*models.ContainerLog, error) {
	if limit <= 0 {
		limit = cs.config.MaxLogs
	}

	logs, err := query.FindAllByFilter[*models.ContainerLog](map[string]interface{}{
		"container_id": containerID,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to get container logs: %w", err)
	}

	sort.Slice(logs, func(i, j int) bool {
		return logs[i].Timestamp.After(logs[j].Timestamp)
	})

	if len(logs) > limit {
		logs = logs[:limit]
	}

	return logs, nil
}

// GetContainerStats gets stats for a container
func (cs *ContainerService) GetContainerStats(containerID string, limit int) ([]*models.ContainerStat, error) {
	if limit <= 0 {
		limit = 60
	}

	stats, err := query.FindAllByFilter[*models.ContainerStat](map[string]interface{}{
		"container_id": containerID,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to get container stats: %w", err)
	}

	sort.Slice(stats, func(i, j int) bool {
		return stats[i].Timestamp.After(stats[j].Timestamp)
	})

	if len(stats) > limit {
		stats = stats[:limit]
	}

	return stats, nil
}

// CreateImage creates or imports a container image
func (cs *ContainerService) CreateImage(userId string, request ImageCreateRequest) (*models.ContainerImage, error) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	logger.LogInfo("Validating image name")
	if request.Name == "" {
		return nil, fmt.Errorf("image name is required")
	}

	if request.Tag == "" {
		request.Tag = "latest"
	}

	existingImage, err := query.FindByFilter[*models.ContainerImage](map[string]interface{}{
		"user": userId,
		"name": request.Name,
		"tag":  request.Tag,
	})

	logger.LogInfo("Checking for duplicate image")

	if err == nil && existingImage != nil {
		return nil, fmt.Errorf("image with name '%s' and tag '%s' already exists", request.Name, request.Tag)
	}

	imageID := util.GenerateRandomId()
	
	imagePath := filepath.Join(cs.imagesPath, imageID)
	if err := os.MkdirAll(imagePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create image directory: %w", err)
	}

	var imageSize int64
	switch request.Source {
	case "dockerfile":
		if request.Dockerfile == "" {
			return nil, fmt.Errorf("dockerfile is required for dockerfile source")
		}
		
		dockerfilePath := filepath.Join(imagePath, "Dockerfile")
		if err := os.WriteFile(dockerfilePath, []byte(request.Dockerfile), 0644); err != nil {
			return nil, fmt.Errorf("failed to write Dockerfile: %w", err)
		}
		
		// TODO: Implement actual build
		rootfsPath := filepath.Join(imagePath, "rootfs")
		if err := os.MkdirAll(rootfsPath, 0755); err != nil {
			return nil, fmt.Errorf("failed to create rootfs directory: %w", err)
		}
		
		// Get size of directory
		imageSize = getDirSize(rootfsPath)
		
	case "registry":
		// TODO: Implement actual registry pull
		rootfsPath := filepath.Join(imagePath, "rootfs")
		if err := os.MkdirAll(rootfsPath, 0755); err != nil {
			return nil, fmt.Errorf("failed to create rootfs directory: %w", err)
		}
		
		imageSize = getDirSize(rootfsPath)
		
	default:
		return nil, fmt.Errorf("invalid image source: %s", request.Source)
	}

	image := &models.ContainerImage{
		User:        userId,
		Name:        request.Name,
		Tag:         request.Tag,
		Registry:    request.Registry,
		Source:      request.Source,
		Dockerfile:  request.Dockerfile,
		BuildPath:   imagePath,
		Description: request.Description,
		IsPublic:    request.IsPublic,
		PullCount:   0,
		LastPulled:  types.DateTime{},
		ImageSize:   imageSize,
		IsBuilt:     true,
	}

	image.Id = imageID

	if request.Labels != nil {
		labelsJSON, _ := json.Marshal(request.Labels)
		image.Labels.Scan(labelsJSON)
	}

	if err := query.SaveRecord(image); err != nil {
		return nil, fmt.Errorf("failed to save image record: %w", err)
	}

	return image, nil
}

// ImageCreateRequest represents a request to create a container image
type ImageCreateRequest struct {
	Name        string            `json:"name"`
	Tag         string            `json:"tag"`
	Registry    string            `json:"registry"`
	Source      string            `json:"source"`
	Dockerfile  string            `json:"dockerfile"`
	Description string            `json:"description"`
	Labels      map[string]string `json:"labels"`
	IsPublic    bool              `json:"is_public"`
}

// getDirSize gets the size of a directory in bytes
func getDirSize(path string) int64 {
	var size int64
	err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	
	if err != nil {
		return 0
	}
	
	return size
}

// ListImages lists container images for a user
func (cs *ContainerService) ListImages(userId string, includePublic bool) ([]*models.ContainerImage, error) {
	var images []*models.ContainerImage
	var err error

	if includePublic {
		userImages, err := query.FindAllByFilter[*models.ContainerImage](map[string]interface{}{
			"user": userId,
		})
		
		if err != nil {
			return nil, fmt.Errorf("failed to list user images: %w", err)
		}
		
		images = userImages
		
		publicImages, pubErr := query.FindAllByFilter[*models.ContainerImage](map[string]interface{}{
			"is_public": true,
		})
		
		if pubErr == nil {
			for _, image := range publicImages {
				if image.User != userId {
					images = append(images, image)
				}
			}
		}
	} else {
		images, err = query.FindAllByFilter[*models.ContainerImage](map[string]interface{}{
			"user": userId,
		})
		
		if err != nil {
			return nil, fmt.Errorf("failed to list user images: %w", err)
		}
	}

	return images, nil
}

// DeleteImage deletes a container image
func (cs *ContainerService) DeleteImage(imageID string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	image, err := query.FindById[*models.ContainerImage](imageID)
	if err != nil {
		return fmt.Errorf("image not found: %w", err)
	}

	containers, err := query.FindAllByFilter[*models.Container](map[string]interface{}{
		"image_id": imageID,
	})

	if err == nil && len(containers) > 0 {
		return fmt.Errorf("image is in use by %d containers", len(containers))
	}

	if image.BuildPath != "" {
		if err := os.RemoveAll(image.BuildPath); err != nil {
			logger.LogError("Failed to remove image directory: %v", err)
		}
	}

	if err := query.DeleteById[*models.ContainerImage](imageID); err != nil {
		return fmt.Errorf("failed to delete image record: %w", err)
	}

	return nil
}

// createLog creates a log entry for a container
func (cs *ContainerService) createLog(containerID, logType, message, level string) {
	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		logger.LogError("Failed to get container for log: %v", err)
		return
	}

	log := &models.ContainerLog{
		User:        container.User,
		ContainerID: containerID,
		LogType:     logType,
		Message:     message,
		Level:       level,
		Timestamp:   types.NowDateTime(),
	}

	if err := query.SaveRecord(log); err != nil {
		logger.LogError("Failed to save container log: %v", err)
	}
}

// runCommand runs a command inside a container
func (cs *ContainerService) runCommand(containerID string, command []string, timeout time.Duration) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		return "", fmt.Errorf("container not found: %w", err)
	}

	if container.Status != "running" {
		return "", fmt.Errorf("container is not running")
	}

	args := append([]string{"exec", containerID}, command...)
	cmd := exec.CommandContext(ctx, cs.runcPath, args...)
	
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("command failed: %w, stderr: %s", err, stderr.String())
	}
	
	return stdout.String(), nil
}

// StreamLogs streams logs from a container
func (cs *ContainerService) StreamLogs(containerID string, writer io.Writer, follow bool) error {
	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		return fmt.Errorf("container not found: %w", err)
	}

	if !follow {
		logs, err := cs.GetContainerLogs(containerID, 100)
		if err != nil {
			return err
		}
		
		for i := len(logs) - 1; i >= 0; i-- {
			fmt.Fprintf(writer, "[%s] [%s] %s\n", 
				logs[i].Timestamp.Time().Format(time.RFC3339),
				logs[i].Level,
				logs[i].Message)
		}
		
		return nil
	}

	if container.Status == "running" {
		// TODO: Implement actual streaming for logs
		// For now, just simulate with regular logs
		logs, err := cs.GetContainerLogs(containerID, 10)
		if err != nil {
			return err
		}
		
		for i := len(logs) - 1; i >= 0; i-- {
			fmt.Fprintf(writer, "[%s] [%s] %s\n", 
				logs[i].Timestamp.Time().Format(time.RFC3339),
				logs[i].Level,
				logs[i].Message)
		}
		
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		
		for i := 0; i < 5; i++ {
			<-ticker.C
			fmt.Fprintf(writer, "[%s] [info] Simulated log message %d\n", 
				time.Now().Format(time.RFC3339), i)
		}
	} else {
		logs, err := cs.GetContainerLogs(containerID, 100)
		if err != nil {
			return err
		}
		
		// Reverse the logs to get chronological order
		for i := len(logs) - 1; i >= 0; i-- {
			fmt.Fprintf(writer, "[%s] [%s] %s\n", 
				logs[i].Timestamp.Time().Format(time.RFC3339),
				logs[i].Level,
				logs[i].Message)
		}
	}
	
	return nil
}
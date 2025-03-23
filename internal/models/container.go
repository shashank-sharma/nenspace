package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*Container)(nil)
var _ core.Model = (*ContainerImage)(nil)
var _ core.Model = (*ContainerLog)(nil)
var _ core.Model = (*ContainerStat)(nil)

// Container represents a container instance
type Container struct {
	BaseModel

	User            string         `db:"user" json:"user"`                      // Reference to user
	Name            string         `db:"name" json:"name"`                      // Container name
	ImageID         string         `db:"image_id" json:"image_id"`              // Reference to ContainerImage
	Status          string         `db:"status" json:"status"`                  // running, paused, stopped, exited, created
	Config          types.JSONRaw  `db:"config" json:"config"`                  // Container config in JSON (command, env vars, etc.)
	Resources       types.JSONRaw  `db:"resources" json:"resources"`            // Resource allocations (CPU, memory, etc.)
	Network         types.JSONRaw  `db:"network" json:"network"`                // Network configuration
	Volumes         types.JSONRaw  `db:"volumes" json:"volumes"`                // Volume mounts
	IPAddress       string         `db:"ip_address" json:"ip_address"`          // Container IP address
	Ports           types.JSONRaw  `db:"ports" json:"ports"`                    // Exposed/mapped ports
	CheckpointPath  string         `db:"checkpoint_path" json:"checkpoint_path"` // Path to checkpoint if paused
	StartedAt       types.DateTime `db:"started_at" json:"started_at"`          // When container was started
	LastPausedAt    types.DateTime `db:"last_paused_at" json:"last_paused_at"`  // When container was last paused
	LastResumedAt   types.DateTime `db:"last_resumed_at" json:"last_resumed_at"`// When container was last resumed
	StoppedAt       types.DateTime `db:"stopped_at" json:"stopped_at"`          // When container was stopped
	IsAutostart     bool           `db:"is_autostart" json:"is_autostart"`      // Whether to start on system boot
	IsPublic        bool           `db:"is_public" json:"is_public"`            // Whether visible to other users
}

// ContainerImage represents a container image
type ContainerImage struct {
	BaseModel

	User        string         `db:"user" json:"user"`                // Reference to user who owns the image
	Name        string         `db:"name" json:"name"`                // Image name
	Tag         string         `db:"tag" json:"tag"`                  // Image tag
	Registry    string         `db:"registry" json:"registry"`        // Optional registry URL
	Source      string         `db:"source" json:"source"`            // Source (docker hub, local, etc.)
	Dockerfile  string         `db:"dockerfile" json:"dockerfile"`    // Optional Dockerfile content if custom build
	BuildPath   string         `db:"build_path" json:"build_path"`    // Path where image was built/stored
	Description string         `db:"description" json:"description"`  // Image description
	Labels      types.JSONRaw  `db:"labels" json:"labels"`            // Image labels
	IsPublic    bool           `db:"is_public" json:"is_public"`      // Whether visible to other users
	PullCount   int            `db:"pull_count" json:"pull_count"`    // Number of times used
	LastPulled  types.DateTime `db:"last_pulled" json:"last_pulled"`  // When image was last pulled/used
	ImageSize   int64          `db:"image_size" json:"image_size"`    // Size in bytes
	IsBuilt     bool           `db:"is_built" json:"is_built"`        // Whether the image is built and ready
}

type ContainerVolume struct {
	BaseModel

	User        string        `db:"user" json:"user"`
	Name        string        `db:"name" json:"name"`
	Driver      string        `db:"driver" json:"driver"`               // local, etc.
	Path        string        `db:"path" json:"path"`                   // Path on host
	Description string        `db:"description" json:"description"`
	IsPublic    bool          `db:"is_public" json:"is_public"`
	Metadata    types.JSONRaw `db:"metadata" json:"metadata"`           // Volume metadata
	MountCount  int           `db:"mount_count" json:"mount_count"`     // Number of active mounts
}

// ContainerLog represents a container log entry
type ContainerLog struct {
	BaseModel

	User        string         `db:"user" json:"user"`                // Reference to user
	ContainerID string         `db:"container_id" json:"container_id"`// Reference to Container
	LogType     string         `db:"log_type" json:"log_type"`        // stdout, stderr, event, system
	Message     string         `db:"message" json:"message"`          // Log message
	Level       string         `db:"level" json:"level"`              // Log level (info, warn, error, etc.)
	Timestamp   types.DateTime `db:"timestamp" json:"timestamp"`      // When log was generated
}

// ContainerStat represents container statistics
type ContainerStat struct {
	BaseModel

	User        string         `db:"user" json:"user"`                // Reference to user
	ContainerID string         `db:"container_id" json:"container_id"`// Reference to Container
	CPUUsage    float64        `db:"cpu_usage" json:"cpu_usage"`      // CPU usage percentage
	MemoryUsage int64          `db:"memory_usage" json:"memory_usage"`// Memory usage in bytes
	MemoryLimit int64          `db:"memory_limit" json:"memory_limit"`// Memory limit in bytes
	NetworkRx   int64          `db:"network_rx" json:"network_rx"`    // Network bytes received
	NetworkTx   int64          `db:"network_tx" json:"network_tx"`    // Network bytes transmitted
	BlockRead   int64          `db:"block_read" json:"block_read"`    // Block bytes read
	BlockWrite  int64          `db:"block_write" json:"block_write"`  // Block bytes written
	PIDCount    int            `db:"pid_count" json:"pid_count"`      // Number of processes
	Timestamp   types.DateTime `db:"timestamp" json:"timestamp"`      // When stats were collected
}

// TableName returns the table name for the Container model
func (m *Container) TableName() string {
	return "containers"
}

// TableName returns the table name for the ContainerImage model
func (m *ContainerImage) TableName() string {
	return "container_images"
}

// TableName returns the table name for the ContainerLog model
func (m *ContainerLog) TableName() string {
	return "container_logs"
}

// TableName returns the table name for the ContainerStat model
func (m *ContainerStat) TableName() string {
	return "container_stats"
}

func (m *ContainerVolume) TableName() string {
	return "container_volumes"
}
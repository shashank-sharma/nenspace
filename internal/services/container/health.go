package container

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

// HealthMonitor manages container health checks
type HealthMonitor struct {
	cs              *ContainerService
	checkInterval   time.Duration
	stopCh          chan struct{}
	wg              sync.WaitGroup
	containerChecks map[string]*containerCheck
	mu              sync.Mutex
}

type containerCheck struct {
	containerID   string
	lastCheck     time.Time
	healthStatus  string
	failureCount  int
	restartPolicy string
	maxRetries    int
}

// ContainerHealth represents the health status of a container
type ContainerHealth struct {
	Status      string    `json:"status"`
	StartedAt   time.Time `json:"started_at"`
	ExitCode    int       `json:"exit_code"`
	Error       string    `json:"error"`
	IsRunning   bool      `json:"is_running"`
	HealthCheck struct {
		Status string `json:"status"` // healthy, unhealthy, starting
	} `json:"health_check"`
}

// NewHealthMonitor creates a new health monitor
func NewHealthMonitor(cs *ContainerService, interval time.Duration) *HealthMonitor {
	return &HealthMonitor{
		cs:              cs,
		checkInterval:   interval,
		stopCh:          make(chan struct{}),
		containerChecks: make(map[string]*containerCheck),
	}
}

// Start begins the health monitoring loop
func (hm *HealthMonitor) Start() {
	hm.wg.Add(1)
	go func() {
		defer hm.wg.Done()
		ticker := time.NewTicker(hm.checkInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				hm.checkAllContainers()
			case <-hm.stopCh:
				return
			}
		}
	}()
}

// Stop halts the health monitoring
func (hm *HealthMonitor) Stop() {
	close(hm.stopCh)
	hm.wg.Wait()
}

// RegisterContainer adds a container to be monitored
func (hm *HealthMonitor) RegisterContainer(containerID, restartPolicy string, maxRetries int) {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	hm.containerChecks[containerID] = &containerCheck{
		containerID:   containerID,
		lastCheck:     time.Now(),
		healthStatus:  "starting",
		failureCount:  0,
		restartPolicy: restartPolicy,
		maxRetries:    maxRetries,
	}
}

// UnregisterContainer removes a container from monitoring
func (hm *HealthMonitor) UnregisterContainer(containerID string) {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	delete(hm.containerChecks, containerID)
}

// checkAllContainers performs health checks on all registered containers
func (hm *HealthMonitor) checkAllContainers() {
	hm.mu.Lock()
	containerIDs := make([]string, 0, len(hm.containerChecks))
	for id := range hm.containerChecks {
		containerIDs = append(containerIDs, id)
	}
	hm.mu.Unlock()

	for _, id := range containerIDs {
		health, err := hm.checkContainerHealth(id)
		if err != nil {
			logger.LogError("Health check failed for container %s: %v", id, err)
			continue
		}

		hm.mu.Lock()
		check, exists := hm.containerChecks[id]
		if !exists {
			hm.mu.Unlock()
			continue
		}

		check.lastCheck = time.Now()

		if !health.IsRunning {
			check.healthStatus = "stopped"
			check.failureCount++
			logger.LogWarning("Container %s is not running (failure count: %d)", id, check.failureCount)

			// Apply restart policy
			if check.restartPolicy == "always" || 
			   (check.restartPolicy == "on-failure" && health.ExitCode != 0) {
				if check.maxRetries == 0 || check.failureCount <= check.maxRetries {
					hm.mu.Unlock()
					logger.LogInfo("Attempting to restart container %s", id)
					if err := hm.cs.StartContainer(id); err != nil {
						logger.LogError("Failed to restart container %s: %v", id, err)
					} else {
						logger.LogInfo("Successfully restarted container %s", id)
					}
				} else {
					hm.mu.Unlock()
					logger.LogWarning("Container %s has exceeded max retry count (%d)", id, check.maxRetries)
				}
			} else {
				hm.mu.Unlock()
			}
		} else if health.HealthCheck.Status == "unhealthy" {
			check.healthStatus = "unhealthy"
			hm.mu.Unlock()
			
			// Log the unhealthy status
			hm.cs.createLog(id, "system", fmt.Sprintf("Container health check failed, status: unhealthy"), "warning")
		} else {
			previousStatus := check.healthStatus
			check.healthStatus = health.HealthCheck.Status
			check.failureCount = 0
			hm.mu.Unlock()
			
			// Log health status change
			if previousStatus != health.HealthCheck.Status {
				hm.cs.createLog(id, "system", fmt.Sprintf("Container health status changed: %s -> %s", 
					previousStatus, health.HealthCheck.Status), "info")
			}
		}
	}
}

// checkContainerHealth checks the health of a specific container
func (hm *HealthMonitor) checkContainerHealth(containerID string) (*ContainerHealth, error) {
	cmd := exec.Command(hm.cs.runcPath, "state", containerID)
	output, err := cmd.CombinedOutput()
	
	health := &ContainerHealth{
		IsRunning: false,
		HealthCheck: struct {
			Status string `json:"status"`
		}{
			Status: "unknown",
		},
	}

	if err != nil {
		// Container not found or not running
		exitErr, ok := err.(*exec.ExitError)
		if ok {
			health.ExitCode = exitErr.ExitCode()
		}
		health.Error = string(output)
		return health, nil
	}

	// Parse state output
	var state map[string]interface{}
	if err := json.Unmarshal(output, &state); err != nil {
		return nil, fmt.Errorf("failed to parse container state: %w", err)
	}

	// Extract basic state
	if status, ok := state["status"].(string); ok {
		health.Status = status
		health.IsRunning = (status == "running")
	}

	if startedAt, ok := state["created"].(string); ok {
		health.StartedAt, _ = time.Parse(time.RFC3339, startedAt)
	}

	// Check for health status if available
	if healthMap, ok := state["health"].(map[string]interface{}); ok {
		if status, ok := healthMap["status"].(string); ok {
			health.HealthCheck.Status = status
		}
	} else {
		// If no health check defined, consider running containers as healthy
		if health.IsRunning {
			health.HealthCheck.Status = "healthy"
		}
	}

	return health, nil
}

// Shutdown gracefully stops the container service
func (cs *ContainerService) Shutdown(ctx context.Context) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	logger.LogInfo("Shutting down container service...")

	// Stop health monitor if running
	if cs.healthMonitor != nil {
		cs.healthMonitor.Stop()
	}

	// Get all running containers
	running := make([]string, 0, len(cs.activeContainers))
	for id := range cs.activeContainers {
		running = append(running, id)
	}

	// Create a wait group to track shutdown progress
	var wg sync.WaitGroup
	errCh := make(chan error, len(running))

	// Attempt to gracefully stop each container
	for _, id := range running {
		wg.Add(1)
		go func(containerID string) {
			defer wg.Done()

			// Update status to stopping
			if err := cs.updateContainerStatus(containerID, "stopping"); err != nil {
				errCh <- fmt.Errorf("failed to update container %s status: %w", containerID, err)
				return
			}

			// Try to gracefully stop the container first
			cmd := exec.Command(cs.runcPath, "kill", containerID, "SIGTERM")
			if err := cmd.Run(); err != nil {
				logger.LogWarning("Failed to gracefully stop container %s: %v", containerID, err)
			}

			// Wait for container to stop
			select {
			case <-ctx.Done():
				// Context deadline exceeded, force kill
				forceCmd := exec.Command(cs.runcPath, "kill", containerID, "SIGKILL")
				if err := forceCmd.Run(); err != nil {
					errCh <- fmt.Errorf("failed to force kill container %s: %w", containerID, err)
				}
			case <-time.After(10 * time.Second):
				// Timeout, force kill
				forceCmd := exec.Command(cs.runcPath, "kill", containerID, "SIGKILL")
				if err := forceCmd.Run(); err != nil {
					errCh <- fmt.Errorf("failed to force kill container %s: %w", containerID, err)
				}
			}

			// Clean up runc state
			deleteCmd := exec.Command(cs.runcPath, "delete", containerID)
			if err := deleteCmd.Run(); err != nil {
				logger.LogWarning("Failed to clean up container %s state: %v", containerID, err)
			}

			// Update container status
			if err := cs.updateContainerStatus(containerID, "stopped"); err != nil {
				errCh <- fmt.Errorf("failed to update container %s final status: %w", containerID, err)
			}
		}(id)
	}

	// Wait for all containers to be processed
	wg.Wait()
	close(errCh)

	// Collect errors
	var errors []string
	for err := range errCh {
		errors = append(errors, err.Error())
	}

	if len(errors) > 0 {
		return fmt.Errorf("errors during shutdown: %s", strings.Join(errors, "; "))
	}

	logger.LogInfo("Container service shutdown completed successfully")
	return nil
}

// updateContainerStatusDirect updates a container's status directly without locking
func (cs *ContainerService) updateContainerStatusDirect(containerID, status string) error {
	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		return fmt.Errorf("container not found: %w", err)
	}

	container.Status = status
	
	// Update additional fields based on status
	now := types.NowDateTime()
	
	switch status {
	case "running":
		container.StartedAt = now
	case "paused":
		container.LastPausedAt = now
	case "stopping":
		// No specific field for this transitional state
	case "exited", "stopped":
		container.StoppedAt = now
	}

	if err := query.SaveRecord(container); err != nil {
		return fmt.Errorf("failed to update container status: %w", err)
	}
	
	return nil
}

// updateContainerStatus is a thread-safe wrapper for updateContainerStatusDirect
func (cs *ContainerService) updateContainerStatus(containerID, status string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	return cs.updateContainerStatusDirect(containerID, status)
}
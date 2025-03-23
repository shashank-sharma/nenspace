package container

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

// ImageBuilder handles building container images
type ImageBuilder struct {
	service      *ContainerService
	podmanPath   string  // Path to podman executable
	skopeoPath   string  // Path to skopeo executable
	umociPath    string  // Path to umoci executable
	buildah      string  // Path to buildah executable
	timeoutSecs  int     // Build timeout in seconds
}

// BuildOptions contains options for building an image
type BuildOptions struct {
	BuildContext   string            // Path to build context
	Dockerfile     string            // Path to Dockerfile, or content if FromContent is true
	FromContent    bool              // Whether Dockerfile is content rather than path
	Tags           []string          // Tags to apply to the image
	BuildArgs      map[string]string // Build arguments
	NoCache        bool              // Whether to bypass cache
	Pull           bool              // Whether to pull base images
	ForceBuildah   bool              // Whether to force using buildah instead of podman
	OutputFormat   string            // Output format (oci, docker)
	ExtraOptions   []string          // Extra build options
}

// NewImageBuilder creates a new image builder
func NewImageBuilder(service *ContainerService) (*ImageBuilder, error) {
	builder := &ImageBuilder{
		service:     service,
		timeoutSecs: 600, // 10 minutes default
	}

	// Find required tools
	podmanPath, err := exec.LookPath("podman")
	if err == nil {
		builder.podmanPath = podmanPath
	} else {
		logger.LogWarning("podman not found, container builds may be limited")
	}

	skopeoPath, err := exec.LookPath("skopeo")
	if err == nil {
		builder.skopeoPath = skopeoPath
	} else {
		logger.LogWarning("skopeo not found, image imports may be limited")
	}

	umociPath, err := exec.LookPath("umoci")
	if err == nil {
		builder.umociPath = umociPath
	} else {
		logger.LogWarning("umoci not found, OCI image handling may be limited")
	}

	buildahPath, err := exec.LookPath("buildah")
	if err == nil {
		builder.buildah = buildahPath
	} else {
		logger.LogWarning("buildah not found, using podman for builds")
	}

	// Check if at least one build tool is available
	if builder.podmanPath == "" && builder.buildah == "" {
		return nil, fmt.Errorf("no container build tools found (podman or buildah required)")
	}

	return builder, nil
}

// BuildImage builds a container image
func (ib *ImageBuilder) BuildImage(image *models.ContainerImage) error {
	// Create build context directory
	buildDir := filepath.Join(ib.service.imagesPath, image.Id, "build")
	if err := os.MkdirAll(buildDir, 0755); err != nil {
		return fmt.Errorf("failed to create build directory: %w", err)
	}

	// Update the image status
	image.IsBuilt = false
	if err := query.SaveRecord(image); err != nil {
		logger.LogError("Failed to update image status: %v", err)
	}

	// Save Dockerfile
	dockerfilePath := filepath.Join(buildDir, "Dockerfile")
	if err := os.WriteFile(dockerfilePath, []byte(image.Dockerfile), 0644); err != nil {
		return fmt.Errorf("failed to write Dockerfile: %w", err)
	}

	// Determine output path
	outputPath := filepath.Join(ib.service.imagesPath, image.Id, "rootfs")

	// Build the image using available tools
	var err error
	if ib.buildah != "" {
		err = ib.buildWithBuildah(buildDir, dockerfilePath, image, outputPath)
	} else if ib.podmanPath != "" {
		err = ib.buildWithPodman(buildDir, dockerfilePath, image, outputPath)
	} else {
		return fmt.Errorf("no build tools available")
	}

	if err != nil {
		logger.LogError("Build failed: %v", err)
		return err
	}

	// Update image size
	image.ImageSize = getDirSize(outputPath)
	image.IsBuilt = true
	if err := query.SaveRecord(image); err != nil {
		logger.LogError("Failed to update image after build: %v", err)
	}
	logger.LogInfo("Build completed: %s", image.Id)

	return nil
}

// buildWithPodman builds an image using Podman
func (ib *ImageBuilder) buildWithPodman(buildDir, dockerfilePath string, image *models.ContainerImage, outputPath string) error {
	// Prepare tag
	tag := fmt.Sprintf("localhost/%s:%s", image.Name, image.Tag)

	// Build context
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(ib.timeoutSecs)*time.Second)
	defer cancel()

	logger.LogInfo("Building image with podman: %s", tag)

	// Build the image
	buildCmd := exec.CommandContext(ctx, ib.podmanPath, "build", "-t", tag, "-f", dockerfilePath, buildDir)
	var stdout, stderr bytes.Buffer
	buildCmd.Stdout = &stdout
	buildCmd.Stderr = &stderr

	if err := buildCmd.Run(); err != nil {
		logger.LogError("Podman build failed: %s", stderr.String())
		return fmt.Errorf("podman build failed: %w\nOutput: %s", err, stderr.String())
	}

	logger.LogInfo("Podman build completed: %s", stdout.String())

	// Create OCI image in image directory
	saveCtx, saveCancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer saveCancel()

	saveDir := filepath.Join(ib.service.imagesPath, image.Id, "oci")
	if err := os.MkdirAll(saveDir, 0755); err != nil {
		return fmt.Errorf("failed to create OCI directory: %w", err)
	}

	saveCmd := exec.CommandContext(saveCtx, ib.podmanPath, "save", "--format", "oci-archive", "-o", 
		filepath.Join(saveDir, "image.tar"), tag)
	
	if err := saveCmd.Run(); err != nil {
		return fmt.Errorf("failed to save image: %w", err)
	}

	// Extract rootfs
	if err := os.MkdirAll(outputPath, 0755); err != nil {
		return fmt.Errorf("failed to create rootfs directory: %w", err)
	}

	if ib.umociPath != "" {
		return ib.extractWithUmoci(saveDir, outputPath)
	} else {
		return ib.extractRootfsManually(saveDir, outputPath, tag)
	}
}

// buildWithBuildah builds an image using Buildah
func (ib *ImageBuilder) buildWithBuildah(buildDir, dockerfilePath string, image *models.ContainerImage, outputPath string) error {
	// Prepare tag
	tag := fmt.Sprintf("localhost/%s:%s", image.Name, image.Tag)

	// Build context
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(ib.timeoutSecs)*time.Second)
	defer cancel()

	logger.LogInfo("Building image with buildah: %s", tag)

	// Build the image
	buildCmd := exec.CommandContext(ctx, ib.buildah, "bud", "--tag", tag, "-f", dockerfilePath, buildDir)
	var stdout, stderr bytes.Buffer
	buildCmd.Stdout = &stdout
	buildCmd.Stderr = &stderr

	if err := buildCmd.Run(); err != nil {
		logger.LogError("Buildah build failed: %s", stderr.String())
		return fmt.Errorf("buildah build failed: %w\nOutput: %s", err, stderr.String())
	}

	logger.LogInfo("Buildah build completed: %s", stdout.String())

	// Create container with the image
	createCtx, createCancel := context.WithTimeout(context.Background(), time.Minute)
	defer createCancel()

	containerName := fmt.Sprintf("extract-%s", image.Id)
	createCmd := exec.CommandContext(createCtx, ib.buildah, "from", "--name", containerName, tag)
	logger.LogInfo("Create command", "command", createCmd.String())
	if err := createCmd.Run(); err != nil {
		return fmt.Errorf("failed to create container for extraction: %w", err)
	}

	// Extract rootfs
	if err := os.MkdirAll(outputPath, 0755); err != nil {
		return fmt.Errorf("failed to create rootfs directory: %w", err)
	}

	mountCtx, mountCancel := context.WithTimeout(context.Background(), time.Minute)
	defer mountCancel()

	// Get mount point
	mountCmd := exec.CommandContext(mountCtx, ib.buildah, "unshare", "./scripts/create-rootfs.sh", containerName, outputPath)
	mountOut, err := mountCmd.Output()
	logger.LogInfo("Mount command", "command", mountCmd.String())
	logger.LogInfo("Mount output", "output", string(mountOut))
	if err != nil {
		return fmt.Errorf("failed to mount container: %w", err)
	}

	// mountPoint := strings.TrimSpace(string(mountOut))

	// // Copy files
	// logger.LogInfo("Copying files", "mountPoint", mountPoint, "outputPath", outputPath)
	// if err := copyDir(mountPoint, outputPath); err != nil {
	// 	return fmt.Errorf("failed to copy rootfs: %w", err)
	// }

	// // Cleanup
	// logger.LogInfo("Cleaning up", "containerName", containerName)
	// unmountCmd := exec.Command(ib.buildah, "umount", containerName)
	// unmountCmd.Run()
	
	// rmCmd := exec.Command(ib.buildah, "rm", containerName)
	// rmCmd.Run()

	logger.LogInfo("Buildah extraction completed", "outputPath", outputPath)

	return nil
}

// extractWithUmoci extracts an OCI image using umoci
func (ib *ImageBuilder) extractWithUmoci(ociDir, outputPath string) error {
	extracted := filepath.Join(ociDir, "extracted")
	
	// Unpack the OCI archive
	unpackCmd := exec.Command(ib.umociPath, "unpack", "--image", 
		filepath.Join(ociDir, "image.tar"), extracted)
	
	if err := unpackCmd.Run(); err != nil {
		return fmt.Errorf("failed to unpack OCI image: %w", err)
	}

	// Copy rootfs to output path
	rootfsPath := filepath.Join(extracted, "rootfs")
	if err := copyDir(rootfsPath, outputPath); err != nil {
		return fmt.Errorf("failed to copy rootfs: %w", err)
	}

	return nil
}

// extractRootfsManually extracts rootfs without umoci
func (ib *ImageBuilder) extractRootfsManually(ociDir, outputPath, tag string) error {
	// Create a temporary container
	createCmd := exec.Command(ib.podmanPath, "create", tag)
	containerId, err := createCmd.Output()
	if err != nil {
		return fmt.Errorf("failed to create temporary container: %w", err)
	}
	
	id := strings.TrimSpace(string(containerId))
	defer exec.Command(ib.podmanPath, "rm", id).Run()

	// Export container filesystem
	exportCmd := exec.Command(ib.podmanPath, "export", id)
	tarFile, err := os.Create(filepath.Join(ociDir, "fs.tar"))
	if err != nil {
		return fmt.Errorf("failed to create tar file: %w", err)
	}
	defer tarFile.Close()

	exportCmd.Stdout = tarFile
	if err := exportCmd.Run(); err != nil {
		return fmt.Errorf("failed to export container: %w", err)
	}

	// Extract the tar file
	if err := os.MkdirAll(outputPath, 0755); err != nil {
		return fmt.Errorf("failed to create rootfs directory: %w", err)
	}

	extractCmd := exec.Command("tar", "-xf", filepath.Join(ociDir, "fs.tar"), "-C", outputPath)
	if err := extractCmd.Run(); err != nil {
		return fmt.Errorf("failed to extract rootfs: %w", err)
	}

	return nil
}

// ImportImage imports an image from a Docker repository or tar file
func (ib *ImageBuilder) ImportImage(image *models.ContainerImage, pullOptions map[string]string) error {
	// Update image status
	image.IsBuilt = false
	if err := query.SaveRecord(image); err != nil {
		logger.LogError("Failed to update image status: %v", err)
	}

	// Prepare registry path
	var registryPath string
	if image.Registry != "" {
		registryPath = fmt.Sprintf("%s/%s:%s", image.Registry, image.Name, image.Tag)
	} else {
		registryPath = fmt.Sprintf("%s:%s", image.Name, image.Tag)
	}

	// Create output directories
	ociDir := filepath.Join(ib.service.imagesPath, image.Id, "oci")
	rootfsPath := filepath.Join(ib.service.imagesPath, image.Id, "rootfs")
	
	if err := os.MkdirAll(ociDir, 0755); err != nil {
		return fmt.Errorf("failed to create OCI directory: %w", err)
	}
	
	if err := os.MkdirAll(rootfsPath, 0755); err != nil {
		return fmt.Errorf("failed to create rootfs directory: %w", err)
	}

	// Pull the image
	var err error
	if ib.skopeoPath != "" {
		err = ib.pullWithSkopeo(registryPath, ociDir)
	} else if ib.podmanPath != "" {
		err = ib.pullWithPodman(registryPath, ociDir)
	} else {
		return fmt.Errorf("no tools available to pull images")
	}

	if err != nil {
		return err
	}

	// Extract the rootfs
	if ib.umociPath != "" {
		err = ib.extractWithUmoci(ociDir, rootfsPath)
	} else {
		err = ib.extractRootfsManually(ociDir, rootfsPath, registryPath)
	}

	if err != nil {
		return err
	}

	// Update image metadata
	image.ImageSize = getDirSize(rootfsPath)
	image.PullCount = image.PullCount + 1
	image.LastPulled = types.NowDateTime()
	image.IsBuilt = true

	if err := query.SaveRecord(image); err != nil {
		logger.LogError("Failed to update image after import: %v", err)
	}

	return nil
}

// pullWithSkopeo pulls an image using skopeo
func (ib *ImageBuilder) pullWithSkopeo(registryPath, ociDir string) error {
	logger.LogInfo("Pulling image with skopeo: %s", registryPath)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	pullCmd := exec.CommandContext(ctx, ib.skopeoPath, "copy", 
		fmt.Sprintf("docker://%s", registryPath),
		fmt.Sprintf("oci-archive:%s", filepath.Join(ociDir, "image.tar")))
	
	var stderr bytes.Buffer
	pullCmd.Stderr = &stderr

	if err := pullCmd.Run(); err != nil {
		logger.LogError("Skopeo pull failed: %s", stderr.String())
		return fmt.Errorf("skopeo pull failed: %w\nOutput: %s", err, stderr.String())
	}

	return nil
}

// pullWithPodman pulls an image using podman
func (ib *ImageBuilder) pullWithPodman(registryPath, ociDir string) error {
	logger.LogInfo("Pulling image with podman: %s", registryPath)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// Pull the image
	pullCmd := exec.CommandContext(ctx, ib.podmanPath, "pull", registryPath)
	var stderr bytes.Buffer
	pullCmd.Stderr = &stderr

	if err := pullCmd.Run(); err != nil {
		logger.LogError("Podman pull failed: %s", stderr.String())
		return fmt.Errorf("podman pull failed: %w\nOutput: %s", err, stderr.String())
	}

	// Save the image
	saveCmd := exec.Command(ib.podmanPath, "save", "--format", "oci-archive", 
		"-o", filepath.Join(ociDir, "image.tar"), registryPath)
	
	if err := saveCmd.Run(); err != nil {
		return fmt.Errorf("failed to save pulled image: %w", err)
	}

	return nil
}

// copyDir copies a directory recursively
func copyDir(srcDir, dstDir string) error {
	entries, err := os.ReadDir(srcDir)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(srcDir, entry.Name())
		dstPath := filepath.Join(dstDir, entry.Name())

		if entry.IsDir() {
			if err := copyDir(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			if err := copyFile(srcPath, dstPath); err != nil {
				return err
			}
		}
	}

	return nil
}

// copyFile copies a single file
func copyFile(srcFile, dstFile string) error {
	src, err := os.Open(srcFile)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.Create(dstFile)
	if err != nil {
		return err
	}
	defer dst.Close()

	_, err = io.Copy(dst, src)
	if err != nil {
		return err
	}

	// Preserve file mode
	srcInfo, err := os.Stat(srcFile)
	if err != nil {
		return err
	}
	return os.Chmod(dstFile, srcInfo.Mode())
}
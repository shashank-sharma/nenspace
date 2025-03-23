package container

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

// NetworkManager handles container networking
type NetworkManager struct {
	service           *ContainerService
	bridgeName        string
	bridgeSubnet      string
	bridgeGateway     string
	bridgeInterface   string
	managedSubnets    map[string]string
	ipAllocator       *IPAllocator
	iptablesPath      string
	ipPath            string
	bridgeUtilsPath   string
	enabled           bool
	mu                sync.Mutex
	dnsServers        []string
}

// IPAllocator manages IP address allocation for containers
type IPAllocator struct {
	subnet      *net.IPNet
	gateway     net.IP
	allocated   map[string]string // containerID -> IP
	reservedIPs map[string]bool   // IP -> reserved
	mu          sync.Mutex
}

// NewNetworkManager creates a new network manager
func NewNetworkManager(service *ContainerService, bridgeName, subnet string) (*NetworkManager, error) {
	// Find required tools
	iptablesPath, err := exec.LookPath("iptables")
	if err != nil {
		return nil, fmt.Errorf("iptables not found: %w", err)
	}

	ipPath, err := exec.LookPath("ip")
	if err != nil {
		return nil, fmt.Errorf("ip command not found: %w", err)
	}

	bridgeUtilsPath, err := exec.LookPath("brctl")
	if err != nil {
		logger.LogWarning("brctl not found, falling back to ip command for bridge management")
	}

	if bridgeName == "" {
		bridgeName = "cntrbr0"
	}

	if subnet == "" {
		subnet = "172.30.0.0/16"
	}

	// Parse subnet
	_, ipNet, err := net.ParseCIDR(subnet)
	if err != nil {
		return nil, fmt.Errorf("invalid subnet: %w", err)
	}

	// Determine gateway (first IP in subnet)
	gateway := getFirstIPInSubnet(ipNet)

	return &NetworkManager{
		service:        service,
		bridgeName:     bridgeName,
		bridgeSubnet:   subnet,
		bridgeGateway:  gateway.String(),
		managedSubnets: make(map[string]string),
		ipAllocator: &IPAllocator{
			subnet:      ipNet,
			gateway:     gateway,
			allocated:   make(map[string]string),
			reservedIPs: make(map[string]bool),
		},
		iptablesPath:    iptablesPath,
		ipPath:          ipPath,
		bridgeUtilsPath: bridgeUtilsPath,
		dnsServers:      []string{"8.8.8.8", "1.1.1.1"}, // Default DNS servers
		enabled:         true,
	}, nil
}

// SetupBridge sets up the bridge network
func (nm *NetworkManager) SetupBridge() error {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	// Check if bridge exists
	exists, err := nm.bridgeExists()
	if err != nil {
		return err
	}

	if exists {
		logger.LogInfo("Bridge %s already exists", nm.bridgeName)
		return nil
	}

	// Create bridge
	logger.LogInfo("Creating bridge %s with subnet %s", nm.bridgeName, nm.bridgeSubnet)
	
	// Create bridge interface
	createCmd := exec.Command(nm.ipPath, "link", "add", "name", nm.bridgeName, "type", "bridge")
	logger.LogDebug("Create bridge command", "command", createCmd.String())
	if err := createCmd.Run(); err != nil {
		return fmt.Errorf("failed to create bridge: %w", err)
	}

	// Set bridge IP address
	addrCmd := exec.Command(nm.ipPath, "addr", "add", 
		fmt.Sprintf("%s/%s", nm.bridgeGateway, strings.Split(nm.bridgeSubnet, "/")[1]), 
		"dev", nm.bridgeName)
	logger.LogDebug("Set bridge IP command", "command", addrCmd.String())
	if err := addrCmd.Run(); err != nil {
		return fmt.Errorf("failed to set bridge IP: %w", err)
	}

	// Set bridge up
	upCmd := exec.Command(nm.ipPath, "link", "set", nm.bridgeName, "up")
	logger.LogDebug("Set bridge up command", "command", upCmd.String())
	if err := upCmd.Run(); err != nil {
		return fmt.Errorf("failed to set bridge up: %w", err)
	}

	// Enable IP forwarding
	logger.LogDebug("Enabling IP forwarding")
	if err := nm.enableIPForwarding(); err != nil {
		return fmt.Errorf("failed to enable IP forwarding: %w", err)
	}

	// Set up NAT
	logger.LogDebug("Setting up NAT")
	if err := nm.setupNAT(); err != nil {
		return fmt.Errorf("failed to set up NAT: %w", err)
	}

	logger.LogInfo("Bridge %s successfully created", nm.bridgeName)
	return nil
}

// bridgeExists checks if the bridge exists
func (nm *NetworkManager) bridgeExists() (bool, error) {
	cmd := exec.Command(nm.ipPath, "link", "show", nm.bridgeName)
	return cmd.Run() == nil, nil
}

// enableIPForwarding enables IP forwarding
func (nm *NetworkManager) enableIPForwarding() error {
	return os.WriteFile("/proc/sys/net/ipv4/ip_forward", []byte("1"), 0644)
}

// setupNAT sets up NAT for the bridge
func (nm *NetworkManager) setupNAT() error {
	// Check if NAT rule already exists
	checkCmd := exec.Command(nm.iptablesPath, "-t", "nat", "-C", "POSTROUTING", "-s", nm.bridgeSubnet, 
		"!", "-o", nm.bridgeName, "-j", "MASQUERADE")
	
	if checkCmd.Run() != nil {
		// Add NAT rule
		addCmd := exec.Command(nm.iptablesPath, "-t", "nat", "-A", "POSTROUTING", "-s", nm.bridgeSubnet, 
			"!", "-o", nm.bridgeName, "-j", "MASQUERADE")
		
		if err := addCmd.Run(); err != nil {
			return fmt.Errorf("failed to add NAT rule: %w", err)
		}
	}

	// Check if forward rule exists
	checkFwdCmd := exec.Command(nm.iptablesPath, "-C", "FORWARD", "-i", nm.bridgeName, "-j", "ACCEPT")
	
	if checkFwdCmd.Run() != nil {
		// Add forward rule
		addFwdCmd := exec.Command(nm.iptablesPath, "-A", "FORWARD", "-i", nm.bridgeName, "-j", "ACCEPT")
		
		if err := addFwdCmd.Run(); err != nil {
			return fmt.Errorf("failed to add forward rule: %w", err)
		}
	}

	return nil
}

// CleanupBridge removes the bridge network
func (nm *NetworkManager) CleanupBridge() error {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	// Check if bridge exists
	exists, err := nm.bridgeExists()
	if err != nil {
		return err
	}

	if !exists {
		logger.LogInfo("Bridge %s does not exist, nothing to clean up", nm.bridgeName)
		return nil
	}

	// Remove NAT rule
	exec.Command(nm.iptablesPath, "-t", "nat", "-D", "POSTROUTING", "-s", nm.bridgeSubnet, 
		"!", "-o", nm.bridgeName, "-j", "MASQUERADE").Run()

	// Remove forward rule
	exec.Command(nm.iptablesPath, "-D", "FORWARD", "-i", nm.bridgeName, "-j", "ACCEPT").Run()

	// Set bridge down
	exec.Command(nm.ipPath, "link", "set", nm.bridgeName, "down").Run()

	// Remove bridge
	delCmd := exec.Command(nm.ipPath, "link", "delete", nm.bridgeName, "type", "bridge")
	if err := delCmd.Run(); err != nil {
		return fmt.Errorf("failed to delete bridge: %w", err)
	}

	logger.LogInfo("Bridge %s successfully removed", nm.bridgeName)
	return nil
}

// ConnectContainer connects a container to the network
func (nm *NetworkManager) ConnectContainer(containerID string) (string, error) {
	if !nm.enabled {
		return "", fmt.Errorf("networking is disabled")
	}

	nm.mu.Lock()
	defer nm.mu.Unlock()

	// Get container
	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		return "", fmt.Errorf("container not found: %w", err)
	}

	// Allocate IP
	ip, err := nm.ipAllocator.AllocateIP(containerID)
	if err != nil {
		return "", fmt.Errorf("failed to allocate IP: %w", err)
	}

	// Get network namespace path
	nsPath := filepath.Join("/run/netns", containerID)
	
	// Create network namespace symlink for the container
	pidPath := filepath.Join("/proc", strconv.Itoa(getPIDForContainer(containerID)), "ns", "net")
	if err := os.MkdirAll(filepath.Dir(nsPath), 0755); err != nil {
		return "", fmt.Errorf("failed to create netns directory: %w", err)
	}
	if err := os.Symlink(pidPath, nsPath); err != nil {
		return "", fmt.Errorf("failed to create netns symlink: %w", err)
	}

	// Create veth pair
	vethName := fmt.Sprintf("veth%s", containerID[:8])
	vethPeer := fmt.Sprintf("eth0")

	createVethCmd := exec.Command(nm.ipPath, "link", "add", vethName, "type", "veth", "peer", "name", vethPeer)
	if err := createVethCmd.Run(); err != nil {
		return "", fmt.Errorf("failed to create veth pair: %w", err)
	}

	// Add veth to bridge
	addToBridgeCmd := exec.Command(nm.ipPath, "link", "set", vethName, "master", nm.bridgeName)
	if err := addToBridgeCmd.Run(); err != nil {
		return "", fmt.Errorf("failed to add veth to bridge: %w", err)
	}

	// Set veth up
	setVethUpCmd := exec.Command(nm.ipPath, "link", "set", vethName, "up")
	if err := setVethUpCmd.Run(); err != nil {
		return "", fmt.Errorf("failed to set veth up: %w", err)
	}

	// Move peer to container namespace
	movePeerCmd := exec.Command(nm.ipPath, "link", "set", vethPeer, "netns", containerID)
	if err := movePeerCmd.Run(); err != nil {
		return "", fmt.Errorf("failed to move veth peer to container: %w", err)
	}

	// Set peer name to eth0 in container
	setNameCmd := exec.Command(nm.ipPath, "netns", "exec", containerID, nm.ipPath, "link", "set", "dev", vethPeer, "name", "eth0")
	if err := setNameCmd.Run(); err != nil {
		return "", fmt.Errorf("failed to rename interface in container: %w", err)
	}

	// Configure container interface
	configureCmd := exec.Command(nm.ipPath, "netns", "exec", containerID, nm.ipPath, "addr", "add", 
		fmt.Sprintf("%s/24", ip), "dev", "eth0")
	if err := configureCmd.Run(); err != nil {
		return "", fmt.Errorf("failed to configure container IP: %w", err)
	}

	// Set loopback up in container
	setLoCmd := exec.Command(nm.ipPath, "netns", "exec", containerID, nm.ipPath, "link", "set", "lo", "up")
	if err := setLoCmd.Run(); err != nil {
		return "", fmt.Errorf("failed to set loopback up: %w", err)
	}

	// Set container interface up
	setIfaceUpCmd := exec.Command(nm.ipPath, "netns", "exec", containerID, nm.ipPath, "link", "set", "eth0", "up")
	if err := setIfaceUpCmd.Run(); err != nil {
		return "", fmt.Errorf("failed to set container interface up: %w", err)
	}

	// Add default route in container
	addRouteCmd := exec.Command(nm.ipPath, "netns", "exec", containerID, nm.ipPath, "route", "add", "default", "via", nm.bridgeGateway)
	if err := addRouteCmd.Run(); err != nil {
		return "", fmt.Errorf("failed to add default route: %w", err)
	}

	// Configure DNS
	if err := nm.configureDNS(containerID); err != nil {
		logger.LogWarning("Failed to configure DNS: %v", err)
	}

	// Save IP in container record
	container.IPAddress = ip
	
	// Get port mappings
	var portMappings []string
	if container.Network != nil {
		var networkConfig ContainerNetworkConfig
		if err := json.Unmarshal(container.Network, &networkConfig); err == nil {
			portMappings = networkConfig.Ports
		}
	}

	// Set up port forwarding
	for _, portMapping := range portMappings {
		parts := strings.Split(portMapping, ":")
		if len(parts) != 2 {
			continue
		}
		
		hostPort := parts[0]
		containerPort := parts[1]
		
		// Handle protocol
		proto := "tcp"
		if strings.Contains(containerPort, "/") {
			portProto := strings.Split(containerPort, "/")
			containerPort = portProto[0]
			if len(portProto) > 1 {
				proto = portProto[1]
			}
		}
		
		if err := nm.addPortForwarding(hostPort, containerPort, ip, proto); err != nil {
			logger.LogWarning("Failed to set up port forwarding %s:%s: %v", hostPort, containerPort, err)
		}
	}
	
	if err := query.SaveRecord(container); err != nil {
		logger.LogError("Failed to update container: %v", err)
	}

	return ip, nil
}

// addPortForwarding adds port forwarding for a container
func (nm *NetworkManager) addPortForwarding(hostPort, containerPort, containerIP, proto string) error {
	// Check if rule exists
	checkCmd := exec.Command(nm.iptablesPath, "-t", "nat", "-C", "PREROUTING", "-p", proto, 
		"--dport", hostPort, "-j", "DNAT", "--to-destination", fmt.Sprintf("%s:%s", containerIP, containerPort))
	
	if checkCmd.Run() != nil {
		// Add rule
		addCmd := exec.Command(nm.iptablesPath, "-t", "nat", "-A", "PREROUTING", "-p", proto, 
			"--dport", hostPort, "-j", "DNAT", "--to-destination", fmt.Sprintf("%s:%s", containerIP, containerPort))
		
		if err := addCmd.Run(); err != nil {
			return fmt.Errorf("failed to add port forwarding rule: %w", err)
		}
	}

	// Also add to OUTPUT chain for local connections
	checkOutputCmd := exec.Command(nm.iptablesPath, "-t", "nat", "-C", "OUTPUT", "-p", proto, 
		"--dport", hostPort, "-j", "DNAT", "--to-destination", fmt.Sprintf("%s:%s", containerIP, containerPort))
	
	if checkOutputCmd.Run() != nil {
		addOutputCmd := exec.Command(nm.iptablesPath, "-t", "nat", "-A", "OUTPUT", "-p", proto, 
			"--dport", hostPort, "-j", "DNAT", "--to-destination", fmt.Sprintf("%s:%s", containerIP, containerPort))
		
		if err := addOutputCmd.Run(); err != nil {
			return fmt.Errorf("failed to add output port forwarding rule: %w", err)
		}
	}

	return nil
}

// removePortForwarding removes port forwarding for a container
func (nm *NetworkManager) removePortForwarding(hostPort, containerPort, containerIP, proto string) error {
	// Remove PREROUTING rule
	exec.Command(nm.iptablesPath, "-t", "nat", "-D", "PREROUTING", "-p", proto, 
		"--dport", hostPort, "-j", "DNAT", "--to-destination", fmt.Sprintf("%s:%s", containerIP, containerPort)).Run()

	// Remove OUTPUT rule
	exec.Command(nm.iptablesPath, "-t", "nat", "-D", "OUTPUT", "-p", proto, 
		"--dport", hostPort, "-j", "DNAT", "--to-destination", fmt.Sprintf("%s:%s", containerIP, containerPort)).Run()

	return nil
}

// DisconnectContainer disconnects a container from the network
func (nm *NetworkManager) DisconnectContainer(containerID string) error {
	if !nm.enabled {
		return nil
	}

	nm.mu.Lock()
	defer nm.mu.Unlock()

	// Get container
	container, err := query.FindById[*models.Container](containerID)
	if err != nil {
		return fmt.Errorf("container not found: %w", err)
	}

	// Get IP
	ip := container.IPAddress
	if ip == "" {
		return fmt.Errorf("container has no IP address")
	}

	// Remove port forwarding
	var portMappings []string
	if container.Network != nil {
		var networkConfig ContainerNetworkConfig
		if err := json.Unmarshal(container.Network, &networkConfig); err == nil {
			portMappings = networkConfig.Ports
		}
	}

	for _, portMapping := range portMappings {
		parts := strings.Split(portMapping, ":")
		if len(parts) != 2 {
			continue
		}
		
		hostPort := parts[0]
		containerPort := parts[1]
		
		// Handle protocol
		proto := "tcp"
		if strings.Contains(containerPort, "/") {
			portProto := strings.Split(containerPort, "/")
			containerPort = portProto[0]
			if len(portProto) > 1 {
				proto = portProto[1]
			}
		}
		
		nm.removePortForwarding(hostPort, containerPort, ip, proto)
	}

	// Remove veth interface
	vethName := fmt.Sprintf("veth%s", containerID[:8])
	exec.Command(nm.ipPath, "link", "delete", vethName).Run()

	// Remove network namespace
	nsPath := filepath.Join("/run/netns", containerID)
	os.Remove(nsPath)

	// Release IP
	nm.ipAllocator.ReleaseIP(containerID)

	// Update container record
	container.IPAddress = ""
	if err := query.SaveRecord(container); err != nil {
		logger.LogError("Failed to update container: %v", err)
	}

	return nil
}

// configureDNS configures DNS for a container
func (nm *NetworkManager) configureDNS(containerID string) error {
	// Create resolv.conf in container
	resolvConf := fmt.Sprintf("# Generated by container service\n")
	for _, server := range nm.dnsServers {
		resolvConf += fmt.Sprintf("nameserver %s\n", server)
	}
	resolvConf += "options ndots:1\n"

	// Write to container's resolv.conf
	rootfsPath := filepath.Join(nm.service.containersPath, containerID, "rootfs")
	resolvPath := filepath.Join(rootfsPath, "etc", "resolv.conf")
	
	if err := os.MkdirAll(filepath.Dir(resolvPath), 0755); err != nil {
		return fmt.Errorf("failed to create resolv.conf directory: %w", err)
	}
	
	return os.WriteFile(resolvPath, []byte(resolvConf), 0644)
}

// getPIDForContainer returns the PID for a container
func getPIDForContainer(containerID string) int {
	// Use runc state to get PID
	cmd := exec.Command("runc", "state", containerID)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return -1
	}

	var state map[string]interface{}
	if err := json.Unmarshal(output, &state); err != nil {
		return -1
	}

	if pid, ok := state["pid"].(float64); ok {
		return int(pid)
	}

	return -1
}

// AllocateIP allocates an IP address for a container
func (a *IPAllocator) AllocateIP(containerID string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	// Check if container already has an IP
	if ip, ok := a.allocated[containerID]; ok {
		return ip, nil
	}

	// Find an available IP
	ip := a.findAvailableIP()
	if ip == nil {
		return "", fmt.Errorf("no available IP addresses")
	}

	ipStr := ip.String()
	a.allocated[containerID] = ipStr
	a.reservedIPs[ipStr] = true

	return ipStr, nil
}

// ReleaseIP releases an IP address
func (a *IPAllocator) ReleaseIP(containerID string) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if ip, ok := a.allocated[containerID]; ok {
		delete(a.allocated, containerID)
		delete(a.reservedIPs, ip)
	}
}

// findAvailableIP finds an available IP address in the subnet
func (a *IPAllocator) findAvailableIP() net.IP {
	// Start from the third IP in the subnet (skip network and gateway)
	ip := getFirstIPInSubnet(a.subnet)
	ip[3] += 2 // Start from .3

	// Iterate until we find an available IP
	for {
		// Check if we're still in the subnet
		if !a.subnet.Contains(ip) {
			return nil
		}

		// Check if IP is already allocated
		if !a.reservedIPs[ip.String()] {
			// Found an available IP
			return copyIP(ip)
		}

		// Increment IP
		incrementIP(ip)
	}
}

// getFirstIPInSubnet returns the first IP in a subnet
func getFirstIPInSubnet(ipNet *net.IPNet) net.IP {
	ip := copyIP(ipNet.IP)
	for i := range ip {
		ip[i] &= ipNet.Mask[i]
	}
	return ip
}

// incrementIP increments an IP address
func incrementIP(ip net.IP) {
	for i := len(ip) - 1; i >= 0; i-- {
		ip[i]++
		if ip[i] > 0 {
			break
		}
	}
}

// copyIP makes a copy of an IP
func copyIP(ip net.IP) net.IP {
	dup := make(net.IP, len(ip))
	copy(dup, ip)
	return dup
}
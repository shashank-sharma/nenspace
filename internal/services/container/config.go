package container

var DefaultAppContainerConfig = ContainerConfig{
	EnableAutostart:    true,
	StatsInterval:      60,
	MaxLogs:            1000,
	DefaultCPUShare:    1024,
	DefaultMemoryMB:    512,
	EnableNetworking:   true,
	NetworkBridge:      "bridge",
	StoragePath:        "./container_data",
	DisablePrivileged:  true,
}
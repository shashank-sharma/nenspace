package routes

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/credentials"
	"github.com/shashank-sharma/backend/internal/util"
	"golang.org/x/crypto/ssh"
)

type SSHConnectionManager struct {
	connections      map[string]*SSHConnection
	mu               sync.Mutex
	connectionExpiry time.Duration
}

type SSHConnection struct {
	ID            string
	ServerID      string
	UserID        string
	Client        *ssh.Client
	Session       *ssh.Session
	LastUsed      time.Time
	StdoutChannel chan []byte
	StderrChannel chan []byte
	CommandBuf    string
	StdinPipe     io.WriteCloser
	Interactive   bool
}

func NewSSHConnectionManager() *SSHConnectionManager {
	manager := &SSHConnectionManager{
		connections:      make(map[string]*SSHConnection),
		connectionExpiry: 5 * time.Minute,
	}

	go manager.cleanupExpiredConnections()

	return manager
}

func (m *SSHConnectionManager) cleanupExpiredConnections() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		m.mu.Lock()
		now := time.Now()
		for id, conn := range m.connections {
			if now.Sub(conn.LastUsed) > m.connectionExpiry {
				conn.Client.Close()
				delete(m.connections, id)
			}
		}
		m.mu.Unlock()
	}
}

func generateConnectionID() string {
	return fmt.Sprintf("conn-%d", time.Now().UnixNano())
}

var connectionManager *SSHConnectionManager

func RegisterSSHRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string) {
	sshRouter := apiRouter.Group(path)
	if connectionManager == nil {
		connectionManager = NewSSHConnectionManager()
	}

	RegisterKeyGenerationRoute(sshRouter, "/security-keys")
	RegisterSSHWebSocketRoutes(sshRouter)

	// Register route to connect to a server
	sshRouter.POST("/connect", func(c *core.RequestEvent) error {
		token := c.Request.Header.Get("Authorization")

		tokenPrefix := ""
		if len(token) > 10 {
			tokenPrefix = token[:10] + "..."
		} else if len(token) > 0 {
			tokenPrefix = token + "..."
		} else {
			tokenPrefix = "(empty)"
		}

		logger.LogInfo("Server connect request received", "tokenPrefix", tokenPrefix)

		userID, err := getUserIDFromToken(token)
		if err != nil {
			logger.LogError("Server connect authentication failed", "error", err)
			return c.JSON(http.StatusUnauthorized, map[string]interface{}{
				"message": "Not authenticated",
			})
		}

		logger.LogInfo("Server connect authentication successful", "userID", userID)

		var requestData struct {
			ServerID string `json:"server_id"`
		}
		if err := json.NewDecoder(c.Request.Body).Decode(&requestData); err != nil {
			logger.LogError("Server connect invalid request body", "error", err)
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"message": "Invalid request body",
			})
		}

		logger.LogInfo("Server connect request parsed", "serverID", requestData.ServerID)

		server, key, err := getServerAndKey(c, requestData.ServerID)
		if err != nil {
			logger.LogError("Server connect failed to get server and key", "error", err, "serverID", requestData.ServerID)
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"message": err.Error(),
			})
		}

		logger.LogInfo("Server and key retrieved successfully",
			"serverID", requestData.ServerID,
			"serverName", server["name"],
			"keyID", key["id"],
			"keyName", key["name"])

		logger.LogInfo("Parsing private key", "keyName", key["name"])
		privateKey := strings.TrimSpace(key["private_key"].(string))
		signer, err := ssh.ParsePrivateKey([]byte(privateKey))
		if err != nil {
			logger.LogError("Failed to parse private key", "error", err, "keyID", key["id"])
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{
				"message": "Failed to parse private key: " + err.Error(),
			})
		}

		logger.LogInfo("Private key parsed successfully", "keyName", key["name"])

		config := &ssh.ClientConfig{
			User: server["username"].(string),
			Auth: []ssh.AuthMethod{
				ssh.PublicKeys(signer),
			},
			HostKeyCallback: ssh.InsecureIgnoreHostKey(), // For development only
			Timeout:         10 * time.Second,
		}

		addr := fmt.Sprintf("%s:%d", server["ip"].(string), server["port"])
		logger.LogInfo("Connecting to server", "address", addr, "username", server["username"])

		startTime := time.Now()
		client, err := ssh.Dial("tcp", addr, config)
		responseTime := time.Since(startTime)

		securityKeyID := key["id"].(string)
		event := &credentials.UsageEvent{
			CredentialType: "security_key",
			CredentialID:   securityKeyID,
			UserID:         userID,
			Service:        "ssh",
			Endpoint:       addr,
			Method:         "SSH_CONNECT",
			StatusCode:     200,
			ResponseTimeMs: responseTime.Milliseconds(),
			Timestamp:      startTime,
			Metadata: map[string]interface{}{
				"server_id":   requestData.ServerID,
				"server_name": server["name"],
				"username":    server["username"],
			},
		}

		if err != nil {
			event.StatusCode = 0
			event.ErrorType = "connection_error"
			event.ErrorMessage = err.Error()
			logger.LogError("Failed to connect to server", "error", err, "address", addr)
			_ = credentials.TrackUsageDirect(c.Request.Context(), event)
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"message": fmt.Sprintf("Failed to connect to %s: %v", addr, err),
			})
		}

		_ = credentials.TrackUsageDirect(c.Request.Context(), event)
		logger.LogInfo("SSH connection established successfully", "address", addr)

		connID := generateConnectionID()

		logger.LogInfo("Creating SSH connection object", "connectionID", connID)
		conn := &SSHConnection{
			ID:            connID,
			ServerID:      requestData.ServerID,
			UserID:        userID,
			Client:        client,
			LastUsed:      time.Now(),
			StdoutChannel: make(chan []byte, 100),
			StderrChannel: make(chan []byte, 100),
			CommandBuf:    "",
			Interactive:   true,
		}

		connectionManager.mu.Lock()
		connectionManager.connections[connID] = conn
		connectionManager.mu.Unlock()

		logger.LogInfo("SSH connection stored successfully", "connectionID", connID)

		return c.JSON(http.StatusOK, map[string]interface{}{
			"connection_id": connID,
			"server_name":   server["name"],
		})
	})

	sshRouter.POST("/execute", func(c *core.RequestEvent) error {
		token := c.Request.Header.Get("Authorization")
		userID, err := getUserIDFromToken(token)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]interface{}{
				"message": "Not authenticated",
			})
		}

		var requestData struct {
			ConnectionID string `json:"connection_id"`
			Command      string `json:"command"`
		}
		if err := json.NewDecoder(c.Request.Body).Decode(&requestData); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"message": "Invalid request body",
			})
		}

		connectionManager.mu.Lock()
		conn, exists := connectionManager.connections[requestData.ConnectionID]
		if !exists {
			connectionManager.mu.Unlock()
			return c.JSON(http.StatusNotFound, map[string]interface{}{
				"message": "Connection not found or expired",
			})
		}

		if conn.UserID != userID {
			connectionManager.mu.Unlock()
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"message": "Not authorized to use this connection",
			})
		}

		conn.LastUsed = time.Now()

		if conn.Interactive && conn.StdinPipe != nil && conn.Session != nil {
			_, err := conn.StdinPipe.Write([]byte(requestData.Command))
			connectionManager.mu.Unlock()

			if err != nil {
				logger.LogError("Failed to write to shell stdin", "error", err)
				return c.JSON(http.StatusInternalServerError, map[string]interface{}{
					"message": "Failed to send command to shell: " + err.Error(),
				})
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"status": "sent",
			})
		}

		connectionManager.mu.Unlock()

		logger.LogInfo("No interactive shell for connection, using fallback method", "connectionID", requestData.ConnectionID)

		SendOutputToListeners(requestData.ConnectionID, []byte(requestData.Command))

		session, err := conn.Client.NewSession()
		if err != nil {
			SendOutputToListeners(requestData.ConnectionID, []byte("\r\n\x1B[31mFailed to create session: "+err.Error()+"\x1B[0m\r\n"))
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{
				"message": "Failed to create session: " + err.Error(),
			})
		}
		defer session.Close()

		// Request a pseudo-terminal (PTY) for better command output
		// Standard terminal dimensions: 80 columns, 24 rows
		if err := session.RequestPty("xterm", 80, 24, ssh.TerminalModes{
			ssh.ECHO:          1,     // Enable echoing
			ssh.TTY_OP_ISPEED: 14400, // Input speed = 14.4kbaud
			ssh.TTY_OP_OSPEED: 14400, // Output speed = 14.4kbaud
		}); err != nil {
			SendOutputToListeners(requestData.ConnectionID, []byte("\r\n\x1B[31mFailed to request PTY: "+err.Error()+"\x1B[0m\r\n"))
			logger.LogError("Failed to request PTY", "error", err)
		}

		stdout, err := session.StdoutPipe()
		if err != nil {
			SendOutputToListeners(requestData.ConnectionID, []byte("\r\n\x1B[31mFailed to get stdout pipe: "+err.Error()+"\x1B[0m\r\n"))
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{
				"message": "Failed to get stdout pipe: " + err.Error(),
			})
		}

		stderr, err := session.StderrPipe()
		if err != nil {
			SendOutputToListeners(requestData.ConnectionID, []byte("\r\n\x1B[31mFailed to get stderr pipe: "+err.Error()+"\x1B[0m\r\n"))
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{
				"message": "Failed to get stderr pipe: " + err.Error(),
			})
		}

		// Track command execution
		_, key, _ := getServerAndKey(c, conn.ServerID)
		if key != nil {
			securityKeyID := key["id"].(string)
			startTime := time.Now()

			err = session.Start(requestData.Command)
			responseTime := time.Since(startTime)

			event := &credentials.UsageEvent{
				CredentialType: "security_key",
				CredentialID:   securityKeyID,
				UserID:         userID,
				Service:        "ssh",
				Endpoint:       conn.ServerID,
				Method:         "SSH_EXECUTE",
				StatusCode:     200,
				ResponseTimeMs: responseTime.Milliseconds(),
				Timestamp:      startTime,
				Metadata: map[string]interface{}{
					"server_id": conn.ServerID,
					"command":   requestData.Command,
				},
			}

			if err != nil {
				event.StatusCode = 0
				event.ErrorType = "execution_error"
				event.ErrorMessage = err.Error()
			}

			_ = credentials.TrackUsageDirect(c.Request.Context(), event)
		} else {
			err = session.Start(requestData.Command)
		}

		if err != nil {
			SendOutputToListeners(requestData.ConnectionID, []byte("\r\n\x1B[31mFailed to start command: "+err.Error()+"\x1B[0m\r\n"))
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{
				"message": "Failed to start command: " + err.Error(),
			})
		}

		// Read from stdout and stderr and send to WebSocket clients
		var outputReceived sync.WaitGroup
		outputReceived.Add(2)

		go func() {
			defer outputReceived.Done()
			buf := make([]byte, 1024)
			for {
				n, err := stdout.Read(buf)
				if err != nil {
					break
				}
				if n > 0 {
					SendOutputToListeners(requestData.ConnectionID, buf[:n])
				}
			}
		}()

		go func() {
			defer outputReceived.Done()
			buf := make([]byte, 1024)
			for {
				n, err := stderr.Read(buf)
				if err != nil {
					break
				}
				if n > 0 {
					SendOutputToListeners(requestData.ConnectionID, buf[:n])
				}
			}
		}()

		go func() {
			// Wait for command to finish
			err := session.Wait()
			outputReceived.Wait()

			if err != nil {
				exitErr, ok := err.(*ssh.ExitError)
				if ok {
					// Don't show error for HUP signals (happens when terminal closes normally)
					if exitErr.Signal() != "HUP" {
						SendOutputToListeners(requestData.ConnectionID, []byte(fmt.Sprintf("\r\nCommand exited with status %d\r\n", exitErr.ExitStatus())))
					}
				} else {
					// For other errors, show the error message
					SendOutputToListeners(requestData.ConnectionID, []byte(fmt.Sprintf("\r\n\x1B[31mCommand failed: %s\x1B[0m\r\n", err.Error())))
				}
			}

			// Send a new prompt
			// Create a new session to get the prompt
			promptSession, err := conn.Client.NewSession()
			if err != nil {
				SendOutputToListeners(requestData.ConnectionID, []byte("\r\n$ "))
				return
			}
			defer promptSession.Close()

			promptOutput, err := promptSession.CombinedOutput("echo -n \"$(whoami)@$(hostname):$(pwd)$ \"")
			if err != nil {
				SendOutputToListeners(requestData.ConnectionID, []byte("\r\n$ "))
				return
			}

			SendOutputToListeners(requestData.ConnectionID, []byte("\r\n"+string(promptOutput)))
		}()

		return c.JSON(http.StatusOK, map[string]interface{}{
			"status": "executing",
		})
	})

	// Register route to disconnect from a server
	sshRouter.POST("/disconnect", func(c *core.RequestEvent) error {
		token := c.Request.Header.Get("Authorization")
		userID, err := getUserIDFromToken(token)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]interface{}{
				"message": "Not authenticated",
			})
		}

		var requestData struct {
			ConnectionID string `json:"connection_id"`
		}
		if err := json.NewDecoder(c.Request.Body).Decode(&requestData); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"message": "Invalid request body",
			})
		}

		connectionManager.mu.Lock()
		conn, exists := connectionManager.connections[requestData.ConnectionID]
		if !exists {
			connectionManager.mu.Unlock()
			return c.JSON(http.StatusNotFound, map[string]interface{}{
				"message": "Connection not found",
			})
		}

		if conn.UserID != userID {
			connectionManager.mu.Unlock()
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"message": "Not authorized to disconnect this connection",
			})
		}

		if conn.Session != nil {
			conn.Session.Close()
		}
		if conn.Client != nil {
			conn.Client.Close()
		}

		delete(connectionManager.connections, requestData.ConnectionID)
		connectionManager.mu.Unlock()

		return c.JSON(http.StatusOK, map[string]interface{}{
			"status": "disconnected",
		})
	})

	// Register route for keep-alive pings
	// This endpoint handles both HTTP pings from the frontend and serves as a fallback
	// for WebSocket ping messages when WebSockets aren't available
	sshRouter.POST("/ping", func(c *core.RequestEvent) error {
		token := c.Request.Header.Get("Authorization")
		userID, err := getUserIDFromToken(token)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]interface{}{
				"message": "Not authenticated",
			})
		}

		var requestData struct {
			ConnectionID string `json:"connection_id"`
		}
		if err := json.NewDecoder(c.Request.Body).Decode(&requestData); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"message": "Invalid request body",
			})
		}

		connectionManager.mu.Lock()
		conn, exists := connectionManager.connections[requestData.ConnectionID]
		if !exists {
			connectionManager.mu.Unlock()
			return c.JSON(http.StatusNotFound, map[string]interface{}{
				"message": "Connection not found",
			})
		}

		if conn.UserID != userID {
			connectionManager.mu.Unlock()
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"message": "Not authorized to use this connection",
			})
		}

		conn.LastUsed = time.Now()
		connectionManager.mu.Unlock()

		return c.JSON(http.StatusOK, map[string]interface{}{
			"status": "ok",
			"time":   time.Now().UnixMilli(),
		})
	})

	// Register route for terminal resize events
	// This is the centralized endpoint for terminal resize operations
	sshRouter.POST("/resize", func(c *core.RequestEvent) error {
		token := c.Request.Header.Get("Authorization")
		userID, err := getUserIDFromToken(token)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]interface{}{
				"message": "Not authenticated",
			})
		}

		var requestData struct {
			ConnectionID string `json:"connection_id"`
			Cols         int    `json:"cols"`
			Rows         int    `json:"rows"`
		}
		if err := json.NewDecoder(c.Request.Body).Decode(&requestData); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"message": "Invalid request body",
			})
		}

		if requestData.Cols <= 0 || requestData.Rows <= 0 {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"message": "Invalid terminal dimensions",
				"details": fmt.Sprintf("Received cols=%d, rows=%d. Both must be positive values.", requestData.Cols, requestData.Rows),
			})
		}

		connectionManager.mu.Lock()
		conn, exists := connectionManager.connections[requestData.ConnectionID]
		if !exists {
			connectionManager.mu.Unlock()
			return c.JSON(http.StatusNotFound, map[string]interface{}{
				"message": "Connection not found",
			})
		}

		if conn.UserID != userID {
			connectionManager.mu.Unlock()
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"message": "Not authorized to use this connection",
			})
		}

		conn.LastUsed = time.Now()

		resizeError := ""
		if conn.Session != nil {
			err = conn.Session.WindowChange(requestData.Rows, requestData.Cols)
			if err != nil {
				resizeError = err.Error()
				logger.LogInfo("Failed to resize terminal window",
					"error", err,
					"connectionID", requestData.ConnectionID,
					"cols", requestData.Cols,
					"rows", requestData.Rows)
			} else {
				logger.LogInfo("Terminal resized successfully",
					"connectionID", requestData.ConnectionID,
					"cols", requestData.Cols,
					"rows", requestData.Rows)
			}
		} else {
			resizeError = "No active session for this connection"
			logger.LogInfo("Cannot resize terminal - no active session",
				"connectionID", requestData.ConnectionID)
		}

		connectionManager.mu.Unlock()

		response := map[string]interface{}{
			"status": "ok",
			"cols":   requestData.Cols,
			"rows":   requestData.Rows,
		}

		if resizeError != "" {
			response["warning"] = resizeError
		}

		return c.JSON(http.StatusOK, response)
	})
}

func getUserIDFromToken(token string) (string, error) {
	return util.GetUserId(token)
}

func getServerAndKey(c *core.RequestEvent, serverID string) (map[string]interface{}, map[string]interface{}, error) {
	server, err := query.FindById[*models.Server](serverID)
	if err != nil {
		return nil, nil, fmt.Errorf("server not found: %w", err)
	}

	if server.SecurityKey == "" {
		return nil, nil, fmt.Errorf("server has no security key configured")
	}

	securityKey, err := query.FindById[*models.SecurityKey](server.SecurityKey)
	if err != nil {
		return nil, nil, fmt.Errorf("security key not found: %w", err)
	}

	if !securityKey.IsActive {
		return nil, nil, fmt.Errorf("security key is inactive")
	}

	serverMap := map[string]interface{}{
		"id":           server.Id,
		"name":         server.Name,
		"ip":           server.IP,
		"port":         server.Port,
		"username":     server.Username,
		"security_key": server.SecurityKey,
		"ssh_enabled":  server.SSHEnabled,
		"is_active":    server.IsActive,
		"is_reachable": server.IsReachable,
	}

	securityKeyMap := map[string]interface{}{
		"id":          securityKey.Id,
		"name":        securityKey.Name,
		"description": securityKey.Description,
		"private_key": securityKey.PrivateKey,
		"public_key":  securityKey.PublicKey,
		"is_active":   securityKey.IsActive,
	}

	return serverMap, securityKeyMap, nil
}

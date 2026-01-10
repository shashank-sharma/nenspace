package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/shashank-sharma/mcp-server-pocketbase/internal/config"
	"github.com/shashank-sharma/mcp-server-pocketbase/internal/pocketbase"
	"github.com/shashank-sharma/mcp-server-pocketbase/internal/tools"
)

func main() {
	log.SetOutput(os.Stderr)

	cfg := config.Load()
	pbClient := pocketbase.NewClient(cfg.PocketBaseURL, cfg.HTTPTimeout)

	server := mcp.NewServer(&mcp.Implementation{
		Name:    "pocketbase-mcp",
		Version: "v1.0.0",
	}, nil)

	tools.RegisterAuthTools(server, pbClient)
	tools.RegisterSchemaTools(server, pbClient)
	tools.RegisterRecordTools(server, pbClient)
	tools.RegisterFileTools(server, pbClient)

	if cfg.DefaultToken != "" {
		pbClient.SetDefaultToken(cfg.DefaultToken)
		log.Printf("Using provided POCKETBASE_TOKEN as fallback")
	}

	if cfg.AdminEmail != "" && cfg.AdminPassword != "" {
		log.Printf("Attempting auto-login for %s...", cfg.AdminEmail)
		resp, err := pbClient.AuthWithPassword(context.Background(), cfg.AdminEmail, cfg.AdminPassword)
		if err != nil {
			log.Printf("Warning: Auto-login failed: %v", err)
		} else {
			pbClient.SetDefaultToken(resp.Token)
			log.Printf("Auto-login successful")
		}
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	log.Printf("Starting PocketBase MCP server connecting to %s", cfg.PocketBaseURL)

	if err := server.Run(ctx, &mcp.StdioTransport{}); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

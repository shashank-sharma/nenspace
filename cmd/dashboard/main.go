package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/shashank-sharma/backend/internal/app"
	"github.com/shashank-sharma/backend/internal/config"
	_ "github.com/shashank-sharma/backend/migrations"
)

func showUsage() {
	fmt.Fprintf(os.Stderr, "Usage: %s [COMMAND] [OPTIONS]\n", os.Args[0])
	fmt.Fprintf(os.Stderr, "\n")
	fmt.Fprintf(os.Stderr, "This application is a backend service with configurable options.\n")
	fmt.Fprintf(os.Stderr, "\n")
	fmt.Fprintf(os.Stderr, "Commands:\n")
	fmt.Fprintf(os.Stderr, "  serve     Start the server\n")
	fmt.Fprintf(os.Stderr, "  migrate   Run database migrations\n")
	fmt.Fprintf(os.Stderr, "\n")
	fmt.Fprintf(os.Stderr, "Options:\n")
	fmt.Fprintf(os.Stderr, "  -metrics         Enable metrics\n")
	fmt.Fprintf(os.Stderr, "  -file-logging    Enable file logging\n")
	fmt.Fprintf(os.Stderr, "  -with-gui        Enable GUI\n")
	fmt.Fprintf(os.Stderr, "  -dev             Run in development mode\n")
	fmt.Fprintf(os.Stderr, "  -http-addr       HTTP address to listen on (default: 0.0.0.0:8090)\n")
	fmt.Fprintf(os.Stderr, "\n")
	fmt.Fprintf(os.Stderr, "Examples:\n")
	fmt.Fprintf(os.Stderr, "  Run in production mode: %s serve\n", os.Args[0])
	fmt.Fprintf(os.Stderr, "  Run in development mode: %s serve -dev\n", os.Args[0])
	fmt.Fprintf(os.Stderr, "  Run with GUI and metrics: %s serve -with-gui -metrics\n", os.Args[0])
	fmt.Fprintf(os.Stderr, "  Run on a custom port: %s serve -http-addr 0.0.0.0:9000\n", os.Args[0])
}

func parseCommandFlags(args []string) (config.ConfigFlags, error) {
	cmdFlags := flag.NewFlagSet("command", flag.ContinueOnError)

	metrics := cmdFlags.Bool("metrics", false, "Enable metrics")
	fileLogging := cmdFlags.Bool("file-logging", false, "Enable file logging")
	withGui := cmdFlags.Bool("with-gui", false, "Enable GUI")
	dev := cmdFlags.Bool("dev", false, "Run in development mode")
	httpAddr := cmdFlags.String("http-addr", "0.0.0.0:8090", "HTTP address to listen on")

	if err := cmdFlags.Parse(args); err != nil {
		return config.ConfigFlags{}, err
	}

	return config.ConfigFlags{
		Metrics:     *metrics,
		FileLogging: *fileLogging,
		WithGui:     *withGui,
		Dev:         *dev,
		HttpAddr:    *httpAddr,
	}, nil
}

func main() {
	if len(os.Args) < 2 {
		showUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "serve":
		config, err := parseCommandFlags(os.Args[2:])
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing flags: %v\n", err)
			showUsage()
			os.Exit(1)
		}

		application, err := app.New(config)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to create application: %v\n", err)
			os.Exit(1)
		}

		migratecmd.MustRegister(application.Pb, application.Pb.RootCmd, migratecmd.Config{
			Automigrate: strings.HasPrefix(os.Args[0], os.TempDir()),
		})

		if err := application.Start(config.HttpAddr); err != nil {
			fmt.Println("Failed to start application", "error", err)
			os.Exit(1)
		}

	case "migrate":
		config, err := parseCommandFlags(os.Args[2:])
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing flags: %v\n", err)
			showUsage()
			os.Exit(1)
		}

		application, err := app.New(config)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to create application: %v\n", err)
			os.Exit(1)
		}

		migratecmd.MustRegister(application.Pb, application.Pb.RootCmd, migratecmd.Config{
			Automigrate: strings.HasPrefix(os.Args[0], os.TempDir()),
		})

		fmt.Println("Running migration...")
		application.Pb.Start()

	case "-h", "--help", "help":
		showUsage()

	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", command)
		showUsage()
		os.Exit(1)
	}
}

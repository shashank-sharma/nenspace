package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/config"
	"github.com/shashank-sharma/backend/internal/cronjobs"
	"github.com/shashank-sharma/backend/internal/gui"
	"github.com/shashank-sharma/backend/internal/hooks"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/metrics"
	"github.com/shashank-sharma/backend/internal/middleware"
	"github.com/shashank-sharma/backend/internal/routes"
	"github.com/shashank-sharma/backend/internal/services"
	"github.com/shashank-sharma/backend/internal/services/ai"
	"github.com/shashank-sharma/backend/internal/services/calendar"
	"github.com/shashank-sharma/backend/internal/services/container"
	"github.com/shashank-sharma/backend/internal/services/credentials"
	"github.com/shashank-sharma/backend/internal/services/feed"
	"github.com/shashank-sharma/backend/internal/services/fold"
	"github.com/shashank-sharma/backend/internal/services/journal"
	"github.com/shashank-sharma/backend/internal/services/logging"
	"github.com/shashank-sharma/backend/internal/services/mail"
	"github.com/shashank-sharma/backend/internal/services/memorysystem"
	"github.com/shashank-sharma/backend/internal/services/music"
	"github.com/shashank-sharma/backend/internal/services/providers"
	"github.com/shashank-sharma/backend/internal/services/search"
	"github.com/shashank-sharma/backend/internal/services/weather"
	"github.com/shashank-sharma/backend/internal/services/workflow"
	"github.com/shashank-sharma/backend/internal/store"
)

// Application encapsulates all application components and services
type Application struct {
	Server           *http.Server
	Pb               *pocketbase.PocketBase
	FoldService      *fold.FoldService
	CalendarService  *calendar.CalendarService
	MailService      *mail.MailService
	WorkflowEngine   *workflow.WorkflowEngine
	FeedService      *services.FeedService
	ContainerService *container.ContainerService
	SearchService    *search.FullTextSearchService
	WeatherService   *weather.WeatherService
	JournalService   *journal.JournalService
	MusicService     *music.MusicService
	LoggingService   *logging.LoggingService
	postInitHooks    []func()
}

// New creates and initializes a new Application instance
func New(configFlags config.ConfigFlags) (*Application, error) {
	pb := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir:  "./pb_data",
		HideStartBanner: false,
		DefaultDev:      configFlags.Dev,
	})

	store.InitApp(pb)
	if err := config.Init(pb, configFlags); err != nil {
		return nil, fmt.Errorf("failed to initialize configuration: %w", err)
	}

	app := &Application{
		Pb:            pb,
		postInitHooks: make([]func(), 0),
	}

	app.AddPostInitHook(func() {
		logger.LogInfo("Application is fully initialized")
		app.runStartupChecks()
	})

	pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		logger.InitLog(pb)

		metrics.RegisterPrometheusMetrics(pb)
		logger.LogInfo("Initializing application services")

		app.initializeServices()
		app.InitCronjobs()
		app.configureRoutes(e)

		if app.Pb.Store().Get("METRICS_ENABLED").(bool) {
			if err := metrics.StartMetricsServer(app.Pb); err != nil {
				logger.LogError("Failed to start metrics server", "error", err)
			}
		}

		logger.LogInfo("All application services initialized")

		hooks.RegisterAll(&hooks.HookConfig{
			Pb:               app.Pb,
			EncryptionKey:    app.Pb.Store().Get("ENCRYPTION_KEY").(string),
			WeatherService:   app.WeatherService,
			SearchService:    app.SearchService,
			ContainerService: app.ContainerService,
			LoggingService:   app.LoggingService,
		})
		logger.LogInfo("Hooks registered")
		app.RunPostInitHooks()

		return e.Next()
	})

	return app, nil
}

// initializeServices creates and initializes all application services
func (app *Application) initializeServices() {
	// Initialize credential usage tracker first (needed by other services)
	credentials.InitTracker(credentials.DefaultConfig())
	logger.LogInfo("Credential usage tracker initialized")

	app.LoggingService = logging.NewLoggingService(app.Pb)
	logger.LogInfo("Logging service initialized")

	app.initializeBaseServices()
	// TODO: WIP
	// app.initializeSearchService()
	// app.initializeContainerService()
	app.initializeAIServices()

	logger.LogInfo("All services initialized successfully")
}

// initializeBaseServices initializes core application services
func (app *Application) initializeBaseServices() {
	// Get Fold API URL from config (defaults to production URL)
	foldAPIURL, _ := app.Pb.Store().Get("FOLD_API_URL").(string)
	if foldAPIURL == "" {
		foldAPIURL = "https://api.fold.money/api"
	}
	app.FoldService = fold.NewFoldService(foldAPIURL)
	app.CalendarService = calendar.NewCalendarService()
	app.MailService = mail.NewMailService()
	app.WorkflowEngine = workflow.NewWorkflowEngine(app.Pb)
	app.WeatherService = weather.NewWeatherService()

	musicStoragePath, _ := app.Pb.Store().Get("MUSIC_STORAGE_PATH").(string)
	if musicStoragePath == "" {
		musicStoragePath = "./music_data"
	}
	musicMaxUpload, _ := app.Pb.Store().Get("MUSIC_MAX_UPLOAD_SIZE").(int64)
	if musicMaxUpload <= 0 {
		musicMaxUpload = 100 * 1024 * 1024
	}
	app.MusicService = music.NewMusicService(musicStoragePath, musicMaxUpload)
	logger.LogInfo("Music service initialized with storage path: " + musicStoragePath)
}

// initializeSearchService initializes the full-text search service
func (app *Application) initializeSearchService() {
	app.SearchService = search.NewFullTextSearchService(app.Pb, "tasks")
	if err := app.SearchService.Initialize(); err != nil {
		logger.LogError("Failed to initialize full-text search service: " + err.Error())
		logger.LogInfo("Continuing without full-text search functionality")
		return
	}

	logger.LogInfo("Full-text search service initialized successfully")
}

// initializeAIServices initializes AI client and feed services
func (app *Application) initializeAIServices() {
	aiConfig := config.GetAIConfig()
	var aiClient ai.AIClient

	if aiConfig.Service != config.AIServiceNone {
		var err error
		aiClient, err = ai.NewAIClient(aiConfig)
		if err != nil {
			logger.LogError("Failed to initialize AI client: " + err.Error())
			logger.LogInfo("Continuing without AI functionality")
		} else {
			logger.LogInfo("AI client initialized")
		}
	}

	processor := feed.NewFeedProcessor(aiClient)
	feedService := feed.NewFeedService(processor)
	feedService.RegisterProvider(providers.NewRSSProvider())
	feedService.RegisterProvider(providers.NewHackerNewsProvider())

	app.FeedService = &feedService

	// Initialize journal service with AI client
	app.JournalService = journal.NewJournalService(aiClient)
}

// initializeContainerService initializes the container service
// TODO: For local testing in macos, we can use the following path
// defaultConfig.StoragePath = "/home/shasharma.linux/container_data"
func (app *Application) initializeContainerService() {
	containerService, err := container.NewContainerService(container.DefaultAppContainerConfig)
	if err != nil {
		logger.LogError("Failed to initialize container service: " + err.Error())
		return
	}

	app.ContainerService = containerService
	// TODO: Uncomment this when we have a way to initialize the container service
	// app.ContainerService.InitializeFull()

	// logger.LogInfo("All services initialized successfully")
}

// configureRoutes sets up API routes for the application
func (app *Application) configureRoutes(e *core.ServeEvent) {
	apiRouter := e.Router.Group("/api")

	// Register panic recovery middleware first
	apiRouter.BindFunc(middleware.PanicRecoveryMiddleware())

	// Then register metrics middleware
	apiRouter.BindFunc(middleware.RouteMetricsMiddleware)

	// Register core API routes
	routes.RegisterWorkflowRoutes(apiRouter, "/workflows", app.WorkflowEngine)
	routes.RegisterFeedRoutes(apiRouter, "/feeds", *app.FeedService)
	routes.RegisterCredentialRoutes(e)
	routes.RegisterDevTokenRoutes(e)
	routes.RegisterLoggingProjectRoutes(e)
	routes.RegisterTrackRoutes(apiRouter, "/track")

	// Register credential usage routes with authentication
	credentialUsageRouter := apiRouter.Group("/credential-usage")
	credentialUsageRouter.BindFunc(middleware.AuthMiddleware())
	routes.RegisterCredentialUsageRoutes(credentialUsageRouter, "")

	// Register sync routes with dev token middleware
	syncRouter := apiRouter.Group("/sync")
	syncRouter.BindFunc(middleware.DevTokenAuthMiddleware())
	routes.RegisterBrowsingActivitySyncRoutes(syncRouter, "")
	routes.RegisterBrowserHistorySyncRoutes(syncRouter, "")

	// Register routes with authentication middleware
	calendarRouter := apiRouter.Group("/calendar")
	calendarRouter.BindFunc(middleware.AuthMiddleware())
	routes.RegisterCalendarRoutes(calendarRouter, "", app.CalendarService)

	mailRouter := apiRouter.Group("/mail")
	mailRouter.BindFunc(middleware.AuthMiddleware())
	routes.RegisterMailRoutes(mailRouter, "", app.MailService)

	foldRouter := apiRouter.Group("/fold")
	foldRouter.BindFunc(middleware.AuthMiddleware())
	routes.RegisterFoldRoutes(foldRouter, "", app.FoldService)

	routes.RegisterSSHRoutes(apiRouter, "/ssh")

	weatherRouter := apiRouter.Group("/weather")
	weatherRouter.BindFunc(middleware.AuthMiddleware())
	routes.RegisterWeatherRoutes(weatherRouter, "", app.WeatherService)

	journalRouter := apiRouter.Group("/journal")
	journalRouter.BindFunc(middleware.AuthMiddleware())
	routes.RegisterJournalRoutes(journalRouter, "", app.JournalService)

	musicRouter := apiRouter.Group("/music")
	musicRouter.BindFunc(middleware.AuthMiddleware())
	routes.RegisterMusicRoutes(musicRouter, "", app.MusicService)

	routes.RegisterTestRoutes(apiRouter, "/test")
	routes.RegisterFileManagerRoutes(apiRouter)

	loggingRouter := apiRouter.Group("/logs")
	loggingRouter.BindFunc(middleware.LoggingAuthMiddleware())
	routes.RegisterLoggingRoutes(loggingRouter, "", app.LoggingService)

	if app.ContainerService != nil {
		containerRouter := apiRouter.Group("/containers")
		containerRouter.BindFunc(middleware.AuthMiddleware())
		routes.RegisterContainerRoutes(containerRouter, "", app.ContainerService)

		volumeRouter := apiRouter.Group("/volumes")
		volumeRouter.BindFunc(middleware.AuthMiddleware())
		routes.RegisterVolumeRoutes(volumeRouter, app.ContainerService)
	}

	if app.SearchService != nil {
		routes.RegisterSearchRoutes(apiRouter, "/search", app.SearchService)
	}

	// app.ConfigureMemoryRoutes(e)
	app.initMemorySystem()

	logger.LogInfo("All routes registered successfully")
}

// initMemorySystem initializes the memory system
func (app *Application) initMemorySystem() {
	memSystem := memorysystem.New()

	app.Pb.OnRecordAfterCreateSuccess("tasks").BindFunc(func(e *core.RecordEvent) error {
		// Process record asynchronously with context for cancellation
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)

		go func() {
			defer cancel()
			if err := memSystem.ProcessRecord("tasks", *e.Record); err != nil {
				logger.LogError("Error processing task record", "error", err, "recordId", e.Record.Id)
			}
		}()

		// Monitor context for timeout/cancellation
		go func() {
			<-ctx.Done()
			if ctx.Err() == context.DeadlineExceeded {
				logger.LogWarning("Task record processing timed out", "recordId", e.Record.Id)
			}
		}()

		return e.Next()
	})

	// memories, err := memSystem.RetrieveMemories("k0jhrgadiakg8xb", "alex", 10)
	// if err != nil {
	//     logger.LogError("Error retrieving memories: %v", err)
	// }

	// // Display the results
	// 	for _, memory := range memories {
	// 		logger.LogInfo("Title: ", memory.Title)
	// 		logger.LogInfo("Content: ", memory.Content)
	// 		logger.LogInfo("Importance: ", memory.Importance)
	// 		logger.LogInfo("Created: ", memory.Created)
	// 		logger.LogInfo("---")
	// 	}
}

// InitCronjobs sets up and starts application cron jobs
func (app *Application) InitCronjobs() error {
	cronJobs := []cronjobs.CronJob{
		{
			Name:     "track-device",
			Interval: "*/1 * * * *",
			JobFunc: func() {
				cronjobs.TrackDevices()
			},
			IsActive: true,
		},
		{
			Name:     "aggregate-credential-stats",
			Interval: "*/15 * * * *", // Every 15 minutes
			JobFunc: func() {
				cronjobs.AggregateCredentialStats()
			},
			IsActive: true,
		},
		{
			Name:     "logging-retention-cleanup",
			Interval: "0 2 * * *", // Every day at 2 AM
			JobFunc: func() {
				cronjobs.CleanupLogs()
			},
			IsActive: true,
		},
	}

	cronjobs.Run(cronJobs)
	return nil
}

// Start starts the application with optional GUI
func (app *Application) Start(httpAddr string) error {
	withGUI, ok := app.Pb.Store().Get("WITH_GUI").(bool)
	fileLogging, okLogging := app.Pb.Store().Get("FILE_LOGGING_ENABLED").(bool)

	if ok && withGUI && okLogging && fileLogging {
		logFilePath, _ := app.Pb.Store().Get("LOG_FILE_PATH").(string)

		go func() {
			app.Pb.Bootstrap()
			err := app.Serve(httpAddr)

			if err != nil {
				logger.LogInfo("Server closed error: " + err.Error())
			}
		}()

		time.Sleep(500 * time.Millisecond)

		guiStatus := gui.GUIStatus{
			ServerRunning:  true,
			MetricsEnabled: app.Pb.Store().Get("METRICS_ENABLED").(bool),
		}

		metadata := app.collectServerMetadata()
		return gui.StartGUI(logFilePath, guiStatus, metadata)
	}

	// Default behavior (no GUI)
	return app.Serve(httpAddr)
}

// collectServerMetadata gathers information about the server for display in the GUI
func (app *Application) collectServerMetadata() gui.ServerMetadata {
	serverURL := "http://localhost:8090"
	if customURL, ok := app.Pb.Store().Get("SERVER_URL").(string); ok && customURL != "" {
		serverURL = customURL
	}

	envVars := app.Pb.Store().GetAll()

	environment := "production"
	if env, ok := app.Pb.Store().Get("APP_ENVIRONMENT").(string); ok {
		environment = env
	}

	cronJobs := []gui.CronJob{}
	for _, job := range cronjobs.GetActiveJobs() {
		cronJobs = append(cronJobs, gui.CronJob{
			Name:     job.Name,
			Schedule: job.Interval,
			LastRun:  job.LastRun,
			Status:   job.GetStatusString(),
		})
	}

	endpoints := []string{
		"/api/collections",
		"/api/admins",
		"/api/feeds",
		"/api/workflows",
	}

	return gui.ServerMetadata{
		ServerURL:     serverURL,
		ServerVersion: "v1.0.0",
		Environment:   environment,
		EnvVariables:  envVars,
		CronJobs:      cronJobs,
		StartTime:     time.Now(),
		DataDirectory: "./pb_data",
		APIEndpoints:  endpoints,
	}
}

// Serve starts the PocketBase server
func (app *Application) Serve(httpAddr string) error {
	app.Pb.Bootstrap()

	logger.LogInfo("Starting server on " + httpAddr)
	err := apis.Serve(app.Pb, apis.ServeConfig{
		HttpAddr:        httpAddr,
		ShowStartBanner: false,
	})

	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}

	return err
}

// AddPostInitHook adds a function to be executed after the server is fully initialized
func (app *Application) AddPostInitHook(hookFunc func()) {
	app.postInitHooks = append(app.postInitHooks, hookFunc)
}

// RunPostInitHooks executes all registered post-initialization hooks
func (app *Application) RunPostInitHooks() {
	logger.LogInfo("Running post-initialization hooks")
	for _, hook := range app.postInitHooks {
		hook()
	}
}

// runStartupChecks performs various startup checks and cleanup tasks
// This is called after the application is fully initialized to handle
// any stale state that may have occurred from server crashes or restarts
func (app *Application) runStartupChecks() {
	logger.LogInfo("Running startup checks...")

	checks := []struct {
		name string
		fn   func() error
	}{
		{
			name: "Resume stale mail sync statuses",
			fn: func() error {
				return routes.ResetStaleSyncStatuses(app.MailService)
			},
		},
		{
			name: "Resume stale calendar sync statuses",
			fn: func() error {
				return routes.ResetStaleCalendarSyncStatuses(app.CalendarService)
			},
		},
	}

	successCount := 0
	for _, check := range checks {
		logger.LogInfo(fmt.Sprintf("Running startup check: %s", check.name))
		if err := check.fn(); err != nil {
			logger.LogError(fmt.Sprintf("Startup check failed: %s", check.name), err)
		} else {
			successCount++
			logger.LogInfo(fmt.Sprintf("Startup check completed: %s", check.name))
		}
	}

	logger.LogInfo(fmt.Sprintf("Startup checks completed: %d/%d successful", successCount, len(checks)))
}

// InitMemorySystem initializes the memory system
func (app *Application) InitMemorySystem() {
	routes.InitMemorySystem()
	logger.Debug.Println("Memory system initialized")
}

// RegisterMemorySystemHooks registers hooks for the memory system
// func (app *Application) RegisterMemorySystemHooks() {
// 	// Register hooks for various collections
// 	app.Pb.OnRecordAfterCreateSuccess("tasks").BindFunc(routes.RecordHookHandler)
// 	app.Pb.OnRecordAfterUpdateSuccess("tasks").BindFunc(routes.RecordHookHandler)

// 	app.Pb.OnRecordAfterCreateSuccess("habits").BindFunc(routes.RecordHookHandler)
// 	app.Pb.OnRecordAfterUpdateSuccess("habits").BindFunc(routes.RecordHookHandler)

// 	app.Pb.OnRecordAfterCreateSuccess("daily_log").BindFunc(routes.RecordHookHandler)
// 	app.Pb.OnRecordAfterUpdateSuccess("daily_log").BindFunc(routes.RecordHookHandler)

// 	app.Pb.OnRecordAfterCreateSuccess("life_balance").BindFunc(routes.RecordHookHandler)
// 	app.Pb.OnRecordAfterUpdateSuccess("life_balance").BindFunc(routes.RecordHookHandler)

// 	logger.Debug.Println("Memory system hooks registered")
// }

// // ConfigureMemoryRoutes configures routes for the memory system
// func (app *Application) ConfigureMemoryRoutes(e *core.ServeEvent) {
// 	// Initialize memory system
// 	app.InitMemorySystem()

// 	// Register memory system hooks
// 	app.RegisterMemorySystemHooks()

// 	// Register API endpoints
// 	e.Router.POST("/api/memory/search", routes.SearchMemory)
// 	e.Router.GET("/api/memory/timeline", routes.GetMemoryTimeline)
// 	e.Router.GET("/api/memory/details", routes.GetMemoryDetails)
// 	e.Router.POST("/api/memory/create", routes.CreateMemory)
// 	e.Router.POST("/api/memory/consolidate", routes.ConsolidateMemories)

// 	e.Router.GET("/api/memory/entities", routes.GetEntities)
// 	e.Router.GET("/api/memory/entity", routes.GetEntityDetails)
// 	// e.Router.POST("/api/memory/entity/create", routes.CreateEntity)

// 	e.Router.GET("/api/memory/insights", routes.GetInsights)
// 	e.Router.GET("/api/memory/insight", routes.GetInsightDetails)
// 	e.Router.POST("/api/memory/insight/rate", routes.RateInsight)
// 	e.Router.POST("/api/memory/insight/create", routes.CreateInsight)

// 	e.Router.POST("/api/memory/connection", routes.CreateConnection)

// 	e.Router.GET("/api/memory/tags", routes.GetMemoryTags)
// 	e.Router.GET("/api/memory/tag", routes.GetMemoriesByTag)

// 	e.Router.GET("/api/memory/status", routes.GetMemorySystemStatus)

// 	logger.Debug.Println("Memory system routes configured")
// }

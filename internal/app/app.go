package app

import (
	"errors"
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/config"
	"github.com/shashank-sharma/backend/internal/cronjobs"
	"github.com/shashank-sharma/backend/internal/gui"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/metrics"
	"github.com/shashank-sharma/backend/internal/middleware"
	"github.com/shashank-sharma/backend/internal/routes"
	"github.com/shashank-sharma/backend/internal/services"
	"github.com/shashank-sharma/backend/internal/services/ai"
	"github.com/shashank-sharma/backend/internal/services/calendar"
	"github.com/shashank-sharma/backend/internal/services/container"
	"github.com/shashank-sharma/backend/internal/services/feed"
	"github.com/shashank-sharma/backend/internal/services/fold"
	"github.com/shashank-sharma/backend/internal/services/mail"
	"github.com/shashank-sharma/backend/internal/services/memorysystem"
	"github.com/shashank-sharma/backend/internal/services/providers"
	"github.com/shashank-sharma/backend/internal/services/search"
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
	postInitHooks    []func()
}

// New creates and initializes a new Application instance
func New(configFlags config.ConfigFlags) *Application {
	pb := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir:  "./pb_data",
		HideStartBanner: false,
		DefaultDev:      configFlags.Dev,
	})

	store.InitApp(pb)
	config.Init(pb, configFlags)

	app := &Application{
		Pb:            pb,
		postInitHooks: make([]func(), 0),
	}

	app.AddPostInitHook(func() {
		logger.LogInfo("Application is fully initialized")
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
		app.RunPostInitHooks()

		return e.Next()
	})

	app.registerHooks()
	return app
}

// initializeServices creates and initializes all application services
func (app *Application) initializeServices() {
	app.initializeBaseServices()
	// TODO: WIP
	// app.initializeSearchService()
	// app.initializeContainerService()
	app.initializeAIServices()
	
	logger.LogInfo("All services initialized successfully")
}

// initializeBaseServices initializes core application services
func (app *Application) initializeBaseServices() {
	app.FoldService = fold.NewFoldService("https://api.fold.money/api")
	app.CalendarService = calendar.NewCalendarService()
	app.MailService = mail.NewMailService()
	app.WorkflowEngine = workflow.NewWorkflowEngine(app.Pb)
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
	apiRouter.BindFunc(middleware.RouteMetricsMiddleware)

	// Register core API routes
	routes.RegisterWorkflowRoutes(apiRouter, "/workflows", app.WorkflowEngine)
	routes.RegisterFeedRoutes(apiRouter, "/feeds", *app.FeedService)
	routes.RegisterCredentialRoutes(e)
	routes.RegisterTrackRoutes(apiRouter, "/track")
	routes.RegisterCalendarRoutes(apiRouter, "/calendar", app.CalendarService)
	routes.RegisterMailRoutes(apiRouter, "/mail", app.MailService)
	routes.RegisterFoldRoutes(apiRouter, "/fold", app.FoldService)
	routes.RegisterSSHRoutes(apiRouter, "/ssh")

	// Register optional service routes
	if app.ContainerService != nil {
		routes.RegisterContainerRoutes(apiRouter, "/containers", app.ContainerService)
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
		go func() {
			if err := memSystem.ProcessRecord("tasks", *e.Record); err != nil {
				logger.LogError("Error processing task record: %v", err)
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
				cronjobs.TrackDevices(app.Pb)
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


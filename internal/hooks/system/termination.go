package system

import (
	"context"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/container"
	"github.com/shashank-sharma/backend/internal/services/credentials"
	"github.com/shashank-sharma/backend/internal/services/logging"
)

func RegisterTerminationHooks(pb *pocketbase.PocketBase, cs *container.ContainerService, ls *logging.LoggingService) {
	pb.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		if cs != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()

			logger.LogInfo("Shutting down container service...")
			if err := cs.ShutdownAll(ctx); err != nil {
				logger.LogError("Error shutting down container service: %v", err)
			}
		}
		return e.Next()
	})

	pb.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		if ls != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			if err := ls.Shutdown(ctx); err != nil {
				logger.LogError("Error shutting down logging service: %v", err)
			}
		}
		return e.Next()
	})

	pb.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		tracker := credentials.GetTracker()
		if tracker != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			logger.LogInfo("Shutting down credential usage tracker...")
			if err := tracker.Shutdown(ctx); err != nil {
				logger.LogError("Error shutting down credential usage tracker: %v", err)
			}
		}
		return e.Next()
	})

	pb.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		logger.LogInfo("Application shutting down...")
		logger.Cleanup()
		return nil
	})
}

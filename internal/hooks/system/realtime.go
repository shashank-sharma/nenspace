package system

import (
	"github.com/pocketbase/pocketbase"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/middleware"
)

func RegisterRealtimeAuthHooks(pb *pocketbase.PocketBase) {
	middleware.RegisterRealtimeAuth(pb)
	logger.LogInfo("Realtime subscription authorization enabled")
}

package hooks

import (
	"github.com/pocketbase/pocketbase"
	"github.com/shashank-sharma/backend/internal/hooks/filemanager"
	"github.com/shashank-sharma/backend/internal/hooks/location"
	"github.com/shashank-sharma/backend/internal/hooks/search"
	"github.com/shashank-sharma/backend/internal/hooks/system"
	"github.com/shashank-sharma/backend/internal/hooks/token"
	"github.com/shashank-sharma/backend/internal/services/container"
	"github.com/shashank-sharma/backend/internal/services/logging"
	searchsvc "github.com/shashank-sharma/backend/internal/services/search"
	"github.com/shashank-sharma/backend/internal/services/weather"
)

type HookConfig struct {
	Pb               *pocketbase.PocketBase
	EncryptionKey    string
	WeatherService   *weather.WeatherService
	SearchService    *searchsvc.FullTextSearchService
	ContainerService *container.ContainerService
	LoggingService   *logging.LoggingService
}

func RegisterAll(cfg *HookConfig) {
	system.RegisterTerminationHooks(cfg.Pb, cfg.ContainerService, cfg.LoggingService)
	system.RegisterRealtimeAuthHooks(cfg.Pb)

	token.RegisterEncryptionHooks(cfg.Pb, cfg.EncryptionKey)

	filemanager.RegisterFileHooks(cfg.Pb)
	filemanager.RegisterFolderHooks(cfg.Pb)
	filemanager.RegisterQuotaHooks(cfg.Pb)

	location.RegisterLocationHooks(cfg.Pb, cfg.WeatherService)

	if cfg.SearchService != nil {
		search.RegisterSearchHooks(cfg.Pb, cfg.SearchService)
	}
}




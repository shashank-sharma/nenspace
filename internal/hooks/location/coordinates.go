package location

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/weather"
)

func RegisterLocationHooks(pb *pocketbase.PocketBase, ws *weather.WeatherService) {
	if ws == nil {
		logger.LogDebug("Weather service not initialized, skipping location coordinate hooks")
		return
	}

	pb.OnRecordCreate("users").BindFunc(func(e *core.RecordEvent) error {
		if err := processUserLocation(e.Record, ws); err != nil {
			return err
		}
		return e.Next()
	})

	pb.OnRecordUpdate("users").BindFunc(func(e *core.RecordEvent) error {
		if err := processUserLocation(e.Record, ws); err != nil {
			return err
		}
		return e.Next()
	})
}

func processUserLocation(record *core.Record, ws *weather.WeatherService) error {
	city := record.GetString("city")
	if city == "" {
		return nil
	}

	lat := record.GetFloat("lat")
	lon := record.GetFloat("lon")
	if lat != 0 && lon != 0 && record.Id != "" {
		return nil
	}

	coords, err := ws.GetCoordinates(city)
	if err != nil {
		logger.LogError("Failed to fetch coordinates for city %s: %v", city, err)
		return nil
	}

	record.Set("lat", coords.Lat)
	record.Set("lon", coords.Lon)

	logger.LogInfo("Updated coordinates for user city: %s, lat: %f, lon: %f",
		city, coords.Lat, coords.Lon)

	return nil
}

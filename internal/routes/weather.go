package routes

import (
	"net/http"
	"strconv"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/weather"
	"github.com/shashank-sharma/backend/internal/util"
)

// RegisterWeatherRoutes registers the weather API routes
func RegisterWeatherRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, weatherService *weather.WeatherService) {
	weatherRouter := apiRouter.Group(path)
	
	weatherRouter.GET("/current", GetCurrentWeatherHandler(weatherService))
	weatherRouter.GET("/forecast", GetForecastHandler(weatherService))
}

// GetCurrentWeatherHandler returns the current weather for a location
func GetCurrentWeatherHandler(weatherService *weather.WeatherService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		location := e.Request.URL.Query().Get("location")
		if location == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Location parameter is required",
			})
		}

		units := e.Request.URL.Query().Get("units")
		if units != "" {
			weatherService.SetUnits(units)
		}

		lang := e.Request.URL.Query().Get("lang")
		if lang != "" {
			weatherService.SetLanguage(lang)
		}

		weatherData, err := weatherService.GetCurrentWeather(userId, location)
		if err != nil {
			logger.LogError("Failed to get weather data: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to get weather data: " + err.Error(),
			})
		}

		formattedData := weatherService.FormatWeatherData(weatherData)
		return e.JSON(http.StatusOK, formattedData)
	}
}

// GetForecastHandler returns the weather forecast for a location
func GetForecastHandler(weatherService *weather.WeatherService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		location := e.Request.URL.Query().Get("location")
		if location == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Location parameter is required",
			})
		}

		days := 5 // Default to 5 days
		daysStr := e.Request.URL.Query().Get("days")
		if daysStr != "" {
			parsedDays, err := strconv.Atoi(daysStr)
			if err == nil && parsedDays > 0 {
				days = parsedDays
			}
		}

		units := e.Request.URL.Query().Get("units")
		if units != "" {
			weatherService.SetUnits(units)
		}

		lang := e.Request.URL.Query().Get("lang")
		if lang != "" {
			weatherService.SetLanguage(lang)
		}

		forecast, err := weatherService.GetForecast(userId, location, days)
		if err != nil {
			logger.LogError("Failed to get forecast data: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to get forecast data: " + err.Error(),
			})
		}

		formattedData := weatherService.FormatForecastData(forecast)
		return e.JSON(http.StatusOK, formattedData)
	}
}
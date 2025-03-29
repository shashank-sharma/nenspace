package routes

import (
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/weather"
	"github.com/shashank-sharma/backend/internal/util"
)

// RegisterWeatherRoutes registers the weather API routes
func RegisterWeatherRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, weatherService *weather.WeatherService) {
	weatherRouter := apiRouter.Group(path).Bind(apis.RequireAuth())
	
	weatherRouter.GET("/current", GetCurrentWeatherHandler(weatherService))
	weatherRouter.GET("/forecast", GetForecastHandler(weatherService))
	weatherRouter.GET("/historic", GetHistoricForecastHandler(weatherService))
}

// GetCurrentWeatherHandler returns the current weather for a user
func GetCurrentWeatherHandler(weatherService *weather.WeatherService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		weatherData, err := weatherService.GetCurrentWeather(userId)
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

// GetForecastHandler returns the weather forecast for a user
func GetForecastHandler(weatherService *weather.WeatherService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		forecast, err := weatherService.GetForecast(userId)
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

// GetHistoricForecastHandler returns historic forecast data for a specific date
func GetHistoricForecastHandler(weatherService *weather.WeatherService) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		token := e.Request.Header.Get("Authorization")
		userId, err := util.GetUserId(token)
		if err != nil {
			return e.JSON(http.StatusUnauthorized, map[string]interface{}{
				"error": "Unauthorized",
			})
		}

		dateParam := e.Request.URL.Query().Get("date")
		if dateParam == "" {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Date parameter is required (format: YYYY-MM-DD)",
			})
		}

		date, err := time.Parse("2006-01-02", dateParam)
		if err != nil {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{
				"error": "Invalid date format. Use YYYY-MM-DD",
			})
		}

		historicData, err := weatherService.GetHistoricForecastData(userId, date)
		if err != nil {
			logger.LogError("Failed to get historic forecast data: %v", err)
			return e.JSON(http.StatusInternalServerError, map[string]interface{}{
				"error": "Failed to get historic forecast data: " + err.Error(),
			})
		}

		formattedData := weatherService.FormatHistoricForecastData(historicData)
		return e.JSON(http.StatusOK, formattedData)
	}
}
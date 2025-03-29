package weather

import (
	"fmt"
	"strings"
	"time"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

// getCachedWeatherData retrieves cached weather data from the database
func (ws *WeatherService) getCachedWeatherData(userId, location string) (*models.WeatherData, error) {
	locationQuery := strings.TrimSpace(strings.ToLower(location))
	
	weatherData, err := query.FindByFilter[*models.WeatherData](map[string]interface{}{
		"user":           userId,
		"location_query": locationQuery,
		"is_forecast":    false,
	})

	if err != nil {
		return nil, err
	}

	return weatherData, nil
}

// saveWeatherData saves weather data to the database
func (ws *WeatherService) saveWeatherData(weatherData *models.WeatherData) error {
	err := query.UpsertRecord[*models.WeatherData](weatherData, map[string]interface{}{
		"user":           weatherData.User,
		"location_query": weatherData.LocationQuery,
		"is_forecast":    weatherData.IsForecast,
		"date":           weatherData.Date,
	})
	
	if err != nil {
		logger.LogError("Failed to save weather data: %v", err)
		return err
	}
	
	return nil
}

// saveForecastData saves forecast data to the database
func (ws *WeatherService) saveForecastData(forecast *models.WeatherForecast) error {
	err := query.UpsertRecord[*models.WeatherForecast](forecast, map[string]interface{}{
		"user":           forecast.User,
		"location_query": forecast.LocationQuery,
		"day_count":      forecast.DayCount,
	})
	
	if err != nil {
		logger.LogError("Failed to save forecast data: %v", err)
		return err
	}
	
	return nil
}

// isCacheValid checks if the cached data is still valid
func (ws *WeatherService) isCacheValid(lastUpdated time.Time, cacheTTL time.Duration) bool {
	expiryTime := lastUpdated.Add(cacheTTL)
	return time.Now().Before(expiryTime)
}

// getLatestWeatherByCity retrieves cached weather data from the database using city
func (ws *WeatherService) getLatestWeatherByCity(userId string, city string) (*models.WeatherData, error) {
	if city == "" {
		return nil, fmt.Errorf("city is required")
	}
	
	weatherData, err := query.FindLatestByColumn[*models.WeatherData]("last_updated", map[string]interface{}{
		"user":        userId,
		"is_forecast": false,
		"city":        strings.ToLower(city),
	})
	
	if err != nil {
		return nil, fmt.Errorf("no cached weather data found: %w", err)
	}

	return weatherData, nil
}

// getLatestForecastByCity retrieves cached forecast data from the database using coordinates
func (ws *WeatherService) getLatestForecastByCity(userId string, days int, city string) (*models.WeatherForecast, error) {
	if city == "" {
		return nil, fmt.Errorf("city is required")
	}
	
	forecast, err := query.FindLatestByColumn[*models.WeatherForecast]("last_updated", map[string]interface{}{
		"user":      userId,
		"day_count": days,
		"city":      strings.ToLower(city),
	})

	if err != nil {
		return nil, fmt.Errorf("no cached forecast data found: %w", err)
	}

	return forecast, nil
} 
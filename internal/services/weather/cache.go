package weather

import (
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

// getCachedForecast retrieves cached forecast data from the database
func (ws *WeatherService) getCachedForecast(userId, location string, days int) (*models.WeatherForecast, error) {
	locationQuery := strings.TrimSpace(strings.ToLower(location))
	
	forecast, err := query.FindByFilter[*models.WeatherForecast](map[string]interface{}{
		"user":           userId,
		"location_query": locationQuery,
		"day_count":      days,
	})

	if err != nil {
		return nil, err
	}

	return forecast, nil
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

// saveForecastAsWeatherData saves each forecast day as an individual WeatherData record
func (ws *WeatherService) saveForecastAsWeatherData(userId, location string, city string, country string, lat, lon float64, forecastItems []map[string]interface{}) error {
	for _, item := range forecastItems {
		if _, ok := item["lat"].(float64); !ok {
			item["lat"] = lat
		}
		if _, ok := item["lon"].(float64); !ok {
			item["lon"] = lon
		}
		
		weatherData, err := ws.convertForecastToWeatherData(userId, location, city, country, item)
		if err != nil {
			logger.LogError("Failed to convert forecast to weather data: %v", err)
			continue
		}
		
		err = ws.saveWeatherData(weatherData)
		if err != nil {
			logger.LogError("Failed to save forecast as weather data: %v", err)
		}
	}
	
	return nil
}

// isCacheValid checks if the cached data is still valid
func (ws *WeatherService) isCacheValid(lastUpdated time.Time, cacheTTL time.Duration) bool {
	expiryTime := lastUpdated.Add(cacheTTL)
	return time.Now().Before(expiryTime)
} 
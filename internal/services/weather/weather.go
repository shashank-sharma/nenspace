// Package weather provides functionality to fetch and process weather data
package weather

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
)

const (
	baseURL            = "https://api.openweathermap.org/data/2.5"
	defaultCacheTTL    = 30 * time.Minute  // Cache current weather for 30 minutes
	forecastCacheTTL   = 3 * time.Hour     // Cache forecast for 3 hours
	geocodingURL       = "https://api.openweathermap.org/geo/1.0/direct"
	defaultUnits       = "metric"
	defaultLang        = "en"
)

// WeatherService handles fetching and caching weather data
type WeatherService struct {
	apiKey     string
	httpClient *http.Client
	units      string
	lang       string
}

// NewWeatherService creates a new WeatherService instance
func NewWeatherService() *WeatherService {
	apiKey := os.Getenv("OPENWEATHERMAP_API_KEY")
	
	return &WeatherService{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		units: defaultUnits,
		lang:  defaultLang,
	}
}

// SetUnits sets the units for temperature (metric, imperial, standard)
func (ws *WeatherService) SetUnits(units string) {
	if units == "metric" || units == "imperial" || units == "standard" {
		ws.units = units
	}
}

// SetLanguage sets the language for weather descriptions
func (ws *WeatherService) SetLanguage(lang string) {
	ws.lang = lang
}

// GetCurrentWeather gets the current weather for a location
func (ws *WeatherService) GetCurrentWeather(userId, location string) (*models.WeatherData, error) {
	if ws.apiKey == "" {
		return nil, fmt.Errorf("OpenWeatherMap API key is not set")
	}

	cachedData, err := ws.getCachedWeatherData(userId, location)
	if err == nil && cachedData != nil {
		if ws.isCacheValid(cachedData.LastUpdated.Time(), defaultCacheTTL) {
			logger.LogInfo("Using cached weather data for %s", location)
			return cachedData, nil
		}
	}

	coords, err := ws.getCoordinates(location)
	if err != nil {
		return nil, fmt.Errorf("failed to get coordinates for %s: %w", location, err)
	}

	weatherResponse, err := ws.fetchCurrentWeather(coords.Lat, coords.Lon)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch weather data: %w", err)
	}

	weatherData, err := ws.convertToWeatherData(userId, location, *weatherResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to convert response to model: %w", err)
	}

	err = ws.saveWeatherData(weatherData)
	if err != nil {
		logger.LogError("Failed to save weather data: %v", err)
	}

	return weatherData, nil
}

// GetForecast gets the weather forecast for multiple days
func (ws *WeatherService) GetForecast(userId, location string, days int) (*models.WeatherForecast, error) {
	if ws.apiKey == "" {
		return nil, fmt.Errorf("OpenWeatherMap API key is not set")
	}

	if days <= 0 {
		days = 5
	} else if days > 5 {
		days = 5 // Free API only supports 5 days
	}

	cachedForecast, err := ws.getCachedForecast(userId, location, days)
	if err == nil && cachedForecast != nil {
		if ws.isCacheValid(cachedForecast.LastUpdated.Time(), forecastCacheTTL) {
			logger.LogInfo("Using cached forecast data for %s", location)
			return cachedForecast, nil
		}
	}

	coords, err := ws.getCoordinates(location)
	if err != nil {
		return nil, fmt.Errorf("failed to get coordinates for %s: %w", location, err)
	}

	forecastResponse, err := ws.fetchForecastData(coords.Lat, coords.Lon)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch forecast data: %w", err)
	}

	forecast, err := ws.convertToWeatherForecast(userId, location, *forecastResponse, days)
	if err != nil {
		return nil, fmt.Errorf("failed to convert response to model: %w", err)
	}

	if err := ws.saveForecastData(forecast); err != nil {
		logger.LogError("Failed to save forecast data: %v", err)
	}

	if err := ws.saveForecastIntervals(userId, location, forecast); err != nil {
		logger.LogError("Failed to save forecast intervals: %v", err)
	}

	return forecast, nil
}

// saveForecastIntervals extracts and saves each interval from forecast data as individual WeatherData records
func (ws *WeatherService) saveForecastIntervals(userId, location string, forecast *models.WeatherForecast) error {
	var forecastData []map[string]interface{}
	
	if err := json.Unmarshal(forecast.ForecastData, &forecastData); err != nil {
		return fmt.Errorf("failed to unmarshal forecast data: %w", err)
	}
	
	for _, interval := range forecastData {
		weatherData := &models.WeatherData{
			User:          userId,
			City:          forecast.City,
			Country:       forecast.Country,
			Lat:           forecast.Lat,
			Lon:           forecast.Lon,
			LocationQuery: strings.TrimSpace(strings.ToLower(location)),
			LastUpdated:   types.NowDateTime(),
			IsForecast:    true,
		}

		if weather, ok := interval["weather"].(map[string]interface{}); ok {
			if condition, ok := weather["condition"].(string); ok {
				weatherData.Weather = condition
			}
			if description, ok := weather["description"].(string); ok {
				weatherData.Description = description
			}
			if icon, ok := weather["icon"].(string); ok {
				weatherData.Icon = icon
			}
		}

		if temp, ok := interval["temperature"].(map[string]interface{}); ok {
			if current, ok := temp["current"].(float64); ok {
				weatherData.Temperature = current
			}
			if feelsLike, ok := temp["feels_like"].(float64); ok {
				weatherData.FeelsLike = feelsLike
			}
			if min, ok := temp["min"].(float64); ok {
				weatherData.TempMin = min
			}
			if max, ok := temp["max"].(float64); ok {
				weatherData.TempMax = max
			}
		}

		if humidity, ok := interval["humidity"].(float64); ok {
			weatherData.Humidity = int(humidity)
		}
		if windSpeed, ok := interval["wind_speed"].(float64); ok {
			weatherData.WindSpeed = windSpeed
		}
		if windDir, ok := interval["wind_direction"].(string); ok {
			weatherData.WindDeg = ws.cardinalToWindDegrees(windDir)
		}
		if clouds, ok := interval["clouds"].(float64); ok {
			weatherData.Clouds = int(clouds)
		}

		ws.setForecastTime(weatherData, interval)

		if err := ws.saveWeatherData(weatherData); err != nil {
			logger.LogError("Failed to save forecast interval as weather data: %v", err)
		}
	}
	
	return nil
}

// setForecastTime sets the Date field in WeatherData from interval data
func (ws *WeatherService) setForecastTime(weatherData *models.WeatherData, interval map[string]interface{}) {
	if timestamp, ok := interval["timestamp"].(float64); ok {
		forecastTime := time.Unix(int64(timestamp), 0)
		weatherData.Date.Scan(forecastTime)
	} else if timestamp, ok := interval["timestamp"].(int64); ok {
		forecastTime := time.Unix(timestamp, 0)
		weatherData.Date.Scan(forecastTime)
	} else {
		dateStr, _ := interval["date"].(string)
		timeStr, _ := interval["time"].(string)
		if dateStr != "" && timeStr != "" {
			forecastDateTime, err := time.Parse("2006-01-02 15:04", dateStr+" "+timeStr)
			if err == nil {
				weatherData.Date.Scan(forecastDateTime)
			}
		}
	}
} 
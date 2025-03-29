// Package weather provides functionality to fetch and process weather data
package weather

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

const (
	baseURL            = "https://api.openweathermap.org/data/2.5"
	defaultCacheTTL    = 10 * time.Minute  // Cache current weather for 30 minutes
	forecastCacheTTL   = 24 * time.Hour     // Cache forecast for 3 hours
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

// GetCurrentWeather gets the current weather for a user
func (ws *WeatherService) GetCurrentWeather(userId string) (*models.WeatherData, error) {
	if ws.apiKey == "" {
		return nil, fmt.Errorf("OpenWeatherMap API key is not set")
	}

	user, err := query.FindById[*models.Users](userId)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	
	if user.Lat == 0 && user.Lon == 0 {
		return nil, fmt.Errorf("user has no coordinates set")
	}
	
	lat := user.Lat
	lon := user.Lon

	cachedData, err := ws.getLatestWeatherByCity(userId, user.City)
	if err == nil && cachedData != nil {
		if ws.isCacheValid(cachedData.LastUpdated.Time(), defaultCacheTTL) {
			logger.LogDebug("Using cached weather data for user %s", userId)
			return cachedData, nil
		}
	}

	weatherResponse, err := ws.fetchCurrentWeather(lat, lon)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch weather data: %w", err)
	}

	weatherData, err := ws.convertToWeatherData(userId, "", *weatherResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to convert response to model: %w", err)
	}

	weatherData.Lat = lat
	weatherData.Lon = lon

	err = ws.saveWeatherData(weatherData)
	if err != nil {
		logger.LogError("Failed to save weather data: %v", err)
	}

	return weatherData, nil
}

// GetForecast gets the weather forecast for a user (always 5 days)
func (ws *WeatherService) GetForecast(userId string) (*models.WeatherForecast, error) {
	if ws.apiKey == "" {
		return nil, fmt.Errorf("OpenWeatherMap API key is not set")
	}

	user, err := query.FindById[*models.Users](userId)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	
	if user.Lat == 0 && user.Lon == 0 {
		return nil, fmt.Errorf("user has no coordinates set")
	}
	
	lat := user.Lat
	lon := user.Lon

	days := 5

	cachedForecast, err := ws.getLatestForecastByCity(userId, days, user.City)
	if err == nil && cachedForecast != nil {
		if ws.isCacheValid(cachedForecast.LastUpdated.Time(), forecastCacheTTL) {
			logger.LogDebug("Using cached forecast data for user %s", userId)
			return cachedForecast, nil
		}
	}

	forecastResponse, err := ws.fetchForecastData(lat, lon)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch forecast data: %w", err)
	}

	forecast, err := ws.convertToWeatherForecast(userId, "", *forecastResponse, days)
	if err != nil {
		return nil, fmt.Errorf("failed to convert response to model: %w", err)
	}

	forecast.Lat = lat
	forecast.Lon = lon

	if err := ws.saveForecastData(forecast); err != nil {
		logger.LogError("Failed to save forecast data: %v", err)
	}

	if err := ws.saveForecastIntervals(userId, "", forecast); err != nil {
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
	
	locationQuery := location
	if locationQuery == "" {
		locationQuery = forecast.LocationQuery
	}
	
	for _, interval := range forecastData {
		weatherData := &models.WeatherData{
			User:          userId,
			City:          strings.ToLower(forecast.City),
			Country:       forecast.Country,
			Lat:           forecast.Lat,
			Lon:           forecast.Lon,
			LocationQuery: locationQuery,
			LastUpdated:   types.NowDateTime(),
			IsForecast:    true,
		}

		if weather, ok := interval["weather"].(map[string]interface{}); ok {
			if condition, ok := weather["condition"].(string); ok {
				weatherData.Weather = strings.ToLower(condition)
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

// GetHistoricForecastData gets historic forecast data for a specific date
func (ws *WeatherService) GetHistoricForecastData(userId string, date time.Time) ([]*models.WeatherData, error) {
	user, err := query.FindById[*models.Users](userId)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	
	dateStart := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	dateEnd := time.Date(date.Year(), date.Month(), date.Day(), 23, 59, 59, 999999999, date.Location())
	
	filter := map[string]interface{}{
		"user":        userId,
		"is_forecast": false,
		"date": map[string]interface{}{
			"gte": dateStart,
			"lte": dateEnd,
		},
	}
	
	if user.City != "" {
		filter["city"] = user.City
	}
	
	results, err := query.FindAllByFilter[*models.WeatherData](filter)
	if err != nil {
		return nil, fmt.Errorf("failed to query historic forecast data: %w", err)
	}
	
	if len(results) == 0 {
		return nil, fmt.Errorf("no historic forecast data found for date %s", dateStart.Format("2006-01-02"))
	}
	
	sort.Slice(results, func(i, j int) bool {
		return results[i].Date.Time().Before(results[j].Date.Time())
	})
	
	return results, nil
}
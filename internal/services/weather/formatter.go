package weather

import (
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/shashank-sharma/backend/internal/models"
)

// FormatWeatherData formats weather data for display
func (ws *WeatherService) FormatWeatherData(data *models.WeatherData) map[string]interface{} {
	return map[string]interface{}{
		"location": map[string]interface{}{
			"city":    data.City,
			"country": data.Country,
			"lat":     data.Lat,
			"lon":     data.Lon,
		},
		"date":        data.Date.Time().Format(time.RFC3339),
		"is_forecast": data.IsForecast,
		"weather": map[string]interface{}{
			"condition":   data.Weather,
			"description": data.Description,
			"icon":        data.Icon,
			"icon_url":    fmt.Sprintf("https://openweathermap.org/img/wn/%s@2x.png", data.Icon),
		},
		"temperature": map[string]interface{}{
			"current":   data.Temperature,
			"feels_like": data.FeelsLike,
			"min":       data.TempMin,
			"max":       data.TempMax,
			"unit":      ws.getTemperatureUnit(),
		},
		"details": map[string]interface{}{
			"pressure":   data.Pressure,
			"humidity":   data.Humidity,
			"wind_speed": data.WindSpeed,
			"wind_direction": ws.formatWindDirection(data.WindDeg),
			"clouds":     data.Clouds,
			"visibility": data.Visibility,
		},
		"sun": map[string]interface{}{
			"sunrise": data.Sunrise.Time().Format(time.RFC3339),
			"sunset":  data.Sunset.Time().Format(time.RFC3339),
		},
		"last_updated": data.LastUpdated.Time().Format(time.RFC3339),
	}
}

// FormatForecastData formats forecast data for display
func (ws *WeatherService) FormatForecastData(forecast *models.WeatherForecast) map[string]interface{} {
	var intervalForecasts []map[string]interface{}
	json.Unmarshal(forecast.ForecastData, &intervalForecasts)

	forecastsByDay := make(map[string][]map[string]interface{})
	for _, interval := range intervalForecasts {
		date := interval["date"].(string)
		forecastsByDay[date] = append(forecastsByDay[date], interval)
	}

	days := make([]map[string]interface{}, 0, len(forecastsByDay))
	for date, intervals := range forecastsByDay {
		dayForecast := map[string]interface{}{
			"date":        date,
			"day_of_week": intervals[0]["day_of_week"],
			"intervals":   intervals,
		}
		days = append(days, dayForecast)
	}

	sort.Slice(days, func(i, j int) bool {
		return days[i]["date"].(string) < days[j]["date"].(string)
	})

	return map[string]interface{}{
		"location": map[string]interface{}{
			"city":    forecast.City,
			"country": forecast.Country,
			"lat":     forecast.Lat,
			"lon":     forecast.Lon,
		},
		"forecast": map[string]interface{}{
			"days":       days,
			"start_date": forecast.StartDate.Time().Format(time.RFC3339),
			"end_date":   forecast.EndDate.Time().Format(time.RFC3339),
		},
		"last_updated": forecast.LastUpdated.Time().Format(time.RFC3339),
	}
}

// FormatHourlyForecast formats hourly forecast data for display
func (ws *WeatherService) FormatHourlyForecast(forecast *models.WeatherForecast) map[string]interface{} {
	var hourlyForecasts []map[string]interface{}
	json.Unmarshal(forecast.ForecastData, &hourlyForecasts)

	return map[string]interface{}{
		"location": map[string]interface{}{
			"city":    forecast.City,
			"country": forecast.Country,
			"lat":     forecast.Lat,
			"lon":     forecast.Lon,
		},
		"forecast": map[string]interface{}{
			"hours":      hourlyForecasts,
			"date":       forecast.StartDate.Time().Format("2006-01-02"),
			"start_time": forecast.StartDate.Time().Format(time.RFC3339),
			"end_time":   forecast.EndDate.Time().Format(time.RFC3339),
		},
		"last_updated": forecast.LastUpdated.Time().Format(time.RFC3339),
	}
}

// formatWindDirection formats wind direction in degrees as a cardinal direction
func (ws *WeatherService) formatWindDirection(degrees int) string {
	directions := []string{"N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"}
	index := int((float64(degrees) + 11.25) / 22.5) % 16
	return directions[index]
}

// getTemperatureUnit returns the temperature unit based on the units setting
func (ws *WeatherService) getTemperatureUnit() string {
	switch ws.units {
	case "metric":
		return "°C"
	case "imperial":
		return "°F"
	default:
		return "K"
	}
} 
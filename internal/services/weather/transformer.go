package weather

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/models"
)

// convertToWeatherData converts API response to WeatherData model
func (ws *WeatherService) convertToWeatherData(userId, location string, response CurrentWeatherResponse) (*models.WeatherData, error) {
	weatherData := &models.WeatherData{
		User:          userId,
		City:          strings.ToLower(response.Name),
		Lat:           response.Coord.Lat,
		Lon:           response.Coord.Lon,
		Country:       response.Sys.Country,
		LastUpdated:   types.NowDateTime(),
		Pressure:      response.Main.Pressure,
		Humidity:      response.Main.Humidity,
		Temperature:   response.Main.Temp,
		FeelsLike:     response.Main.FeelsLike,
		TempMin:       response.Main.TempMin,
		TempMax:       response.Main.TempMax,
		WindSpeed:     response.Wind.Speed,
		WindDeg:       response.Wind.Deg,
		Clouds:        response.Clouds.All,
		Visibility:    response.Visibility,
		IsForecast:    false,
	}
	
	if location != "" {
		weatherData.LocationQuery = strings.TrimSpace(strings.ToLower(location))
	} else {
		weatherData.LocationQuery = fmt.Sprintf("%.4f,%.4f", response.Coord.Lat, response.Coord.Lon)
	}

	currentDate := time.Unix(response.Dt, 0)
	weatherData.Date.Scan(currentDate)

	sunrise := time.Unix(response.Sys.Sunrise, 0)
	sunset := time.Unix(response.Sys.Sunset, 0)
	weatherData.Sunrise.Scan(sunrise)
	weatherData.Sunset.Scan(sunset)

	if len(response.Weather) > 0 {
		weatherData.Weather = strings.ToLower(response.Weather[0].Main)
		weatherData.Description = response.Weather[0].Description
		weatherData.Icon = response.Weather[0].Icon
	}

	return weatherData, nil
}

// convertToWeatherForecast converts API response to WeatherForecast model
func (ws *WeatherService) convertToWeatherForecast(userId, location string, response ForecastResponse, days int) (*models.WeatherForecast, error) {
	forecast := &models.WeatherForecast{
		User:          userId,
		City:          strings.ToLower(response.City.Name),
		Lat:           response.City.Coord.Lat,
		Lon:           response.City.Coord.Lon,
		Country:       response.City.Country,
		DayCount:      days,
		LastUpdated:   types.NowDateTime(),
	}
	
	if location != "" {
		forecast.LocationQuery = strings.TrimSpace(strings.ToLower(location))
	} else {
		forecast.LocationQuery = fmt.Sprintf("%.4f,%.4f", response.City.Coord.Lat, response.City.Coord.Lon)
	}

	intervalForecasts := make([]map[string]interface{}, 0, len(response.List))
	
	for _, item := range response.List {
		date := time.Unix(item.Dt, 0)
		dateStr := date.Format("2006-01-02")
		timeStr := date.Format("15:04")

		intervalForecast := map[string]interface{}{
			"date":        dateStr,
			"time":        timeStr,
			"timestamp":   item.Dt,
			"day_of_week": date.Weekday().String(),
			"weather": map[string]interface{}{
				"condition":   item.Weather[0].Main,
				"description": item.Weather[0].Description,
				"icon":        item.Weather[0].Icon,
				"icon_url":    fmt.Sprintf("https://openweathermap.org/img/wn/%s@2x.png", item.Weather[0].Icon),
			},
			"temperature": map[string]interface{}{
				"current":    item.Main.Temp,
				"feels_like": item.Main.FeelsLike,
				"min":        item.Main.TempMin,
				"max":        item.Main.TempMax,
				"unit":       ws.getTemperatureUnit(),
			},
			"humidity":       item.Main.Humidity,
			"wind_speed":     item.Wind.Speed,
			"wind_direction": ws.formatWindDirection(item.Wind.Deg),
			"clouds":         item.Clouds.All,
			"probability_of_precipitation": item.Pop * 100,
		}

		intervalForecasts = append(intervalForecasts, intervalForecast)
	}

	sort.Slice(intervalForecasts, func(i, j int) bool {
		return intervalForecasts[i]["timestamp"].(int64) < intervalForecasts[j]["timestamp"].(int64)
	})

	if len(intervalForecasts) > 0 {
		startTime := time.Unix(intervalForecasts[0]["timestamp"].(int64), 0)
		endTime := time.Unix(intervalForecasts[len(intervalForecasts)-1]["timestamp"].(int64), 0)
		
		forecast.StartDate.Scan(startTime)
		forecast.EndDate.Scan(endTime)
	}

	forecastDataJSON, err := json.Marshal(intervalForecasts)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal forecast data JSON: %w", err)
	}
	forecast.ForecastData.Scan(forecastDataJSON)

	return forecast, nil
}

// cardinalToWindDegrees converts a cardinal direction to approximate degrees
func (ws *WeatherService) cardinalToWindDegrees(direction string) int {
	dirMap := map[string]int{
		"N":   0,
		"NNE": 22,
		"NE":  45,
		"ENE": 67,
		"E":   90,
		"ESE": 112,
		"SE":  135,
		"SSE": 157,
		"S":   180,
		"SSW": 202,
		"SW":  225,
		"WSW": 247,
		"W":   270,
		"WNW": 292,
		"NW":  315,
		"NNW": 337,
	}
	
	if degrees, ok := dirMap[direction]; ok {
		return degrees
	}
	
	return 0
}
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
		City:          response.Name,
		Lat:           response.Coord.Lat,
		Lon:           response.Coord.Lon,
		Country:       response.Sys.Country,
		LocationQuery: strings.TrimSpace(strings.ToLower(location)),
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

	currentDate := time.Unix(response.Dt, 0)
	currentDate = time.Date(currentDate.Year(), currentDate.Month(), currentDate.Day(), 0, 0, 0, 0, currentDate.Location())
	weatherData.Date.Scan(currentDate)

	sunrise := time.Unix(response.Sys.Sunrise, 0)
	sunset := time.Unix(response.Sys.Sunset, 0)
	weatherData.Sunrise.Scan(sunrise)
	weatherData.Sunset.Scan(sunset)

	if len(response.Weather) > 0 {
		weatherData.Weather = response.Weather[0].Main
		weatherData.Description = response.Weather[0].Description
		weatherData.Icon = response.Weather[0].Icon
	}

	return weatherData, nil
}

// convertToWeatherForecast converts API response to WeatherForecast model
func (ws *WeatherService) convertToWeatherForecast(userId, location string, response ForecastResponse, days int) (*models.WeatherForecast, error) {
	forecast := &models.WeatherForecast{
		User:          userId,
		City:          response.City.Name,
		Lat:           response.City.Coord.Lat,
		Lon:           response.City.Coord.Lon,
		Country:       response.City.Country,
		DayCount:      days,
		LocationQuery: strings.TrimSpace(strings.ToLower(location)),
		LastUpdated:   types.NowDateTime(),
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

// groupForecastsByDay groups 3-hour forecasts into daily forecasts
func (ws *WeatherService) groupForecastsByDay(forecastList []ForecastListItem, days int) []map[string]interface{} {
	dailyMap := make(map[string][]ForecastListItem)
	
	for _, item := range forecastList {
		date := time.Unix(item.Dt, 0)
		dateStr := date.Format("2006-01-02")
		dailyMap[dateStr] = append(dailyMap[dateStr], item)
	}

	dailyForecasts := make([]map[string]interface{}, 0, len(dailyMap))
	for dateStr, items := range dailyMap {
		var tempSum, tempMin, tempMax, humiditySum, windSpeedSum float64
		var pop float64
		var icon, condition, description string
		
		tempMin = 1000.0
		tempMax = -1000.0
		
		midDayItem := items[0]
		
		for _, item := range items {
			date := time.Unix(item.Dt, 0)
			hour := date.Hour()
			
			if item.Main.Temp < tempMin {
				tempMin = item.Main.Temp
			}
			if item.Main.Temp > tempMax {
				tempMax = item.Main.Temp
			}
			
			tempSum += item.Main.Temp
			humiditySum += float64(item.Main.Humidity)
			windSpeedSum += item.Wind.Speed
			
			if item.Pop > pop {
				pop = item.Pop
			}
			
			if hour >= 11 && hour <= 14 {
				midDayItem = item
			}
		}
		
		if len(midDayItem.Weather) > 0 {
			condition = midDayItem.Weather[0].Main
			description = midDayItem.Weather[0].Description
			icon = midDayItem.Weather[0].Icon
		}
		
		avgTemp := tempSum / float64(len(items))
		avgHumidity := humiditySum / float64(len(items))
		avgWindSpeed := windSpeedSum / float64(len(items))
		
		dailyForecasts = append(dailyForecasts, map[string]interface{}{
			"date":        dateStr,
			"dt":          midDayItem.Dt,
			"day_of_week": time.Unix(midDayItem.Dt, 0).Weekday().String(),
			"weather": map[string]interface{}{
				"condition":   condition,
				"description": description,
				"icon":        icon,
				"icon_url":    fmt.Sprintf("https://openweathermap.org/img/wn/%s@2x.png", icon),
			},
			"temperature": map[string]interface{}{
				"avg": avgTemp,
				"min": tempMin,
				"max": tempMax,
				"unit": ws.getTemperatureUnit(),
			},
			"humidity":       avgHumidity,
			"wind_speed":     avgWindSpeed,
			"wind_direction": ws.formatWindDirection(midDayItem.Wind.Deg),
			"clouds":         midDayItem.Clouds.All,
			"probability_of_precipitation": pop * 100,
		})
	}
	
	sort.Slice(dailyForecasts, func(i, j int) bool {
		return dailyForecasts[i]["date"].(string) < dailyForecasts[j]["date"].(string)
	})
	
	if len(dailyForecasts) > days {
		dailyForecasts = dailyForecasts[:days]
	}
	
	return dailyForecasts
}

// convertForecastToWeatherData converts a forecast item to a WeatherData model
func (ws *WeatherService) convertForecastToWeatherData(userId, location string, city string, country string, forecastItem map[string]interface{}) (*models.WeatherData, error) {
	weatherData := &models.WeatherData{
		User:          userId,
		City:          city,
		Country:       country,
		LocationQuery: strings.TrimSpace(strings.ToLower(location)),
		LastUpdated:   types.NowDateTime(),
		IsForecast:    true,
	}
	
	if lat, ok := forecastItem["lat"].(float64); ok {
		weatherData.Lat = lat
	}
	if lon, ok := forecastItem["lon"].(float64); ok {
		weatherData.Lon = lon
	}
	
	var forecastTime time.Time
	var timeSet bool
	
	if timestamp, ok := forecastItem["timestamp"].(int64); ok {
		forecastTime = time.Unix(timestamp, 0)
		timeSet = true
	} else if timestamp, ok := forecastItem["timestamp"].(float64); ok {
		forecastTime = time.Unix(int64(timestamp), 0)
		timeSet = true
	}
	
	if !timeSet {
		dateStr, _ := forecastItem["date"].(string)
		timeStr, _ := forecastItem["time"].(string)
		
		if dateStr != "" && timeStr != "" {
			parsedTime, err := time.Parse("2006-01-02 15:04", dateStr+" "+timeStr)
			if err == nil {
				forecastTime = parsedTime
				timeSet = true
			}
		}
	}
	
	if timeSet {
		weatherData.Date.Scan(forecastTime)
	}
	
	if weather, ok := forecastItem["weather"].(map[string]interface{}); ok {
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
	
	// Extract temperature data
	if temp, ok := forecastItem["temperature"].(map[string]interface{}); ok {
		if current, ok := temp["current"].(float64); ok {
			weatherData.Temperature = current
		} else if avg, ok := temp["avg"].(float64); ok {
			weatherData.Temperature = avg
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
	
	extractIntValue := func(item map[string]interface{}, key string) (int, bool) {
		if val, ok := item[key].(int); ok {
			return val, true
		} else if fVal, ok := item[key].(float64); ok {
			return int(fVal), true
		}
		return 0, false
	}
	
	extractFloatValue := func(item map[string]interface{}, key string) (float64, bool) {
		if val, ok := item[key].(float64); ok {
			return val, true
		} else if iVal, ok := item[key].(int); ok {
			return float64(iVal), true
		}
		return 0, false
	}
	
	if humidity, ok := extractIntValue(forecastItem, "humidity"); ok {
		weatherData.Humidity = humidity
	}
	
	if windSpeed, ok := extractFloatValue(forecastItem, "wind_speed"); ok {
		weatherData.WindSpeed = windSpeed
	}
	
	if windDir, ok := forecastItem["wind_direction"].(string); ok {
		weatherData.WindDeg = ws.cardinalToWindDegrees(windDir)
	}
	
	if clouds, ok := extractIntValue(forecastItem, "clouds"); ok {
		weatherData.Clouds = clouds
	}
	
	return weatherData, nil
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
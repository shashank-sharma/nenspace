package weather

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

// getCoordinates gets the coordinates (lat, lon) for a location
func (ws *WeatherService) GetCoordinates(location string) (*Coordinates, error) {
	query := url.QueryEscape(location)
	
	url := fmt.Sprintf("%s?q=%s&limit=1&appid=%s", geocodingURL, query, ws.apiKey)
	
	resp, err := ws.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch geocoding data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("geocoding API returned status code %d", resp.StatusCode)
	}

	var geocodingResponse GeocodingResponse
	if err := json.NewDecoder(resp.Body).Decode(&geocodingResponse); err != nil {
		return nil, fmt.Errorf("failed to decode geocoding response: %w", err)
	}

	if len(geocodingResponse) == 0 {
		return nil, fmt.Errorf("location not found: %s", location)
	}

	return &Coordinates{
		Lat: geocodingResponse[0].Lat,
		Lon: geocodingResponse[0].Lon,
	}, nil
}

// fetchCurrentWeather fetches current weather data from the API
func (ws *WeatherService) fetchCurrentWeather(lat, lon float64) (*CurrentWeatherResponse, error) {
	url := fmt.Sprintf("%s/weather?lat=%f&lon=%f&appid=%s&units=%s&lang=%s", 
		baseURL, lat, lon, ws.apiKey, ws.units, ws.lang)
	
	resp, err := ws.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch weather data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status code %d", resp.StatusCode)
	}

	var weatherResponse CurrentWeatherResponse
	if err := json.NewDecoder(resp.Body).Decode(&weatherResponse); err != nil {
		return nil, fmt.Errorf("failed to decode API response: %w", err)
	}
	
	return &weatherResponse, nil
}

// fetchForecastData fetches forecast data from the API
func (ws *WeatherService) fetchForecastData(lat, lon float64) (*ForecastResponse, error) {
	url := fmt.Sprintf("%s/forecast?lat=%f&lon=%f&appid=%s&units=%s&lang=%s", 
		baseURL, lat, lon, ws.apiKey, ws.units, ws.lang)
	
	resp, err := ws.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch forecast data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status code %d", resp.StatusCode)
	}

	var forecastResponse ForecastResponse
	if err := json.NewDecoder(resp.Body).Decode(&forecastResponse); err != nil {
		return nil, fmt.Errorf("failed to decode API response: %w", err)
	}
	
	return &forecastResponse, nil
} 
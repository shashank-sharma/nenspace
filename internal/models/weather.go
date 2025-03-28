package models

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*WeatherData)(nil)
var _ core.Model = (*WeatherForecast)(nil)

type WeatherData struct {
	BaseModel

	User          string         `db:"user" json:"user"`
	City          string         `db:"city" json:"city"`
	Lat           float64        `db:"lat" json:"lat"`
	Lon           float64        `db:"lon" json:"lon"`
	Country       string         `db:"country" json:"country"`
	Weather       string         `db:"weather" json:"weather"`
	Description   string         `db:"description" json:"description"`
	Icon          string         `db:"icon" json:"icon"`
	Temperature   float64        `db:"temperature" json:"temperature"`
	FeelsLike     float64        `db:"feels_like" json:"feels_like"`
	TempMin       float64        `db:"temp_min" json:"temp_min"`
	TempMax       float64        `db:"temp_max" json:"temp_max"`
	Pressure      int            `db:"pressure" json:"pressure"`
	Humidity      int            `db:"humidity" json:"humidity"`
	WindSpeed     float64        `db:"wind_speed" json:"wind_speed"`
	WindDeg       int            `db:"wind_deg" json:"wind_deg"`
	Clouds        int            `db:"clouds" json:"clouds"`
	Visibility    int            `db:"visibility" json:"visibility"`
	Sunrise       types.DateTime `db:"sunrise" json:"sunrise"`
	Sunset        types.DateTime `db:"sunset" json:"sunset"`
	Date          types.DateTime `db:"date" json:"date"`
	IsForecast    bool           `db:"is_forecast" json:"is_forecast"`
	LastUpdated   types.DateTime `db:"last_updated" json:"last_updated"`
	LocationQuery string         `db:"location_query" json:"location_query"`
	ExternalData  types.JSONRaw  `db:"external_data" json:"external_data"` // Deprecated: Field no longer used
}

type WeatherForecast struct {
	BaseModel

	User          string         `db:"user" json:"user"`
	City          string         `db:"city" json:"city"`
	Lat           float64        `db:"lat" json:"lat"`
	Lon           float64        `db:"lon" json:"lon"`
	Country       string         `db:"country" json:"country"`
	DayCount      int            `db:"day_count" json:"day_count"`
	StartDate     types.DateTime `db:"start_date" json:"start_date"`
	EndDate       types.DateTime `db:"end_date" json:"end_date"`
	ForecastData  types.JSONRaw  `db:"forecast_data" json:"forecast_data"`
	LastUpdated   types.DateTime `db:"last_updated" json:"last_updated"`
	LocationQuery string         `db:"location_query" json:"location_query"`
	ExternalData  types.JSONRaw  `db:"external_data" json:"external_data"`   // Deprecated: Field no longer used
}

func (m *WeatherData) TableName() string {
	return "weather_data"
}

func (m *WeatherForecast) TableName() string {
	return "weather_forecasts"
}

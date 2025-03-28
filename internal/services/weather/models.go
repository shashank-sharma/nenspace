package weather

// Coordinates structure for latitude and longitude
type Coordinates struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// WeatherCondition represents a weather condition in OpenWeatherMap response
type WeatherCondition struct {
	ID          int    `json:"id"`
	Main        string `json:"main"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
}

// MainWeatherData contains main weather metrics
type MainWeatherData struct {
	Temp      float64 `json:"temp"`
	FeelsLike float64 `json:"feels_like"`
	TempMin   float64 `json:"temp_min"`
	TempMax   float64 `json:"temp_max"`
	Pressure  int     `json:"pressure"`
	Humidity  int     `json:"humidity"`
}

// Wind contains wind data
type Wind struct {
	Speed float64 `json:"speed"`
	Deg   int     `json:"deg"`
	Gust  float64 `json:"gust,omitempty"`
}

// Clouds contains cloud data
type Clouds struct {
	All int `json:"all"` // Cloudiness percentage
}

// Sys contains system data like sunrise and sunset
type Sys struct {
	Type    int    `json:"type,omitempty"`
	ID      int    `json:"id,omitempty"`
	Country string `json:"country"`
	Sunrise int64  `json:"sunrise"`
	Sunset  int64  `json:"sunset"`
}

// CurrentWeatherResponse is the full response from OpenWeatherMap current weather API
type CurrentWeatherResponse struct {
	Coord      Coordinates       `json:"coord"`
	Weather    []WeatherCondition `json:"weather"`
	Base       string            `json:"base"`
	Main       MainWeatherData   `json:"main"`
	Visibility int               `json:"visibility"`
	Wind       Wind              `json:"wind"`
	Clouds     Clouds            `json:"clouds"`
	Dt         int64             `json:"dt"`
	Sys        Sys               `json:"sys"`
	Timezone   int               `json:"timezone"`
	ID         int               `json:"id"`
	Name       string            `json:"name"`
	Cod        int               `json:"cod"`
}

// ForecastListItem represents a single forecast time slot (3-hour forecast)
type ForecastListItem struct {
	Dt         int64             `json:"dt"`
	Main       MainWeatherData   `json:"main"`
	Weather    []WeatherCondition `json:"weather"`
	Clouds     Clouds            `json:"clouds"`
	Wind       Wind              `json:"wind"`
	Visibility int               `json:"visibility"`
	Pop        float64           `json:"pop"`
	Rain       struct {
		ThreeHour float64 `json:"3h,omitempty"`
	} `json:"rain,omitempty"`
	Snow struct {
		ThreeHour float64 `json:"3h,omitempty"`
	} `json:"snow,omitempty"`
	Sys struct {
		Pod string `json:"pod"`
	} `json:"sys"`
	DtTxt      string          `json:"dt_txt"`
}

// ForecastResponse is the full response from OpenWeatherMap forecast API
type ForecastResponse struct {
	Cod     string            `json:"cod"`
	Message int               `json:"message"`
	Cnt     int               `json:"cnt"`
	List    []ForecastListItem `json:"list"`
	City    struct {
		ID         int         `json:"id"`
		Name       string      `json:"name"`
		Coord      Coordinates `json:"coord"`
		Country    string      `json:"country"`
		Population int         `json:"population"`
		Timezone   int         `json:"timezone"`
		Sunrise    int64       `json:"sunrise"`
		Sunset     int64       `json:"sunset"`
	} `json:"city"`
}

// GeocodingResponse is the response from OpenWeatherMap geocoding API
type GeocodingResponse []struct {
	Name       string    `json:"name"`
	LocalNames map[string]string `json:"local_names"`
	Lat        float64   `json:"lat"`
	Lon        float64   `json:"lon"`
	Country    string    `json:"country"`
	State      string    `json:"state"`
} 
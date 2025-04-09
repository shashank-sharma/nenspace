export interface WeatherLocation {
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export interface WeatherCondition {
  condition: string;
  description: string;
  icon: string;
  icon_url: string;
}

export interface Temperature {
  current: number;
  feels_like: number;
  min: number;
  max: number;
  unit: string;
}

export interface WeatherDetails {
  pressure: number;
  humidity: number;
  wind_speed: number;
  wind_direction: string;
  clouds: number;
  visibility: number;
}

export interface SunInfo {
  sunrise: string;
  sunset: string;
}

export interface CurrentWeather {
  location: WeatherLocation;
  date: string;
  is_forecast: boolean;
  weather: WeatherCondition;
  temperature: Temperature;
  details: WeatherDetails;
  sun: SunInfo;
  last_updated: string;
}

export interface ForecastInterval {
  date: string;
  time: string;
  timestamp: number;
  weather: WeatherCondition;
  temperature: Temperature;
  humidity: number;
  wind_speed: number;
  wind_direction: string;
  clouds: number;
  probability_of_precipitation: number;
}

export interface ForecastDay {
  date: string;
  day_of_week: string;
  intervals: ForecastInterval[];
}

export interface WeatherForecast {
  location: WeatherLocation;
  forecast: {
    days: ForecastDay[];
    start_date: string;
    end_date: string;
  };
  last_updated: string;
}

export interface WeatherState {
  currentWeather: CurrentWeather | null;
  forecast: WeatherForecast | null;
  isLoading: boolean;
  error: string | null;
  location: string;
  units: 'metric' | 'imperial' | 'standard';
  lang: string;
  days: number;
  lastCurrentWeatherFetch: number;
  lastForecastFetch: number;
} 
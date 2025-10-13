import { browser } from '$app/environment';
import type { CurrentWeather, WeatherForecast } from '../types';
import { STORAGE_KEYS, WEATHER_API_CONFIG, WEATHER_CACHE_TIMEOUT } from '../constants';
import type { WeatherType } from '../constants';
import { mapWeatherToBackground } from '../utils/weather-mapping.util';

/**
 * WeatherStore
 * Global state management for weather data using Svelte 5 runes
 */
class WeatherStore {
    currentWeather = $state<CurrentWeather | null>(null);
    forecast = $state<WeatherForecast | null>(null);
    isLoading = $state(false);
    error = $state<string | null>(null);
    location = $state(WEATHER_API_CONFIG.DEFAULT_LOCATION);
    units = $state<'metric' | 'imperial' | 'standard'>(WEATHER_API_CONFIG.DEFAULT_UNITS);
    lang = $state(WEATHER_API_CONFIG.DEFAULT_LANG);
    days = $state(WEATHER_API_CONFIG.DEFAULT_FORECAST_DAYS);
    lastCurrentWeatherFetch = $state(0);
    lastForecastFetch = $state(0);

    constructor() {
        // Load initial state from localStorage
        if (browser) {
            this.loadFromLocalStorage();
        }
    }

    // Computed properties
    get isCurrentWeatherStale() {
        return this.isDataStale(this.lastCurrentWeatherFetch);
    }

    get isForecastStale() {
        return this.isDataStale(this.lastForecastFetch);
    }

    get hasWeatherData() {
        return this.currentWeather !== null;
    }

    get hasForecastData() {
        return this.forecast !== null;
    }

    get weatherBackground(): WeatherType {
        return mapWeatherToBackground(this.currentWeather);
    }

    // State management methods
    reset() {
        this.currentWeather = null;
        this.forecast = null;
        this.isLoading = false;
        this.error = null;
        this.location = WEATHER_API_CONFIG.DEFAULT_LOCATION;
        this.units = WEATHER_API_CONFIG.DEFAULT_UNITS;
        this.lang = WEATHER_API_CONFIG.DEFAULT_LANG;
        this.days = WEATHER_API_CONFIG.DEFAULT_FORECAST_DAYS;
        this.lastCurrentWeatherFetch = 0;
        this.lastForecastFetch = 0;

        if (browser) {
            localStorage.removeItem(STORAGE_KEYS.WEATHER_STATE);
            localStorage.removeItem(STORAGE_KEYS.WEATHER_LOCATION);
        }
    }

    setLocation(location: string) {
        this.location = location;
        // Reset fetch timestamps to force new data
        this.lastCurrentWeatherFetch = 0;
        this.lastForecastFetch = 0;
        this.saveToLocalStorage();
    }

    setUnits(units: 'metric' | 'imperial' | 'standard') {
        this.units = units;
        // Reset fetch timestamps to force new data
        this.lastCurrentWeatherFetch = 0;
        this.lastForecastFetch = 0;
        this.saveToLocalStorage();
    }

    setLang(lang: string) {
        this.lang = lang;
        // Reset fetch timestamps to force new data
        this.lastCurrentWeatherFetch = 0;
        this.lastForecastFetch = 0;
        this.saveToLocalStorage();
    }

    setDays(days: number) {
        if (
            days >= WEATHER_API_CONFIG.MIN_FORECAST_DAYS &&
            days <= WEATHER_API_CONFIG.MAX_FORECAST_DAYS
        ) {
            this.days = days;
            // Reset forecast timestamp to force new data
            this.lastForecastFetch = 0;
            this.saveToLocalStorage();
        }
    }

    setCurrentWeather(weather: CurrentWeather) {
        this.currentWeather = weather;
        this.lastCurrentWeatherFetch = Date.now();
        this.error = null;
        this.saveToLocalStorage();
    }

    setForecast(forecast: WeatherForecast) {
        this.forecast = forecast;
        this.lastForecastFetch = Date.now();
        this.error = null;
        this.saveToLocalStorage();
    }

    setLoading(loading: boolean) {
        this.isLoading = loading;
    }

    setError(error: string | null) {
        this.error = error;
        this.isLoading = false;
    }

    // Helper methods
    private isDataStale(lastFetchTime: number): boolean {
        const now = Date.now();
        return !lastFetchTime || now - lastFetchTime > WEATHER_CACHE_TIMEOUT;
    }

    // Local storage persistence
    private saveToLocalStorage() {
        if (browser) {
            const state = {
                currentWeather: this.currentWeather,
                forecast: this.forecast,
                location: this.location,
                units: this.units,
                lang: this.lang,
                days: this.days,
                lastCurrentWeatherFetch: this.lastCurrentWeatherFetch,
                lastForecastFetch: this.lastForecastFetch,
            };
            localStorage.setItem(STORAGE_KEYS.WEATHER_STATE, JSON.stringify(state));
            localStorage.setItem(STORAGE_KEYS.WEATHER_LOCATION, this.location);
        }
    }

    private loadFromLocalStorage() {
        if (browser) {
            try {
                const saved = localStorage.getItem(STORAGE_KEYS.WEATHER_STATE);
                if (saved) {
                    const state = JSON.parse(saved);
                    this.currentWeather = state.currentWeather || null;
                    this.forecast = state.forecast || null;
                    this.location = state.location || WEATHER_API_CONFIG.DEFAULT_LOCATION;
                    this.units = state.units || WEATHER_API_CONFIG.DEFAULT_UNITS;
                    this.lang = state.lang || WEATHER_API_CONFIG.DEFAULT_LANG;
                    this.days = state.days || WEATHER_API_CONFIG.DEFAULT_FORECAST_DAYS;
                    this.lastCurrentWeatherFetch = state.lastCurrentWeatherFetch || 0;
                    this.lastForecastFetch = state.lastForecastFetch || 0;
                }
            } catch (error) {
                // Silently fail - invalid localStorage data will be ignored
            }
        }
    }
}

// Export singleton instance
export const weatherStore = new WeatherStore();

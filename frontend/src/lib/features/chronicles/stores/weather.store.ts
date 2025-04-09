import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { CurrentWeather, WeatherForecast, WeatherState } from '../types';
import { toast } from 'svelte-sonner';
import { pb } from '$lib/config/pocketbase';

// Cache timeout duration in milliseconds (5 minutes)
const CACHE_TIMEOUT = 5 * 60 * 1000;

const initialState: WeatherState = {
    currentWeather: null,
    forecast: null,
    isLoading: false,
    error: null,
    location: browser ? localStorage.getItem('weatherLocation') || 'London' : 'London',
    units: 'metric',
    lang: 'en',
    days: 5,
    lastCurrentWeatherFetch: 0,
    lastForecastFetch: 0
};

// Load state from localStorage if available
function getInitialState(): WeatherState {
    if (browser) {
        const savedState = localStorage.getItem('weatherState');
        if (savedState) {
            try {
                return JSON.parse(savedState);
            } catch (e) {
                console.error('Failed to parse saved weather state', e);
            }
        }
    }
    return initialState;
}

function createWeatherStore() {
    const { subscribe, set, update } = writable<WeatherState>(getInitialState());

    // Save state to localStorage whenever it changes
    const saveToLocalStorage = (state: WeatherState) => {
        if (browser) {
            localStorage.setItem('weatherState', JSON.stringify(state));
            // Also save just the location separately for easy access
            localStorage.setItem('weatherLocation', state.location);
        }
    };

    const mapWeatherToBackground = (weather: CurrentWeather | null) => {
        if (!weather) return 'partly-cloudy';
        
        const condition = weather.weather.condition.toLowerCase();
        const cloudiness = weather.details.clouds;
        const hour = new Date(weather.date).getHours();
        const isNight = hour < 6 || hour > 18;
        
        if (isNight) return 'stardust';
        
        if (condition.includes('rain') || condition.includes('drizzle')) return 'rainy';
        if (condition.includes('thunderstorm') || condition.includes('storm')) return 'stormy';
        if (condition.includes('snow')) return 'cloudy';
        if (condition.includes('clear')) return 'sunny';
        if (cloudiness < 25) return 'sunny';
        if (cloudiness < 50) return 'partly-cloudy';
        return 'cloudy';
    };

    // Check if data is still fresh or needs to be fetched again
    const isDataStale = (lastFetchTime: number): boolean => {
        const now = Date.now();
        return !lastFetchTime || (now - lastFetchTime > CACHE_TIMEOUT);
    };

    return {
        subscribe,
        
        // Reset store to initial state
        reset() {
            set(initialState);
            if (browser) {
                localStorage.removeItem('weatherState');
            }
        },
        
        // Update location
        setLocation(location: string) {
            update(state => {
                const newState = { 
                    ...state, 
                    location,
                    // Reset fetch timestamps when location changes to force new data
                    lastCurrentWeatherFetch: 0,
                    lastForecastFetch: 0
                };
                saveToLocalStorage(newState);
                return newState;
            });
        },
        
        // Update units
        setUnits(units: 'metric' | 'imperial' | 'standard') {
            update(state => {
                const newState = { 
                    ...state, 
                    units,
                    // Reset fetch timestamps when units change to force new data
                    lastCurrentWeatherFetch: 0,
                    lastForecastFetch: 0
                };
                saveToLocalStorage(newState);
                return newState;
            });
        },
        
        // Update language
        setLang(lang: string) {
            update(state => {
                const newState = { 
                    ...state, 
                    lang,
                    // Reset fetch timestamps when language changes to force new data
                    lastCurrentWeatherFetch: 0,
                    lastForecastFetch: 0
                };
                saveToLocalStorage(newState);
                return newState;
            });
        },
        
        // Update forecast days
        setDays(days: number) {
            if (days < 1 || days > 5) {
                console.error('Days must be between 1 and 5');
                return;
            }
            update(state => {
                const newState = { 
                    ...state, 
                    days,
                    // Reset forecast fetch timestamp when days change to force new data
                    lastForecastFetch: 0
                };
                saveToLocalStorage(newState);
                return newState;
            });
        },
        
        // Fetch current weather data using PocketBase
        async fetchCurrentWeather(force = false) {
            let currentState: WeatherState;
            let shouldFetch = false;
            
            // First get the current state and check if we need to fetch
            update(state => {
                currentState = { ...state };
                shouldFetch = force || isDataStale(state.lastCurrentWeatherFetch) || !state.currentWeather;
                
                // Only set loading if we're actually going to fetch
                return shouldFetch ? { ...state, isLoading: true } : state;
            });
            
            // If we don't need to fetch, return early
            if (!shouldFetch) {
                return;
            }
            
            try {
                // Use PocketBase to send a request to the custom API endpoint
                const data = await pb.send('/api/weather/current', {
                    method: 'GET',
                    params: {
                        location: currentState!.location,
                        units: currentState!.units,
                        lang: currentState!.lang
                    }
                });
                
                update(state => {
                    const newState = { 
                        ...state, 
                        currentWeather: data,
                        isLoading: false,
                        error: null,
                        lastCurrentWeatherFetch: Date.now()
                    };
                    saveToLocalStorage(newState);
                    return newState;
                });
            } catch (error) {
                console.error('Error fetching current weather:', error);
                update(state => ({ 
                    ...state, 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to fetch weather data' 
                }));
                toast.error('Failed to load weather data');
            }
        },
        
        // Fetch forecast data using PocketBase
        async fetchForecast(force = false) {
            let currentState: WeatherState;
            let shouldFetch = false;
            
            // First get the current state and check if we need to fetch
            update(state => {
                currentState = { ...state };
                shouldFetch = force || isDataStale(state.lastForecastFetch) || !state.forecast;
                
                // Only set loading if we're actually going to fetch
                return shouldFetch ? { ...state, isLoading: true } : state;
            });
            
            // If we don't need to fetch, return early
            if (!shouldFetch) {
                return;
            }
            
            try {
                // Use PocketBase to send a request to the custom API endpoint
                const data = await pb.send('/api/weather/forecast', {
                    method: 'GET',
                    params: {
                        location: currentState!.location,
                        days: currentState!.days,
                        units: currentState!.units,
                        lang: currentState!.lang
                    }
                });
                
                update(state => {
                    const newState = { 
                        ...state, 
                        forecast: data,
                        isLoading: false,
                        error: null,
                        lastForecastFetch: Date.now()
                    };
                    saveToLocalStorage(newState);
                    return newState;
                });
            } catch (error) {
                console.error('Error fetching forecast:', error);
                update(state => ({ 
                    ...state, 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to fetch forecast data' 
                }));
                toast.error('Failed to load weather forecast');
            }
        },
        
        // Fetch both current weather and forecast (if needed)
        async fetchAllWeatherData(force = false) {
            await this.fetchCurrentWeather(force);
            await this.fetchForecast(force);
        },
        
        // Get weather-based background for Chronicles
        getWeatherBackground() {
            let currentWeather: CurrentWeather | null = null;
            
            // Get current weather from the store
            update(state => {
                currentWeather = state.currentWeather;
                return state;
            });
            
            return mapWeatherToBackground(currentWeather);
        }
    };
}

export const weatherStore = createWeatherStore(); 
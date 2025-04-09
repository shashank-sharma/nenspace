import { browser } from '$app/environment';
import { weatherStore } from '../stores';
import { get } from 'svelte/store';

/**
 * Ensures that weather data is loaded when components need it.
 * This function centralizes weather data fetching to prevent
 * multiple components from triggering redundant API calls.
 * 
 * @param fetchForecast - Whether to also fetch forecast data
 * @param force - Whether to force a fresh API call
 */
export function ensureWeatherData(fetchForecast: boolean = false, force: boolean = false): void {
  // We need to check if this is running in the browser
  if (!browser) return;
  
  // Get the current state once to avoid multiple store subscriptions
  const storeState = get(weatherStore);
  
  // Always fetch current weather when needed
  weatherStore.fetchCurrentWeather(force);
  
  // Only fetch forecast if requested
  if (fetchForecast) {
    weatherStore.fetchForecast(force);
  }
}

/**
 * A more comprehensive function that loads all weather data at once
 * 
 * @param force - Whether to force fresh API calls
 */
export function loadAllWeatherData(force: boolean = false): void {
  if (!browser) return;
  weatherStore.fetchAllWeatherData(force);
} 
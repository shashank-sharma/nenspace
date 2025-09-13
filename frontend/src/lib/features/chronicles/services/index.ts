import { browser } from '$app/environment';
import { ensureWeatherData } from '../utils/weather.utils';

/**
 * Initialize weather data.
 * This function handles the weather data pre-loading and can be called from specific routes.
 * 
 * @param fetchForecast - Whether to also fetch forecast data
 * @param force - Whether to force a fresh API call
 */
export function initWeather(fetchForecast: boolean = false, force: boolean = false): void {
  if (browser) {
    ensureWeatherData(fetchForecast, force);
  }
} 
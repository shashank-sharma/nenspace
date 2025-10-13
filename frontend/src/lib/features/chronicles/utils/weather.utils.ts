import { browser } from '$app/environment';
import { weatherStore } from '../stores';
import { WeatherService } from '../services';
import { withErrorHandling } from '$lib/utils/error-handler.util';

/**
 * Ensures that weather data is loaded when components need it.
 * This function centralizes weather data fetching to prevent
 * multiple components from triggering redundant API calls.
 *
 * @param fetchForecast - Whether to also fetch forecast data
 * @param force - Whether to force a fresh API call
 */
export async function ensureWeatherData(
    fetchForecast: boolean = false,
    force: boolean = false
): Promise<void> {
    // We need to check if this is running in the browser
    if (!browser) return;

    // Check if we need to fetch current weather
    if (force || weatherStore.isCurrentWeatherStale || !weatherStore.hasWeatherData) {
        await fetchCurrentWeather(force);
    }

    // Only fetch forecast if requested and needed
    if (fetchForecast && (force || weatherStore.isForecastStale || !weatherStore.hasForecastData)) {
        await fetchForecast(force);
    }
}

/**
 * Fetch current weather data
 */
async function fetchCurrentWeather(force: boolean = false): Promise<void> {
    if (!browser) return;

    // Skip if data is still fresh and not forcing
    if (!force && !weatherStore.isCurrentWeatherStale && weatherStore.hasWeatherData) {
        return;
    }

    weatherStore.setLoading(true);

    await withErrorHandling(
        async () => {
            const data = await WeatherService.getCurrentWeather(
                weatherStore.location,
                weatherStore.units,
                weatherStore.lang
            );
            weatherStore.setCurrentWeather(data);
        },
        {
            errorMessage: 'Failed to load weather data',
            showToast: false, // Don't show toast for weather failures
            onError: (error) => {
                weatherStore.setError(error instanceof Error ? error.message : 'Unknown error');
            },
            onSuccess: () => {
                weatherStore.setLoading(false);
            },
        }
    );
}

/**
 * Fetch weather forecast data
 */
async function fetchForecast(force: boolean = false): Promise<void> {
    if (!browser) return;

    // Skip if data is still fresh and not forcing
    if (!force && !weatherStore.isForecastStale && weatherStore.hasForecastData) {
        return;
    }

    weatherStore.setLoading(true);

    await withErrorHandling(
        async () => {
            const data = await WeatherService.getForecast(
                weatherStore.location,
                weatherStore.days,
                weatherStore.units,
                weatherStore.lang
            );
            weatherStore.setForecast(data);
        },
        {
            errorMessage: 'Failed to load weather forecast',
            showToast: false, // Don't show toast for weather failures
            onError: (error) => {
                weatherStore.setError(error instanceof Error ? error.message : 'Unknown error');
            },
            onSuccess: () => {
                weatherStore.setLoading(false);
            },
        }
    );
}

/**
 * A more comprehensive function that loads all weather data at once
 *
 * @param force - Whether to force fresh API calls
 */
export async function loadAllWeatherData(force: boolean = false): Promise<void> {
    if (!browser) return;

    await Promise.all([fetchCurrentWeather(force), fetchForecast(force)]);
}
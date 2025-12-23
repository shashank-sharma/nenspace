import type { CurrentWeather } from '../types';
import type { WeatherType } from '../constants';

/**
 * Maps weather API data to background weather type
 */
export function mapWeatherToBackground(weather: CurrentWeather | null): WeatherType {
    if (!weather || !weather.weather || !weather.details) return 'partly-cloudy';

    const condition = weather.weather.condition?.toLowerCase() || '';
    const cloudiness = weather.details.clouds ?? 0;
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
}

/**
 * Determines weather type from weather condition data
 */
export function getWeatherType(
    condition: string,
    cloudiness: number,
    hour: number
): WeatherType {
    const isNight = hour < 6 || hour > 18;
    const lowerCondition = condition.toLowerCase();

    if (isNight) return 'stardust';
    if (lowerCondition.includes('rain') || lowerCondition.includes('drizzle')) return 'rainy';
    if (lowerCondition.includes('thunderstorm') || lowerCondition.includes('storm'))
        return 'stormy';
    if (lowerCondition.includes('snow')) return 'cloudy';
    if (lowerCondition.includes('clear')) return 'sunny';
    if (cloudiness < 25) return 'sunny';
    if (cloudiness < 50) return 'partly-cloudy';
    return 'cloudy';
}

/**
 * Formats date for journal entry
 */
export function formatDateForEntry(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Formats date for entry title (removes hyphens)
 */
export function formatDateForTitle(date: Date): string {
    return formatDateForEntry(date).replace(/-/g, '');
}

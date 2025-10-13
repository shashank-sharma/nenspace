import { pb } from '$lib/config/pocketbase';
import type { CurrentWeather, WeatherForecast } from '../types';

/**
 * WeatherService
 * Handles weather data fetching from backend API
 */
export class WeatherService {
    /**
     * Fetch current weather data
     * @throws Error if fetch fails
     */
    static async getCurrentWeather(
        location: string,
        units: 'metric' | 'imperial' | 'standard' = 'metric',
        lang = 'en'
    ): Promise<CurrentWeather> {
        const data = await pb.send('/api/weather/current', {
            method: 'GET',
            params: {
                location,
                units,
                lang,
            },
        });

        return data as CurrentWeather;
    }

    /**
     * Fetch weather forecast
     * @throws Error if fetch fails
     */
    static async getForecast(
        location: string,
        days: number = 5,
        units: 'metric' | 'imperial' | 'standard' = 'metric',
        lang = 'en'
    ): Promise<WeatherForecast> {
        if (days < 1 || days > 5) {
            throw new Error('Forecast days must be between 1 and 5');
        }

        const data = await pb.send('/api/weather/forecast', {
            method: 'GET',
            params: {
                location,
                days,
                units,
                lang,
            },
        });

        return data as WeatherForecast;
    }

    /**
     * Fetch both current weather and forecast
     * @throws Error if either fetch fails
     */
    static async getAllWeatherData(
        location: string,
        days: number = 5,
        units: 'metric' | 'imperial' | 'standard' = 'metric',
        lang = 'en'
    ): Promise<{ current: CurrentWeather; forecast: WeatherForecast }> {
        const [current, forecast] = await Promise.all([
            WeatherService.getCurrentWeather(location, units, lang),
            WeatherService.getForecast(location, days, units, lang),
        ]);

        return { current, forecast };
    }
}
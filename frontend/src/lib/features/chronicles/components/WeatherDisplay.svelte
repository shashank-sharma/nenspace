<script lang="ts">
    import { Card } from "$lib/components/ui/card";
    import { weatherStore } from "../stores";
    import { onMount } from "svelte";
    import { ensureWeatherData } from "../utils/weather.utils";
    import {
        Cloud,
        CloudRain,
        CloudSnow,
        CloudLightning,
        Sun,
        SunDim,
        Wind,
    } from "lucide-svelte";

    let { showForecast = false, compact = true } = $props<{
        showForecast?: boolean;
        compact?: boolean;
    }>();

    function formatTemp(temp: number | undefined): string {
        if (temp === undefined) return "--";
        return `${Math.round(temp)}°`;
    }

    function formatTime(isoString: string | undefined): string {
        if (!isoString) return "--";
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch (e) {
            return "--";
        }
    }

    function formatDay(dateStr: string): string {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString([], { weekday: "short" });
        } catch (e) {
            return "--";
        }
    }

    function getWeatherIcon(condition: string | undefined) {
        if (!condition) return Sun;

        const lowerCondition = condition.toLowerCase();

        if (
            lowerCondition.includes("rain") ||
            lowerCondition.includes("drizzle")
        ) {
            return CloudRain;
        } else if (
            lowerCondition.includes("thunderstorm") ||
            lowerCondition.includes("storm")
        ) {
            return CloudLightning;
        } else if (lowerCondition.includes("snow")) {
            return CloudSnow;
        } else if (lowerCondition.includes("cloud")) {
            return Cloud;
        } else if (
            lowerCondition.includes("fog") ||
            lowerCondition.includes("mist")
        ) {
            return SunDim;
        } else if (lowerCondition.includes("wind")) {
            return Wind;
        } else {
            return Sun;
        }
    }

    onMount(() => {
        ensureWeatherData(showForecast);
    });
</script>

<div class="weather-container">
    {#if weatherStore.isLoading}
        <Card
            class="p-3 flex items-center justify-center {compact
                ? 'compact-card'
                : ''}"
        >
            <div class="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
        </Card>
    {:else if weatherStore.error}
        <Card
            class="p-3 flex flex-col items-center text-center {compact
                ? 'compact-card'
                : ''}"
        >
            <div class="text-destructive">
                <SunDim class="h-6 w-6 mb-1 mx-auto" />
                <p class="text-sm">Weather unavailable</p>
            </div>
        </Card>
    {:else if weatherStore.currentWeather}
        <Card
            class="relative overflow-hidden {compact ? 'compact-card' : ''} p-4"
        >
            <div class="flex items-center justify-between">
                <!-- Location and Icon -->
                <div class="flex items-center">
                    <svelte:component
                        this={getWeatherIcon(
                            weatherStore.currentWeather.weather.condition,
                        )}
                        class="h-8 w-8 mr-2 text-primary"
                    />
                    <div>
                        <div class="font-medium">
                            {weatherStore.currentWeather.location.city}
                        </div>
                        <div class="text-xs text-muted-foreground">
                            {weatherStore.currentWeather.weather.description}
                        </div>
                    </div>
                </div>

                <!-- Temperature -->
                <div class="text-right">
                    <div class="text-xl font-bold">
                        {formatTemp(
                            weatherStore.currentWeather.temperature.current,
                        )}
                    </div>
                    <div class="text-xs text-muted-foreground">
                        Feels like {formatTemp(
                            weatherStore.currentWeather.temperature.feels_like,
                        )}
                    </div>
                </div>
            </div>

            <!-- Weather Details -->
            <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div class="detail-item">
                    <span class="text-muted-foreground">Humidity</span>
                    <span class="font-medium"
                        >{weatherStore.currentWeather.details.humidity}%</span
                    >
                </div>
                <div class="detail-item">
                    <span class="text-muted-foreground">Wind</span>
                    <span class="font-medium"
                        >{weatherStore.currentWeather.details.wind_speed}
                        {weatherStore.currentWeather.details
                            .wind_direction}</span
                    >
                </div>
                <div class="detail-item">
                    <span class="text-muted-foreground">Sunrise</span>
                    <span class="font-medium"
                        >{formatTime(
                            weatherStore.currentWeather.sun.sunrise,
                        )}</span
                    >
                </div>
                <div class="detail-item">
                    <span class="text-muted-foreground">Sunset</span>
                    <span class="font-medium"
                        >{formatTime(
                            weatherStore.currentWeather.sun.sunset,
                        )}</span
                    >
                </div>
            </div>

            <!-- Forecast (if enabled) -->
            {#if showForecast && weatherStore.forecast}
                <div class="weather-forecast mt-4 pt-4 border-t">
                    <h4 class="text-sm font-medium mb-2">5-Day Forecast</h4>
                    <div class="forecast-items flex overflow-x-auto gap-2 pb-1">
                        {#each weatherStore.forecast.forecast.days as day}
                            <div
                                class="forecast-day flex flex-col items-center min-w-[4rem] p-2"
                            >
                                <div class="text-xs font-medium">
                                    {formatDay(day.date)}
                                </div>
                                <svelte:component
                                    this={getWeatherIcon(
                                        day.intervals[0]?.weather.condition,
                                    )}
                                    class="h-5 w-5 my-1 text-primary"
                                />
                                <div class="text-xs">
                                    {formatTemp(
                                        day.intervals[0]?.temperature.max,
                                    )}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Last Updated -->
            <div class="text-xs text-muted-foreground mt-2 text-right">
                Last updated: {formatTime(
                    weatherStore.currentWeather.last_updated,
                )}
            </div>
        </Card>
    {:else}
        <Card
            class="p-4 flex justify-center items-center {compact
                ? 'compact-card'
                : ''}"
        >
            <p class="text-sm text-muted-foreground">
                No weather data available
            </p>
        </Card>
    {/if}
</div>

<style>
    .weather-container {
        width: 100%;
    }

    .detail-item {
        display: flex;
        flex-direction: column;
    }

    .forecast-items {
        scrollbar-width: thin;
    }

    .forecast-items::-webkit-scrollbar {
        height: 4px;
    }

    .forecast-items::-webkit-scrollbar-track {
        background: var(--background);
    }

    .forecast-items::-webkit-scrollbar-thumb {
        background-color: var(--border);
        border-radius: 4px;
    }

    .compact-card {
        background-color: var(--background);
        backdrop-filter: blur(8px);
        border: 1px solid var(--border);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
</style>

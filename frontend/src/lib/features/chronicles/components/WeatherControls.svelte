<script lang="ts">
    import type { Weather } from "../types/chronicle.types";
    import { createEventDispatcher } from "svelte";

    export let currentWeather: Weather = "sunny";

    const weatherOptions: Weather[] = [
        "sunny",
        "partly-cloudy",
        "cloudy",
        "rainy",
        "stormy",
        "aurora",
        "stardust",
    ];

    const weatherLabels: Record<Weather, string> = {
        sunny: "Sunny",
        "partly-cloudy": "Partly Cloudy",
        cloudy: "Cloudy",
        rainy: "Rainy",
        stormy: "Stormy",
        aurora: "Aurora",
        stardust: "Stardust",
    };

    const dispatch = createEventDispatcher<{
        weatherChange: { weather: Weather };
    }>();

    function handleWeatherChange(weather: Weather) {
        if (weather !== currentWeather) {
            currentWeather = weather;
            dispatch("weatherChange", { weather });
        }
    }
</script>

<div class="weather-controls">
    <div
        class="flex flex-wrap gap-2 p-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-md"
    >
        {#each weatherOptions as weather}
            <button
                class="px-3 py-1.5 text-xs font-medium rounded transition-all duration-300
              {currentWeather === weather
                    ? 'bg-sky-500 text-white shadow-md'
                    : 'bg-white/60 text-gray-700 hover:bg-sky-100'}"
                on:click={() => handleWeatherChange(weather)}
                aria-label="Set weather to {weatherLabels[weather]}"
                title={weatherLabels[weather]}
            >
                {weatherLabels[weather]}
            </button>
        {/each}
    </div>
</div>

<style>
    .weather-controls {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 50;
    }
</style>

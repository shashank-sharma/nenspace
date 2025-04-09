<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { Card } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from "$lib/components/ui/select";
    import { pb } from "$lib/config/pocketbase";
    import { toast } from "svelte-sonner";
    import { Carta, MarkdownEditor } from "carta-md";
    import ChronicleMetadata from "./ChronicleMetadata.svelte";
    import ChronicleTimeline from "./ChronicleTimeline.svelte";
    import ChronicleBackground from "./ChronicleBackground.svelte";
    import WeatherDisplay from "./WeatherDisplay.svelte";
    import "carta-md/default.css";
    import DOMPurify from "isomorphic-dompurify";
    import { getContext } from "svelte";
    import { chroniclesStore, weatherStore } from "../stores";
    import ChronicleJournalFlow from "./ChronicleJournalFlow.svelte";
    import ChroniclePreview from "./ChroniclePreview.svelte";
    import { Sparkles, Calendar, Edit, Eye, Code } from "lucide-svelte";
    import * as Tabs from "$lib/components/ui/tabs";
    import { fade, fly, slide } from "svelte/transition";
    import { page } from "$app/stores";
    import type { Weather, WeatherState } from "../types";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { ensureWeatherData } from "../utils/weather.utils";

    const theme = getContext("theme") as { theme: string };

    let date = new Date();
    let selectedDate = date;

    $: formattedDate = date.toISOString().split("T")[0].replace(/-/g, "");
    $: displayDate = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(date);

    let content = "";
    let mood = "neutral";
    let tags = "";
    let isLoading = false;
    let editorHeight = 0;

    let carta = new Carta({
        sanitizer: DOMPurify.sanitize,
        theme: theme.theme === "dark" ? "github-dark" : "github-light",
    });

    // Add state for the current weather theme
    let currentWeather: Weather = "partly-cloudy";

    // Listen for weather changes from debug panel
    onMount(() => {
        // Initialize weather data using the centralized utility function
        ensureWeatherData();

        // Subscribe to weather store to update background
        const weatherUnsubscribe = weatherStore.subscribe((state) => {
            if (state.currentWeather) {
                // Map weather data to background weather type
                updateWeatherFromCondition(state);
            }
        });

        // Load initial weather from localStorage if available
        if (browser) {
            try {
                const storedSettings = localStorage.getItem(
                    "chroniclesDebugSettings",
                );
                if (storedSettings) {
                    const settings = JSON.parse(storedSettings);
                    if (settings.currentWeather) {
                        currentWeather = settings.currentWeather as Weather;
                    }
                }
            } catch (error) {
                console.error("Error loading debug settings:", error);
            }

            // Listen for changes from the debug panel
            const handleDebugSettingsChange = (event: CustomEvent) => {
                const settings = event.detail;
                if (settings.currentWeather) {
                    currentWeather = settings.currentWeather as Weather;
                }
            };

            document.addEventListener(
                "chronicles-debug-settings-changed",
                handleDebugSettingsChange as EventListener,
            );

            return () => {
                document.removeEventListener(
                    "chronicles-debug-settings-changed",
                    handleDebugSettingsChange as EventListener,
                );
                weatherUnsubscribe();
            };
        }

        return () => {
            weatherUnsubscribe();
        };
    });

    // Function to update weather background based on API data
    function updateWeatherFromCondition(state: WeatherState) {
        const weather = state.currentWeather;
        if (!weather) return;

        const condition = weather.weather.condition.toLowerCase();
        const cloudiness = weather.details.clouds;
        const hour = new Date(weather.date).getHours();
        const isNight = hour < 6 || hour > 18;

        if (isNight) {
            currentWeather = "stardust";
        } else if (
            condition.includes("rain") ||
            condition.includes("drizzle")
        ) {
            currentWeather = "rainy";
        } else if (
            condition.includes("thunderstorm") ||
            condition.includes("storm")
        ) {
            currentWeather = "stormy";
        } else if (condition.includes("snow")) {
            currentWeather = "cloudy";
        } else if (condition.includes("clear")) {
            currentWeather = "sunny";
        } else if (cloudiness < 25) {
            currentWeather = "sunny";
        } else if (cloudiness < 50) {
            currentWeather = "partly-cloudy";
        } else {
            currentWeather = "cloudy";
        }
    }

    // Map current month to season
    function getCurrentSeason(): "Winter" | "Spring" | "Summer" | "Autumn" {
        const month = new Date().getMonth();

        if (month >= 2 && month <= 4) return "Spring";
        if (month >= 5 && month <= 7) return "Summer";
        if (month >= 8 && month <= 10) return "Autumn";
        return "Winter"; // months 11, 0, 1 (Dec, Jan, Feb)
    }

    // Initial season based on current month
    let currentSeason = getCurrentSeason();

    // Check if we're on the chronicles page to show debug controls
    $: isChroniclesPage = $page.url.pathname.includes("/dashboard/chronicles");

    async function loadJournalEntry(selectedDate: Date) {
        await chroniclesStore.loadEntry(selectedDate);
    }

    function handleDateSelect(newDate: Date) {
        date = newDate;
        selectedDate = newDate;
        loadJournalEntry(newDate);
    }

    // Handler for view mode change
    function handleViewModeChange(val: string | undefined) {
        if (val === "edit" || val === "preview" || val === "markdown") {
            chroniclesStore.setViewMode(val);
        }
    }

    // Function to update the weather from child component
    function handleWeatherChange(weather: Weather) {
        currentWeather = weather;

        // Map weather to season
        if (weather === "sunny" || weather === "partly-cloudy") {
            currentSeason = "Summer";
        } else if (weather === "cloudy" || weather === "rainy") {
            currentSeason = "Spring";
        } else if (weather === "stormy") {
            currentSeason = "Autumn";
        } else if (weather === "aurora" || weather === "stardust") {
            currentSeason = "Winter";
        }
    }

    onMount(async () => {
        await loadJournalEntry(date);

        // If there's no entry for today, initialize the flow
        if (!$chroniclesStore.hasEntryForToday) {
            chroniclesStore.createEmptyEntry();
        }
    });

    async function handleSave() {
        if (!content.trim()) {
            toast.error("Please write some content");
            return;
        }

        isLoading = true;

        try {
            const data = {
                user: pb.authStore.model?.id,
                title: formattedDate,
                content,
                date: date.toISOString().split("T")[0],
                mood,
                tags,
            };

            try {
                const existingRecord = await pb
                    .collection("journal_entries")
                    .getFirstListItem(
                        `date = "${date.toISOString().split("T")[0]}" && user = "${pb.authStore.model?.id}"`,
                    );
                await pb
                    .collection("journal_entries")
                    .update(existingRecord.id, data);
                toast.success("Updated successfully");
            } catch {
                await pb.collection("journal_entries").create(data);
                toast.success("Saved successfully");
            }
        } catch (error) {
            console.error("Error saving entry:", error);
            toast.error("Failed to save");
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="mx-auto p-2 sm:p-4 chronicles-page-container">
    <!-- Replace static background with ChronicleBackground -->
    <div class="chronicles-background-container">
        <ChronicleBackground
            startingSeason={currentSeason}
            enableControls={false}
            height="100vh"
            width="100%"
            weather={currentWeather}
        />
    </div>

    <!-- Weather component at top right -->
    <div class="weather-top-right">
        <WeatherDisplay showForecast={false} compact={true} />
    </div>

    <!-- Page Header with Date - Add chronicles-title-area class -->
    <div
        class="mb-4 sm:mb-6 justify-center text-center chronicles-title-area relative z-10"
    >
        <div class="mb-2 date-title mx-8">
            <h2
                class="text-xl font-semibold flex items-center justify-center gap-2"
            >
                <Sparkles class="h-5 w-5 text-primary" />
                <span>{displayDate}</span>
            </h2>
            <p class="text-sm text-muted-foreground">
                Entry #{formattedDate}
            </p>
        </div>

        <!-- View Mode Selector -->
        <div class="w-full max-w-md mx-auto mt-4 mb-6">
            <Tabs.Root
                value={$chroniclesStore.viewMode}
                onValueChange={handleViewModeChange}
                class="tab-container"
            >
                <Tabs.List class="grid grid-cols-3 tab-list">
                    <Tabs.Trigger
                        value="edit"
                        class="tab-trigger flex items-center justify-center gap-1"
                    >
                        <Edit class="h-4 w-4" />
                        <span class="hidden sm:inline">Edit</span>
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="preview"
                        class="tab-trigger flex items-center justify-center gap-1"
                    >
                        <Eye class="h-4 w-4" />
                        <span class="hidden sm:inline">Preview</span>
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="markdown"
                        class="tab-trigger flex items-center justify-center gap-1"
                    >
                        <Code class="h-4 w-4" />
                        <span class="hidden sm:inline">Markdown</span>
                    </Tabs.Trigger>
                </Tabs.List>
            </Tabs.Root>
        </div>
    </div>

    <div class="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-200px)]">
        <!-- Tab Content based on viewMode -->
        <div class="w-full tab-content-container">
            {#if $chroniclesStore.viewMode === "edit"}
                <div in:fade={{ duration: 300 }}>
                    <ChronicleJournalFlow />
                </div>
            {:else if $chroniclesStore.viewMode === "preview" && $chroniclesStore.currentEntry}
                <div in:fade={{ duration: 300 }}>
                    <div
                        class="bg-card/90 backdrop-blur-sm shadow-lg rounded-lg border border-border relative z-10 p-4"
                    >
                        <ChroniclePreview
                            entry={$chroniclesStore.currentEntry}
                        />
                    </div>
                </div>
            {:else if $chroniclesStore.viewMode === "markdown" && $chroniclesStore.currentEntry}
                <div in:fade={{ duration: 300 }}>
                    <Card
                        class="p-4 sm:p-6 h-full markdown-card bg-card/95 backdrop-blur-sm relative z-10"
                    >
                        <div class="prose dark:prose-invert max-w-none h-full">
                            <pre
                                class="markdown-preview rounded-md border bg-muted/80 p-4 font-mono">
                                <code
                                    >{$chroniclesStore.currentEntry
                                        .content}</code
                                >
                            </pre>
                        </div>
                    </Card>
                </div>
            {:else}
                <div in:fade={{ duration: 300 }}>
                    <Card
                        class="p-6 text-center bg-card/90 backdrop-blur-sm relative z-10"
                    >
                        <div class="text-muted-foreground">
                            No journal entry available for this date.
                        </div>
                    </Card>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    /* Page container positioning */
    .chronicles-page-container {
        position: relative;
        overflow: hidden;
        min-height: 100vh;
        margin-top: 4rem; /* Add margin to account for header */
    }

    /* ChronicleBackground container positioning */
    .chronicles-background-container {
        position: fixed;
        top: 4rem; /* Match the margin-top of the container */
        left: 0;
        right: 0;
        height: calc(
            100vh - 4rem
        ); /* Subtract header height from viewport height */
        z-index: 0; /* Put background at base layer */
        pointer-events: none;
    }

    /* Title area styling */
    .chronicles-title-area {
        position: relative;
        z-index: 10;
    }

    .chronicles-title-area h2,
    .chronicles-title-area p {
        position: relative;
        z-index: 10;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    :global(.carta-editor) {
        height: 100% !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow-y: auto !important;
        font-family: inherit;
        padding: 1rem !important;
        overflow-x: hidden;
    }

    :global(.carta-editor:focus) {
        outline: none;
    }

    :global(.carta-font-code) {
        font-family: "Menlo", "Monaco", "Courier New", monospace;
        font-size: 1.1rem;
    }

    :global(.carta-editor-custom) {
        border-radius: 0.5rem;
        height: 100% !important;
    }

    :global(.prose) {
        max-width: none;
        height: 100%;
    }

    /* Tab styling improvements */
    .tab-container {
        border-radius: 0.5rem;
        overflow: hidden;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .tab-list {
        background-color: var(--muted);
        padding: 0.25rem;
        border-radius: 0.5rem;
    }

    .tab-trigger {
        transition: all 0.3s ease;
        border-radius: 0.4rem;
        font-weight: 500;
        height: 2.5rem;
    }

    .tab-trigger[data-state="active"] {
        background-color: var(--background);
        color: var(--primary);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    /* Tab content container */
    .tab-content-container {
        position: relative;
        z-index: 10;
        min-height: 400px;
        transition: all 0.3s ease;
    }

    .markdown-card {
        border: 1px solid rgba(var(--primary-rgb), 0.2);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .markdown-preview {
        max-height: 80vh;
        overflow-y: auto;
        white-space: pre-wrap;
        line-height: 1.6;
        color: var(--foreground);
        font-size: 0.9rem;
    }

    .markdown-preview code {
        display: block;
        font-family: "Menlo", "Monaco", "Courier New", monospace;
    }

    /* Mobile improvements */
    @media (max-width: 640px) {
        .tab-trigger {
            padding: 0.5rem;
            height: 2.25rem;
        }

        .markdown-preview {
            font-size: 0.8rem;
            padding: 0.75rem !important;
        }
    }

    /* Ensure cards and content stay above background */
    :global(.bg-card) {
        position: relative;
        z-index: 10;
    }

    /* Weather top right positioning */
    .weather-top-right {
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 20;
        width: 350px;
        max-width: 95%;
    }

    @media (max-width: 768px) {
        .weather-top-right {
            position: relative;
            top: 0;
            right: 0;
            width: 100%;
            margin-bottom: 1rem;
        }
    }
</style>

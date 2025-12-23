<script lang="ts">
    import { onMount } from "svelte";
    import { Card } from "$lib/components/ui/card";
    import * as Tabs from "$lib/components/ui/tabs";
    import { Sparkles, BookOpen } from "lucide-svelte";
    import { chroniclesStore, weatherStore } from "../stores";
    import { ChroniclesService } from "../services";
    import { withErrorHandling } from "$lib/utils/error-handler.util";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import { CUSTOM_EVENTS } from "../constants";
    import ChronicleJournalFlow from "./ChronicleJournalFlow.svelte";
    import ChroniclePreview from "./ChroniclePreview.svelte";
    import WeatherDisplay from "./WeatherDisplay.svelte";
    import { ensureWeatherData } from "../utils/weather.utils";

    let date = new Date();

    let formattedDate = $derived(
        date.toISOString().split("T")[0].replace(/-/g, ""),
    );
    let displayDate = $derived(
        new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        }).format(date),
    );

    // Load journal entry for selected date
    async function loadJournalEntry(selectedDate: Date) {
        chroniclesStore.setLoading(true);

        await withErrorHandling(
            async () => {
                const entry =
                    await ChroniclesService.getEntryByDate(selectedDate);

                const today = new Date().toISOString().split("T")[0];
                const isToday =
                    selectedDate.toISOString().split("T")[0] === today;

                chroniclesStore.setCurrentEntry(entry);
                chroniclesStore.setHasEntryForToday(isToday && entry !== null);

                // If no entry exists for today and we're looking at today, set to edit mode
                if (!entry && isToday) {
                    chroniclesStore.setViewMode("edit");
                } else if (entry) {
                    chroniclesStore.setViewMode("preview");
                }
            },
            {
                errorMessage: "Failed to load journal entry",
                onSuccess: () => {
                    chroniclesStore.setLoading(false);
                },
                onError: () => {
                    chroniclesStore.setLoading(false);
                },
            },
        );
    }

    // Handler for view mode change
    function handleViewModeChange(val: string | undefined) {
        if (val === "edit" || val === "preview" || val === "markdown") {
            chroniclesStore.setViewMode(val);
        }
    }

    onMount(async () => {
        // Initialize weather data
        ensureWeatherData();

        // Load journal entry for today
        await loadJournalEntry(date);

        // If there's no entry for today, initialize the flow
        if (!chroniclesStore.hasEntryForToday) {
            const emptyEntry = ChroniclesService.createEmptyEntry(date);
            chroniclesStore.setCurrentEntry(emptyEntry);
        }

    });
</script>

<div class="mx-auto p-2 sm:p-4 chronicles-page-container">
    <!-- Weather component at top right -->
    <div class="weather-top-right">
        <WeatherDisplay showForecast={false} compact={true} />
    </div>

    <!-- Page Header with Date -->
    <div
        class="mb-4 sm:mb-6 justify-center text-center chronicles-title-area"
    >
        <div class="mb-2 date-title mx-8">
            <h2
                class="text-xl font-semibold flex items-center justify-center gap-2"
            >
                <Sparkles class="h-5 w-5 text-primary" />
                <span>{displayDate}</span>
            </h2>
            <p class="text-sm text-muted-foreground">Entry #{formattedDate}</p>
        </div>

        <!-- View Mode Selector -->
        <div class="w-full max-w-md mx-auto mt-4 mb-6">
            <Tabs.Root
                value={chroniclesStore.viewMode}
                onValueChange={handleViewModeChange}
                class="tab-container"
            >
                <Tabs.List class="grid grid-cols-3 tab-list">
                    <Tabs.Trigger
                        value="edit"
                        class="tab-trigger flex items-center justify-center gap-1"
                    >
                        <span>Edit</span>
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="preview"
                        class="tab-trigger flex items-center justify-center gap-1"
                    >
                        <span>Preview</span>
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="markdown"
                        class="tab-trigger flex items-center justify-center gap-1"
                    >
                        <span>Markdown</span>
                    </Tabs.Trigger>
                </Tabs.List>
            </Tabs.Root>
        </div>
    </div>

    <div class="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-200px)]">
        <!-- Tab Content based on viewMode -->
        <div class="w-full tab-content-container">
            {#if chroniclesStore.isLoading}
                <LoadingSpinner
                    centered
                    size="lg"
                    label="Loading journal entry..."
                />
            {:else if chroniclesStore.viewMode === "edit"}
                <ChronicleJournalFlow />
            {:else if chroniclesStore.viewMode === "preview" && chroniclesStore.currentEntry}
                <div
                    class="bg-card/90 backdrop-blur-sm shadow-lg rounded-lg border border-border relative z-10 p-4"
                >
                    <ChroniclePreview entry={chroniclesStore.currentEntry} />
                </div>
            {:else if chroniclesStore.viewMode === "markdown" && chroniclesStore.currentEntry}
                <Card
                    class="p-4 sm:p-6 h-full markdown-card bg-card/95 backdrop-blur-sm relative z-10"
                >
                    <div class="prose dark:prose-invert max-w-none h-full">
                        <pre
                            class="markdown-preview rounded-md border bg-muted/80 p-4 font-mono">
                            <code>{chroniclesStore.currentEntry.content}</code>
                        </pre>
                    </div>
                </Card>
            {:else}
                <EmptyState
                    icon={BookOpen}
                    title="No journal entry"
                    description="Start journaling by clicking the edit tab"
                    actionLabel="Start Writing"
                    onaction={() => chroniclesStore.setViewMode("edit")}
                />
            {/if}
        </div>
    </div>
</div>

<style>
    .chronicles-page-container {
        position: relative;
        min-height: 100vh;
    }

    .chronicles-title-area {
        position: relative;
    }

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

    .tab-content-container {
        position: relative;
        z-index: 10;
        min-height: 400px;
        transition: all 0.3s ease;
    }

    .markdown-card {
        border: 1px solid var(--border);
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

        .tab-trigger {
            padding: 0.5rem;
            height: 2.25rem;
        }

        .markdown-preview {
            font-size: 0.8rem;
            padding: 0.75rem !important;
        }
    }
</style>

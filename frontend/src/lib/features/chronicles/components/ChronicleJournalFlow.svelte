<script lang="ts">
    import { Card } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Slider } from "$lib/components/ui/slider";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { fade } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { crossfade } from "svelte/transition";
    import {
        CheckCircle2,
        Calendar,
        ChevronLeft,
        ChevronRight,
        PlusCircle,
        Heart,
        Award,
        PenLine,
        Lightbulb,
        Smile,
        Meh,
        Frown,
    } from "lucide-svelte";
    import { chroniclesStore, weatherStore } from "../stores";
    import { ChroniclesService } from "../services";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { calendarStore } from "$lib/features/calendar/stores/calendar.store.svelte";
    import { isToday } from "$lib/features/calendar/utils/date";
    import type { CalendarEvent } from "$lib/features/calendar/types";
    import SimpleEventCard from "$lib/features/calendar/components/SimpleEventCard.svelte";
    import {
        getEventTimeColor,
        getEventTextColor,
    } from "$lib/features/calendar/utils/color";
    import { ensureWeatherData } from "../utils/weather.utils";
    import { withErrorHandling } from "$lib/utils/error-handler.util";
    import { getWeatherType } from "../utils/weather-mapping.util";
    import {
        CHRONICLE_STEPS,
        MOOD_OPTIONS,
        ENERGY_CONFIG,
        CUSTOM_EVENTS,
    } from "../constants";

    let { weather = $bindable("sunny") } = $props<{ weather?: string }>();

    let showJsonData = false;
    let enableAnimations = true;
    let reduceMotion = false;

    function updateWeather(newWeather: string) {
        weather = newWeather;
    }

    // Use Lucide icons for moods (no emojis)
    const MOOD_ICONS: Record<string, any> = {
        happy: Smile,
        excited: Smile,
        peaceful: Smile,
        neutral: Meh,
        anxious: Frown,
        sad: Frown,
    };

    let todayEvents: CalendarEvent[] = [];

    function getTodayEvents(events: CalendarEvent[]): CalendarEvent[] {
        return events.filter((event) => {
            if (!event || !event.start) return false;
            const eventDate = new Date(event.start);
            return isToday(eventDate);
        });
    }

    function getTomorrowEvents(events: CalendarEvent[]): CalendarEvent[] {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        return events.filter((event) => {
            if (!event || !event.start) return false;
            const eventDate = new Date(event.start);
            return eventDate >= tomorrow && eventDate < dayAfterTomorrow;
        });
    }

    function formatEventTime(event: CalendarEvent): string {
        if (event.is_day_event || event.is_all_day) return "All day";

        const startDate = new Date(event.start);
        return startDate.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    }

    function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
        return [...events].sort(
            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
        );
    }

    let newEvent = "";
    let addedCalendarEventIds: string[] = [];
    let newWin = "";

    onMount(() => {
        const handleDebugSettingsChange = (event: CustomEvent) => {
            const settings = event.detail;
            if (settings.weatherType) {
                updateWeather(settings.weatherType);
            }
            if (settings.enableAnimations !== undefined) {
                enableAnimations = settings.enableAnimations;
            }
            if (settings.reduceMotion !== undefined) {
                reduceMotion = settings.reduceMotion;
            }
            if (settings.showJsonData !== undefined) {
                showJsonData = settings.showJsonData;
            }
        };

        if (browser) {
            try {
                const storedSettings = localStorage.getItem(
                    "chroniclesDebugSettings",
                );
                if (storedSettings) {
                    const settings = JSON.parse(storedSettings);
                    if (settings.weatherType) {
                        updateWeather(settings.weatherType);
                    }
                    if (settings.enableAnimations !== undefined) {
                        enableAnimations = settings.enableAnimations;
                    }
                    if (settings.reduceMotion !== undefined) {
                        reduceMotion = settings.reduceMotion;
                    }
                    if (settings.showJsonData !== undefined) {
                        showJsonData = settings.showJsonData;
                    }
                }
            } catch (error) {
                // Silently fail - invalid debug settings will be ignored
            }

            document.addEventListener(
                CUSTOM_EVENTS.DEBUG_SETTINGS_CHANGED,
                handleDebugSettingsChange as EventListener,
            );
        }

        ensureWeatherData();

        // Update weather from store
        $effect(() => {
            if (weatherStore.currentWeather) {
                const weatherType = getWeatherType(
                    weatherStore.currentWeather.weather.condition,
                    weatherStore.currentWeather.details.clouds,
                    new Date(weatherStore.currentWeather.date).getHours(),
                );
                updateWeather(weatherType);
            }
        });

        return () => {
            if (browser) {
                document.removeEventListener(
                    CUSTOM_EVENTS.DEBUG_SETTINGS_CHANGED,
                    handleDebugSettingsChange as EventListener,
                );
            }
        };
    });

    function nextStep() {
        if (chroniclesStore.currentStep < chroniclesStore.isLastStep) {
            chroniclesStore.nextStep();
        } else {
            finishJournal();
        }
    }

    function prevStep() {
        chroniclesStore.prevStep();
    }

    async function finishJournal() {
        if (!chroniclesStore.currentEntry) return;

        const entry = chroniclesStore.currentEntry;

        // Generate markdown content
        const markdown = ChroniclesService.generateMarkdownFromEntry(entry);

        // Update content field
        chroniclesStore.updateField("content", markdown);

        // Save entry
        await withErrorHandling(
            () =>
                ChroniclesService.saveJournalEntry({
                    ...entry,
                    content: markdown,
                }),
            {
                successMessage: entry.id
                    ? "Updated successfully"
                    : "Saved successfully",
                errorMessage: "Failed to save",
                onSuccess: (savedEntry) => {
                    chroniclesStore.setCurrentEntry(savedEntry);
                    chroniclesStore.setHasEntryForToday(true);
                    chroniclesStore.setViewMode("preview");
                    chroniclesStore.clearLocalStorage();
                },
            },
        );
    }

    function addMemorableEvent() {
        if (newEvent.trim() && chroniclesStore.currentEntry) {
            const events = chroniclesStore.currentEntry.memorable_events || [];
            chroniclesStore.updateField("memorable_events", [
                ...events,
                newEvent.trim(),
            ]);
            newEvent = "";
        }
    }

    function addWin() {
        if (newWin.trim() && chroniclesStore.currentEntry) {
            const wins = chroniclesStore.currentEntry.wins || [];
            chroniclesStore.updateField("wins", [...wins, newWin.trim()]);
            newWin = "";
        }
    }

    function removeEvent(index: number) {
        if (
            chroniclesStore.currentEntry &&
            chroniclesStore.currentEntry.memorable_events
        ) {
            const events = [...chroniclesStore.currentEntry.memorable_events];
            const removedEvent = events[index];
            events.splice(index, 1);
            chroniclesStore.updateField("memorable_events", events);

            // Try to restore calendar event to available list
            if (removedEvent && removedEvent.includes(":")) {
                const eventSummary = removedEvent
                    .split(":")
                    .slice(1)
                    .join(":")
                    .trim();

                const eventToRestore = calendarStore.events.find(
                    (event) =>
                        event.summary === eventSummary ||
                        (event.summary &&
                            eventSummary &&
                            event.summary.includes(eventSummary)),
                );

                if (eventToRestore && eventToRestore.id) {
                    addedCalendarEventIds = addedCalendarEventIds.filter(
                        (id) => id !== eventToRestore.id,
                    );
                }
            }
        }
    }

    function removeWin(index: number) {
        if (chroniclesStore.currentEntry && chroniclesStore.currentEntry.wins) {
            const wins = [...chroniclesStore.currentEntry.wins];
            wins.splice(index, 1);
            chroniclesStore.updateField("wins", wins);
        }
    }

    function addCalendarEventAsMemory(event: CalendarEvent) {
        if (chroniclesStore.currentEntry) {
            const events = chroniclesStore.currentEntry.memorable_events || [];
            const eventTime = formatEventTime(event);
            chroniclesStore.updateField("memorable_events", [
                ...events,
                `${eventTime}: ${event.summary}`,
            ]);

            if (event.id) {
                addedCalendarEventIds = [...addedCalendarEventIds, event.id];
            }
        }
    }

    const [send, receive] = crossfade({
        duration: 400,
        fallback(node) {
            const style = getComputedStyle(node);
            const transform = style.transform === "none" ? "" : style.transform;

            return {
                duration: 400,
                easing: cubicOut,
                css: (t) => `
                    transform: ${transform} scale(${t * 0.05 + 0.95});
                    opacity: ${t};
                `,
            };
        },
    });

    let filteredTodayEvents = $derived(
        sortEventsByTime(
            getTodayEvents(calendarStore.events).filter(
                (event) =>
                    !event.id || !addedCalendarEventIds.includes(event.id),
            ),
        ),
    );
</script>

<div class="chronicles-container w-full relative">
    <div class="chronicles-background absolute inset-0 z-0"></div>

    <div class="w-full relative z-10 pt-4">
        <div class="flex justify-between items-center mb-6">
            <div class="steps-navigation flex items-center space-x-2">
                {#each CHRONICLE_STEPS as step, i}
                    <button
                        class="step-icon w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out relative
                           {chroniclesStore.currentStep === i + 1
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
                        on:click={() => chroniclesStore.setStep(i + 1)}
                        aria-label={step.title}
                    >
                        {#if i === 0}
                            <Heart class="h-4 w-4" />
                        {:else if i === 1}
                            <Calendar class="h-4 w-4" />
                        {:else if i === 2}
                            <Award class="h-4 w-4" />
                        {:else if i === 3}
                            <PenLine class="h-4 w-4" />
                        {:else if i === 4}
                            <Lightbulb class="h-4 w-4" />
                        {/if}
                        <div class="step-tooltip">
                            {step.title}
                        </div>
                    </button>
                {/each}
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="min-h-[400px]">
                <div
                    class="journal-panel-container"
                    transition:fade={{ duration: 200 }}
                >
                    <Card
                        class="journal-card p-6 h-full relative overflow-hidden"
                    >
                        {#key chroniclesStore.currentStep}
                            <div
                                class="journal-step-content absolute inset-0 p-6"
                                in:receive={{
                                    key: chroniclesStore.currentStep,
                                }}
                                out:send={{ key: chroniclesStore.currentStep }}
                            >
                                {#if chroniclesStore.currentStep === 1}
                                    <!-- Step 1: Day Overview & Mood Check-in -->
                                    <h3
                                        class="text-2xl font-semibold mb-6 text-primary"
                                    >
                                        How was your {new Date().toLocaleDateString(
                                            "en-US",
                                            {
                                                weekday: "long",
                                            },
                                        )}?
                                    </h3>

                                    <!-- Mood Selection -->
                                    <div class="mb-8">
                                        <label
                                            class="block text-sm font-medium mb-3"
                                            >How are you feeling today?</label
                                        >
                                        <div
                                            class="grid grid-cols-3 md:grid-cols-6 gap-3"
                                        >
                                            {#each MOOD_OPTIONS as mood}
                                                <button
                                                    class="mood-button flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200 hover:scale-105 hover:shadow-md {chroniclesStore
                                                        .currentEntry?.mood ===
                                                    mood.value
                                                        ? 'border-primary bg-primary/10'
                                                        : 'border-border'}"
                                                    on:click={() =>
                                                        chroniclesStore.updateField(
                                                            "mood",
                                                            mood.value,
                                                        )}
                                                >
                                                    <svelte:component
                                                        this={MOOD_ICONS[
                                                            mood.value
                                                        ]}
                                                        class="h-6 w-6 mb-1"
                                                    />
                                                    <span class="text-xs"
                                                        >{mood.label}</span
                                                    >
                                                </button>
                                            {/each}
                                        </div>
                                    </div>

                                    <!-- Energy Level -->
                                    <div class="mb-8">
                                        <label
                                            class="block text-sm font-medium mb-3"
                                            >Energy level</label
                                        >
                                        <div class="px-1">
                                            <Slider
                                                value={[
                                                    chroniclesStore.currentEntry
                                                        ?.energy ||
                                                        ENERGY_CONFIG.DEFAULT,
                                                ]}
                                                min={ENERGY_CONFIG.MIN}
                                                max={ENERGY_CONFIG.MAX}
                                                step={ENERGY_CONFIG.STEP}
                                                onValueChange={([val]) =>
                                                    chroniclesStore.updateField(
                                                        "energy",
                                                        val,
                                                    )}
                                                class="energy-slider"
                                            />
                                            <div
                                                class="flex justify-between mt-1"
                                            >
                                                <span
                                                    class="text-xs text-muted-foreground"
                                                    >Low</span
                                                >
                                                <span
                                                    class="text-sm font-medium text-primary"
                                                    >{chroniclesStore
                                                        .currentEntry?.energy ||
                                                        ENERGY_CONFIG.DEFAULT}/{ENERGY_CONFIG.MAX}</span
                                                >
                                                <span
                                                    class="text-xs text-muted-foreground"
                                                    >High</span
                                                >
                                            </div>
                                        </div>
                                    </div>
                                {:else if chroniclesStore.currentStep === 2}
                                    <!-- Step 2: Quick Reflection on Main Events -->
                                    <h3
                                        class="text-2xl font-semibold mb-6 text-primary"
                                    >
                                        What was most memorable today?
                                    </h3>

                                    <!-- Events List -->
                                    <div class="mb-6">
                                        {#if chroniclesStore.currentEntry?.memorable_events && chroniclesStore.currentEntry.memorable_events.length > 0}
                                            <div class="mb-4 space-y-2">
                                                {#each chroniclesStore.currentEntry.memorable_events as event, i}
                                                    <div
                                                        class="event-item flex items-center p-2 rounded bg-muted/50 group"
                                                    >
                                                        <span class="flex-1"
                                                            >{event}</span
                                                        >
                                                        <button
                                                            class="delete-btn opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                                            on:click={() =>
                                                                removeEvent(i)}
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                {/each}
                                            </div>
                                        {/if}

                                        <!-- Add Event Form -->
                                        <div class="flex gap-2 mb-6">
                                            <Input
                                                placeholder="Add a memorable event..."
                                                bind:value={newEvent}
                                                on:keydown={(e) =>
                                                    e.key === "Enter" &&
                                                    addMemorableEvent()}
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                on:click={addMemorableEvent}
                                            >
                                                <PlusCircle class="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <!-- Calendar Event Suggestions -->
                                    <div>
                                        <h4 class="text-sm font-medium mb-2">
                                            Today's calendar events:
                                        </h4>
                                        <div class="space-y-2">
                                            {#if filteredTodayEvents.length > 0}
                                                {#each filteredTodayEvents as event}
                                                    <div class="mb-2">
                                                        <div
                                                            class="flex w-full items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                                            on:click={() =>
                                                                addCalendarEventAsMemory(
                                                                    event,
                                                                )}
                                                        >
                                                            <div
                                                                class="flex-1 w-full"
                                                            >
                                                                <SimpleEventCard
                                                                    {event}
                                                                    compact={true}
                                                                />
                                                            </div>
                                                            <button
                                                                class="p-1 rounded-full hover:bg-primary/20 transition-colors"
                                                                on:click|stopPropagation={() =>
                                                                    addCalendarEventAsMemory(
                                                                        event,
                                                                    )}
                                                            >
                                                                <PlusCircle
                                                                    class="h-5 w-5 text-primary"
                                                                />
                                                            </button>
                                                        </div>
                                                    </div>
                                                {/each}
                                            {:else}
                                                <div
                                                    class="text-sm text-muted-foreground italic p-2"
                                                >
                                                    No events scheduled for
                                                    today
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                {:else if chroniclesStore.currentStep === 3}
                                    <!-- Step 3: Gratitude & Wins -->
                                    <h3
                                        class="text-2xl font-semibold mb-6 text-primary"
                                    >
                                        What went well today?
                                    </h3>

                                    <!-- Wins List -->
                                    <div class="mb-6">
                                        {#if chroniclesStore.currentEntry?.wins && chroniclesStore.currentEntry.wins.length > 0}
                                            <div class="mb-4 space-y-2">
                                                {#each chroniclesStore.currentEntry.wins as win, i}
                                                    <div
                                                        class="win-item flex items-center p-2 rounded bg-muted/50 group"
                                                    >
                                                        <span class="flex-1"
                                                            >{win}</span
                                                        >
                                                        <button
                                                            class="delete-btn opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                                            on:click={() =>
                                                                removeWin(i)}
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                {/each}
                                            </div>
                                        {/if}

                                        <!-- Add Win Form -->
                                        <div class="flex gap-2 mb-6">
                                            <Input
                                                placeholder="Add something that went well..."
                                                bind:value={newWin}
                                                on:keydown={(e) =>
                                                    e.key === "Enter" &&
                                                    addWin()}
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                on:click={addWin}
                                            >
                                                <PlusCircle class="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <!-- Habits Completed -->
                                    <div
                                        class="flex items-center space-x-2 mt-8"
                                    >
                                        <Checkbox
                                            id="habits"
                                            checked={chroniclesStore
                                                .currentEntry
                                                ?.habits_completed || false}
                                            onCheckedChange={(checked) =>
                                                chroniclesStore.updateField(
                                                    "habits_completed",
                                                    !!checked,
                                                )}
                                        />
                                        <label
                                            for="habits"
                                            class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            Did you complete your habits today?
                                        </label>
                                    </div>
                                {:else if chroniclesStore.currentStep === 4}
                                    <!-- Step 4: Challenges & Growth -->
                                    <h3
                                        class="text-2xl font-semibold mb-6 text-primary"
                                    >
                                        Any challenges today?
                                    </h3>

                                    <!-- Challenges -->
                                    <div class="mb-6">
                                        <Textarea
                                            placeholder="What challenges did you face today?"
                                            class="min-h-[100px]"
                                            value={chroniclesStore.currentEntry
                                                ?.challenges || ""}
                                            on:input={(e) =>
                                                chroniclesStore.updateField(
                                                    "challenges",
                                                    e.currentTarget.value,
                                                )}
                                        />
                                    </div>

                                    <!-- Lessons Learned (only if challenge entered) -->
                                    {#if chroniclesStore.currentEntry?.challenges && chroniclesStore.currentEntry.challenges.trim().length > 0}
                                        <div class="mt-6">
                                            <h4
                                                class="text-sm font-medium mb-2"
                                            >
                                                What did you learn from this
                                                challenge?
                                            </h4>
                                            <Textarea
                                                placeholder="What did you learn from this challenge?"
                                                class="min-h-[100px]"
                                                value={chroniclesStore
                                                    .currentEntry
                                                    ?.lessons_learned || ""}
                                                on:input={(e) =>
                                                    chroniclesStore.updateField(
                                                        "lessons_learned",
                                                        e.currentTarget.value,
                                                    )}
                                            />
                                        </div>
                                    {/if}
                                {:else if chroniclesStore.currentStep === 5}
                                    <!-- Step 5: Tomorrow's Intention -->
                                    <h3
                                        class="text-2xl font-semibold mb-6 text-primary"
                                    >
                                        One thing to focus on tomorrow:
                                    </h3>

                                    <!-- Tomorrow's Focus -->
                                    <div class="mb-6">
                                        <Textarea
                                            placeholder="What's your main focus for tomorrow?"
                                            class="min-h-[100px]"
                                            value={chroniclesStore.currentEntry
                                                ?.tomorrow_focus || ""}
                                            on:input={(e) =>
                                                chroniclesStore.updateField(
                                                    "tomorrow_focus",
                                                    e.currentTarget.value,
                                                )}
                                        />
                                    </div>

                                    <!-- Potential Obstacles -->
                                    <div class="mt-6">
                                        <h4 class="text-sm font-medium mb-2">
                                            What might get in the way?
                                        </h4>
                                        <Textarea
                                            placeholder="Any potential obstacles?"
                                            class="min-h-[80px]"
                                            value={chroniclesStore.currentEntry
                                                ?.potential_obstacles || ""}
                                            on:input={(e) =>
                                                chroniclesStore.updateField(
                                                    "potential_obstacles",
                                                    e.currentTarget.value,
                                                )}
                                        />
                                    </div>
                                {/if}
                            </div>
                        {/key}
                    </Card>
                </div>
            </div>

            <!-- Right Panel - Context Panel -->
            <div>
                <div transition:fade={{ duration: 200 }}>
                    <Card class="p-6 h-full relative min-h-[400px]">
                        {#key chroniclesStore.currentStep}
                            <div
                                class="context-panel-content absolute inset-0 p-6"
                                in:receive={{
                                    key: `context-${chroniclesStore.currentStep}`,
                                }}
                                out:send={{
                                    key: `context-${chroniclesStore.currentStep}`,
                                }}
                            >
                                {#if chroniclesStore.currentStep === 1}
                                    <!-- Step 1: Context panel - Calendar & Weather -->
                                    <h3 class="text-lg font-medium mb-4">
                                        Today's Overview
                                    </h3>

                                    <!-- Calendar Overview -->
                                    <div class="mt-6">
                                        <h4
                                            class="text-sm font-medium mb-2 flex items-center"
                                        >
                                            <Calendar class="h-4 w-4 mr-2" />
                                            <span>Today's Calendar</span>
                                        </h4>
                                        <div class="space-y-2">
                                            {#each filteredTodayEvents as event}
                                                <div
                                                    class="p-2 rounded {getEventTimeColor(
                                                        event,
                                                    )} {getEventTextColor(
                                                        event,
                                                    )}"
                                                >
                                                    <div
                                                        class="text-sm font-medium"
                                                    >
                                                        {event.summary}
                                                    </div>
                                                    <div
                                                        class="text-xs opacity-90"
                                                    >
                                                        {formatEventTime(event)}
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    </div>

                                    <!-- Step Indicator -->
                                    <div class="mt-8 text-center">
                                        <div
                                            class="text-sm text-muted-foreground"
                                        >
                                            Step 1 of 5
                                        </div>
                                    </div>
                                {:else if chroniclesStore.currentStep === 2}
                                    <!-- Step 2: Context panel -->
                                    <h3 class="text-lg font-medium mb-4">
                                        Today's Schedule
                                    </h3>
                                    <div class="mt-8 text-center">
                                        <div
                                            class="text-sm text-muted-foreground"
                                        >
                                            Step 2 of 5
                                        </div>
                                    </div>
                                {:else if chroniclesStore.currentStep === 3}
                                    <!-- Step 3: Context panel -->
                                    <h3 class="text-lg font-medium mb-4">
                                        Your Habits Today
                                    </h3>
                                    <div class="mt-8 text-center">
                                        <div
                                            class="text-sm text-muted-foreground"
                                        >
                                            Step 3 of 5
                                        </div>
                                    </div>
                                {:else if chroniclesStore.currentStep === 4}
                                    <!-- Step 4: Context panel -->
                                    <h3 class="text-lg font-medium mb-4">
                                        Recent Challenges
                                    </h3>
                                    <div class="mt-8 text-center">
                                        <div
                                            class="text-sm text-muted-foreground"
                                        >
                                            Step 4 of 5
                                        </div>
                                    </div>
                                {:else if chroniclesStore.currentStep === 5}
                                    <!-- Step 5: Context panel -->
                                    <h3 class="text-lg font-medium mb-4">
                                        Tomorrow's Schedule
                                    </h3>

                                    <div class="mt-4">
                                        <h4
                                            class="text-sm font-medium mb-2 flex items-center"
                                        >
                                            <Calendar class="h-4 w-4 mr-2" />
                                            <span>Tomorrow's Calendar</span>
                                        </h4>
                                        <div class="space-y-2">
                                            {#each sortEventsByTime(getTomorrowEvents(calendarStore.events)) as event}
                                                <div
                                                    class="p-2 rounded {getEventTimeColor(
                                                        event,
                                                    )} {getEventTextColor(
                                                        event,
                                                    )}"
                                                >
                                                    <div
                                                        class="text-sm font-medium"
                                                    >
                                                        {event.summary}
                                                    </div>
                                                    <div
                                                        class="text-xs text-muted-foreground"
                                                    >
                                                        {formatEventTime(event)}
                                                    </div>
                                                </div>
                                            {:else}
                                                <div
                                                    class="text-sm text-muted-foreground italic p-2"
                                                >
                                                    No events scheduled for
                                                    tomorrow
                                                </div>
                                            {/each}
                                        </div>
                                    </div>

                                    <div class="mt-8 text-center">
                                        <div
                                            class="text-sm text-muted-foreground"
                                        >
                                            Step 5 of 5
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/key}
                    </Card>
                </div>
            </div>
        </div>
    </div>

    <!-- Fixed navigation buttons -->
    <div class="fixed-nav-buttons">
        <div class="container mx-auto px-4">
            <div class="flex justify-start items-center space-x-2">
                <Button
                    variant="outline"
                    on:click={prevStep}
                    disabled={!chroniclesStore.canGoBack}
                    class="gap-1"
                >
                    <ChevronLeft class="h-4 w-4" />
                    Previous
                </Button>
                <Button
                    variant="default"
                    on:click={nextStep}
                    class="gap-1 next-button"
                >
                    {chroniclesStore.isLastStep ? "Finish Journal" : "Next"}
                    {#if !chroniclesStore.isLastStep}
                        <ChevronRight class="h-4 w-4" />
                    {/if}
                </Button>
            </div>
        </div>
    </div>
</div>

<style>
    .fixed-nav-buttons {
        position: absolute;
        right: 0;
        background-color: var(--background);
        border-top: 1px solid var(--border);
        padding: 1rem 0;
        z-index: 10;
    }

    .chronicles-container {
        padding-bottom: 5rem;
        position: relative;
        min-height: calc(100vh - 4rem);
        overflow: hidden;
        border-radius: 0.5rem;
    }

    .chronicles-background {
        position: absolute;
        inset: 0;
        z-index: 0;
        opacity: 0.7;
        border-radius: 0.5rem;
        pointer-events: none;
        transition: background 1s ease;
    }

    button:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.7;
        }
    }

    .border-primary {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .journal-panel-container,
    .context-panel-content {
        height: 100%;
        min-height: 400px;
    }

    .journal-card {
        transition: all 0.3s ease;
        border: 1px solid var(--border);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        position: relative;
    }

    .journal-step-content,
    .context-panel-content {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
    }

    .steps-navigation {
        padding: 0.5rem;
        border-radius: 0.5rem;
        background-color: var(--background);
    }

    .step-icon {
        position: relative;
        cursor: pointer;
        z-index: 10;
        transition: all 0.2s ease;
    }

    .step-icon:hover {
        transform: translateY(-2px);
    }

    .step-tooltip {
        position: absolute;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        background-color: var(--background);
        color: var(--foreground);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
        border: 1px solid var(--border);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        z-index: 20;
    }

    .step-icon:hover .step-tooltip {
        opacity: 1;
    }

    .mood-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .event-item,
    .win-item {
        transition: all 0.2s ease;
        border-left: 3px solid var(--primary);
    }

    .delete-btn {
        font-size: 1.2rem;
        line-height: 1;
    }

    .energy-slider {
        --slider-thumb-size: 22px;
    }

    @media (max-width: 640px) {
        .journal-panel-container {
            min-height: 350px;
        }

        .mood-button {
            padding: 0.5rem;
        }

        h3 {
            font-size: 1.5rem;
        }

        .grid-cols-3 {
            gap: 0.5rem;
        }
    }
</style>

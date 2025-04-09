<script lang="ts">
    import { Card } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Slider } from "$lib/components/ui/slider";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { fade, fly, scale } from "svelte/transition";
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
        FileCode,
    } from "lucide-svelte";
    import { chroniclesStore, weatherStore } from "../stores";
    import { onMount, afterUpdate } from "svelte";
    import { browser } from "$app/environment";
    import { calendarStore } from "$lib/features/calendar/stores/calendar.store";
    import { isToday } from "$lib/features/calendar/utils/date";
    import type { CalendarEvent } from "$lib/features/calendar/types";
    import SimpleEventCard from "$lib/features/calendar/components/SimpleEventCard.svelte";
    import {
        getEventTimeColor,
        getEventTextColor,
    } from "$lib/features/calendar/utils/color";
    import { ensureWeatherData } from "../utils/weather.utils";

    export let weather: string = "sunny";

    let showJsonData = false;
    let enableAnimations = true;
    let reduceMotion = false;

    const weatherBackgrounds: Record<string, string> = {
        sunny: "linear-gradient(to bottom, #87CEEB, #FFFFE0)",
        cloudy: "linear-gradient(to bottom, #D3D3D3, #B0E0E6)",
        rainy: "linear-gradient(to bottom, #708090, #4682B4)",
        stormy: "linear-gradient(to bottom, #4B5563, #1E40AF)",
    };

    function updateWeather(newWeather: string) {
        console.log("Weather updated to:", newWeather);
        weather = newWeather;
    }

    const STEPS = [
        {
            id: "mood",
            title: "Day Overview & Mood",
            subtitle: "How was your day?",
        },
        {
            id: "events",
            title: "Main Events",
            subtitle: "What was memorable today?",
        },
        {
            id: "wins",
            title: "Gratitude & Wins",
            subtitle: "What went well today?",
        },
        {
            id: "challenges",
            title: "Challenges & Growth",
            subtitle: "Any challenges today?",
        },
        {
            id: "tomorrow",
            title: "Tomorrow's Intention",
            subtitle: "What to focus on tomorrow?",
        },
    ];

    const MOODS = [
        { value: "happy", emoji: "😊", label: "Happy" },
        { value: "excited", emoji: "🤩", label: "Excited" },
        { value: "peaceful", emoji: "😌", label: "Peaceful" },
        { value: "neutral", emoji: "😐", label: "Neutral" },
        { value: "anxious", emoji: "😟", label: "Anxious" },
        { value: "sad", emoji: "😔", label: "Sad" },
    ];

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

    let firstName = "there";

    onMount(() => {
        const handleDebugSettingsChange = (event: CustomEvent) => {
            const settings = event.detail;
            if (settings.weatherType) {
                console.log(
                    "Debug panel changed weather to:",
                    settings.weatherType,
                );
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
                        console.log(
                            "Loading stored weather:",
                            settings.weatherType,
                        );
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
                console.error("Error loading debug settings:", error);
            }

            document.addEventListener(
                "chronicles-debug-settings-changed",
                handleDebugSettingsChange as EventListener,
            );
        }

        ensureWeatherData();

        firstName = "Alex";

        const weatherUnsubscribe = weatherStore.subscribe((state) => {
            if (state.currentWeather) {
                const condition =
                    state.currentWeather.weather.condition.toLowerCase();
                const cloudiness = state.currentWeather.details.clouds;
                const hour = new Date(state.currentWeather.date).getHours();
                const isNight = hour < 6 || hour > 18;

                if (isNight) {
                    updateWeather("stardust");
                } else if (
                    condition.includes("rain") ||
                    condition.includes("drizzle")
                ) {
                    updateWeather("rainy");
                } else if (
                    condition.includes("thunderstorm") ||
                    condition.includes("storm")
                ) {
                    updateWeather("stormy");
                } else if (condition.includes("snow")) {
                    updateWeather("cloudy");
                } else if (condition.includes("clear")) {
                    updateWeather("sunny");
                } else if (cloudiness < 25) {
                    updateWeather("sunny");
                } else if (cloudiness < 50) {
                    updateWeather("partly-cloudy");
                } else {
                    updateWeather("cloudy");
                }
            }
        });

        return () => {
            if (browser) {
                document.removeEventListener(
                    "chronicles-debug-settings-changed",
                    handleDebugSettingsChange as EventListener,
                );
            }
            weatherUnsubscribe();
        };
    });

    function nextStep() {
        if ($chroniclesStore.currentStep < 5) {
            chroniclesStore.nextStep();
        } else {
            finishJournal();
        }
    }

    function prevStep() {
        chroniclesStore.prevStep();
    }

    function finishJournal() {
        if ($chroniclesStore.currentEntry) {
            const entry = $chroniclesStore.currentEntry;

            let markdown = `---\n`;
            markdown += `date: "${entry.date}"\n`;
            markdown += `mood: "${entry.mood}"\n`;

            const events = entry.memorable_events || [];
            markdown += `meetings: [\n`;
            if (events.length > 0) {
                events.forEach((event, index) => {
                    markdown += `  "${event.replace(/"/g, '\\"')}"`;
                    if (index < events.length - 1) {
                        markdown += ",\n";
                    } else {
                        markdown += "\n";
                    }
                });
            }
            markdown += `]\n`;

            if (entry.energy !== undefined) {
                markdown += `energy: ${entry.energy}\n`;
            }

            if (entry.tags) {
                const tagArray = entry.tags.split(",").map((tag) => tag.trim());
                markdown += `tags: [${tagArray.map((tag) => `"${tag}"`).join(", ")}]\n`;
            }

            markdown += `---\n\n`;

            const dateFormatted = new Date(entry.date).toLocaleDateString(
                "en-US",
                {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                },
            );

            markdown += `## Journal Entry: ${dateFormatted}\n\n`;

            if (entry.wins && entry.wins.length) {
                markdown += `## Wins & Gratitude\n`;
                entry.wins.forEach((win) => {
                    markdown += `- ${win}\n`;
                });
                markdown += `- **Habits Completed:** ${entry.habits_completed ? "Yes" : "No"}\n\n`;
            }

            if (entry.challenges) {
                markdown += `## Challenges & Growth\n`;
                markdown += `${entry.challenges}\n\n`;

                if (entry.lessons_learned) {
                    markdown += `**Lessons Learned:**\n${entry.lessons_learned}\n\n`;
                }
            }

            if (entry.tomorrow_focus) {
                markdown += `## Tomorrow's Focus\n`;
                markdown += `${entry.tomorrow_focus}\n\n`;

                if (entry.potential_obstacles) {
                    markdown += `**Potential Obstacles:**\n${entry.potential_obstacles}\n\n`;
                }
            }

            chroniclesStore.updateField("content", markdown);

            chroniclesStore.saveEntry(entry);
        }
    }

    function addMemorableEvent() {
        if (newEvent.trim() && $chroniclesStore.currentEntry) {
            const events = $chroniclesStore.currentEntry.memorable_events || [];
            chroniclesStore.updateField("memorable_events", [
                ...events,
                newEvent.trim(),
            ]);
            newEvent = "";
        }
    }

    function addWin() {
        if (newWin.trim() && $chroniclesStore.currentEntry) {
            const wins = $chroniclesStore.currentEntry.wins || [];
            chroniclesStore.updateField("wins", [...wins, newWin.trim()]);
            newWin = "";
        }
    }

    function removeEvent(index: number) {
        if (
            $chroniclesStore.currentEntry &&
            $chroniclesStore.currentEntry.memorable_events
        ) {
            const events = [...$chroniclesStore.currentEntry.memorable_events];
            const removedEvent = events[index];
            events.splice(index, 1);
            chroniclesStore.updateField("memorable_events", events);

            if (removedEvent && removedEvent.includes(":")) {
                const eventSummary = removedEvent
                    .split(":")
                    .slice(1)
                    .join(":")
                    .trim();

                console.log(
                    "Attempting to restore event with summary:",
                    eventSummary,
                );
                console.log(
                    "Current addedCalendarEventIds:",
                    addedCalendarEventIds,
                );
                console.log(
                    "Available calendar events:",
                    $calendarStore.events,
                );

                let eventToRestore = $calendarStore.events.find(
                    (event) => event.summary === eventSummary,
                );

                if (!eventToRestore) {
                    eventToRestore = $calendarStore.events.find(
                        (event) =>
                            event.summary &&
                            eventSummary &&
                            (event.summary.includes(eventSummary) ||
                                eventSummary.includes(event.summary)),
                    );
                }

                if (eventToRestore && eventToRestore.id) {
                    console.log("Found event to restore:", eventToRestore);
                    addedCalendarEventIds = addedCalendarEventIds.filter(
                        (id) => id !== eventToRestore.id,
                    );
                    console.log(
                        "Updated addedCalendarEventIds:",
                        addedCalendarEventIds,
                    );
                } else {
                    console.log("Could not find matching event to restore");
                }
            }
        }
    }

    function removeWin(index: number) {
        if (
            $chroniclesStore.currentEntry &&
            $chroniclesStore.currentEntry.wins
        ) {
            const wins = [...$chroniclesStore.currentEntry.wins];
            wins.splice(index, 1);
            chroniclesStore.updateField("wins", wins);
        }
    }

    function addCalendarEventAsMemory(event: CalendarEvent) {
        if ($chroniclesStore.currentEntry) {
            const events = $chroniclesStore.currentEntry.memorable_events || [];
            const eventTime = formatEventTime(event);
            chroniclesStore.updateField("memorable_events", [
                ...events,
                `${eventTime}: ${event.summary}`,
            ]);

            if (event.id) {
                console.log("Adding event to tracking:", event);
                addedCalendarEventIds = [...addedCalendarEventIds, event.id];
                console.log(
                    "Updated addedCalendarEventIds:",
                    addedCalendarEventIds,
                );
            }
        }
    }

    const [send, receive] = crossfade({
        duration: 400,
        fallback(node, params) {
            const style = getComputedStyle(node);
            const transform = style.transform === "none" ? "" : style.transform;

            return {
                duration: 400,
                easing: cubicOut,
                css: (t, u) => `
                    transform: ${transform} scale(${t * 0.05 + 0.95});
                    opacity: ${t};
                `,
            };
        },
    });

    $: filteredTodayEvents = sortEventsByTime(
        getTodayEvents($calendarStore.events).filter(
            (event) => !event.id || !addedCalendarEventIds.includes(event.id),
        ),
    );

    const mockTomorrowEvents = [
        { time: "10:00 AM", title: "Product Review" },
        { time: "2:00 PM", title: "Doctor Appointment" },
    ];
</script>

<svelte:head>
    <style>
        .chronicles-title-area {
            position: relative;
            z-index: 10;
            background: transparent !important;
        }

        .chronicles-title-area h1,
        .chronicles-title-area h2,
        .chronicles-title-area p,
        .chronicles-title-area div {
            position: relative;
            z-index: 10;
            color: var(--foreground);
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .chronicles-title-area .date-title {
            background-color: rgba(0, 0, 0, 0.5);
            padding: 10px;
        }

        .chronicles-page-container {
            position: relative;
        }
    </style>
</svelte:head>

<div class="chronicles-container w-full relative">
    <div class="chronicles-background absolute inset-0 z-0"></div>

    <div class="w-full relative z-10 pt-4">
        <div class="flex justify-between items-center mb-6">
            <div class="steps-navigation flex items-center space-x-2">
                {#each STEPS as step, i}
                    <button
                        class="step-icon w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out relative
                           {$chroniclesStore.currentStep === i + 1
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
                        {#key $chroniclesStore.currentStep}
                            <div
                                class="journal-step-content absolute inset-0 p-6"
                                in:receive={{
                                    key: $chroniclesStore.currentStep,
                                }}
                                out:send={{ key: $chroniclesStore.currentStep }}
                            >
                                {#if $chroniclesStore.currentStep === 1}
                                    <!-- Step 1: Day Overview & Mood Check-in -->
                                    <h3
                                        class="text-2xl font-semibold mb-6 text-primary"
                                    >
                                        How was your {new Date().toLocaleDateString(
                                            "en-US",
                                            { weekday: "long" },
                                        )}, {firstName}?
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
                                            {#each MOODS as mood}
                                                <button
                                                    class="mood-button flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200 hover:scale-105 hover:shadow-md {$chroniclesStore
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
                                                    <span class="text-2xl mb-1"
                                                        >{mood.emoji}</span
                                                    >
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
                                                    $chroniclesStore
                                                        .currentEntry?.energy ||
                                                        5,
                                                ]}
                                                min={1}
                                                max={10}
                                                step={1}
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
                                                    >{$chroniclesStore
                                                        .currentEntry?.energy ||
                                                        5}/10</span
                                                >
                                                <span
                                                    class="text-xs text-muted-foreground"
                                                    >High</span
                                                >
                                            </div>
                                        </div>
                                    </div>
                                {:else if $chroniclesStore.currentStep === 2}
                                    <!-- Step 2: Quick Reflection on Main Events -->
                                    <h3
                                        class="text-2xl font-semibold mb-6 text-primary"
                                    >
                                        What was most memorable today?
                                    </h3>

                                    <!-- Events List -->
                                    <div class="mb-6">
                                        {#if $chroniclesStore.currentEntry?.memorable_events && $chroniclesStore.currentEntry.memorable_events.length > 0}
                                            <div class="mb-4 space-y-2">
                                                {#each $chroniclesStore.currentEntry.memorable_events as event, i}
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
                                {:else if $chroniclesStore.currentStep === 3}
                                    <!-- Step 3: Gratitude & Wins -->
                                    <h3
                                        class="text-2xl font-semibold mb-6 text-primary"
                                    >
                                        What went well today?
                                    </h3>

                                    <!-- Wins List -->
                                    <div class="mb-6">
                                        {#if $chroniclesStore.currentEntry?.wins && $chroniclesStore.currentEntry.wins.length > 0}
                                            <div class="mb-4 space-y-2">
                                                {#each $chroniclesStore.currentEntry.wins as win, i}
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
                                            checked={$chroniclesStore
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
                                {:else if $chroniclesStore.currentStep === 4}
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
                                            value={$chroniclesStore.currentEntry
                                                ?.challenges || ""}
                                            on:input={(e) =>
                                                chroniclesStore.updateField(
                                                    "challenges",
                                                    e.currentTarget.value,
                                                )}
                                        />
                                    </div>

                                    <!-- Lessons Learned (only if challenge entered) -->
                                    {#if $chroniclesStore.currentEntry?.challenges && $chroniclesStore.currentEntry.challenges.trim().length > 0}
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
                                                value={$chroniclesStore
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
                                {:else if $chroniclesStore.currentStep === 5}
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
                                            value={$chroniclesStore.currentEntry
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
                                            value={$chroniclesStore.currentEntry
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
                        {#key $chroniclesStore.currentStep}
                            <div
                                class="context-panel-content absolute inset-0 p-6"
                                in:receive={{
                                    key: `context-${$chroniclesStore.currentStep}`,
                                }}
                                out:send={{
                                    key: `context-${$chroniclesStore.currentStep}`,
                                }}
                            >
                                {#if $chroniclesStore.currentStep === 1}
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
                                {:else if $chroniclesStore.currentStep === 2}
                                    <!-- Step 2: Context panel - Calendar events -->
                                    <h3 class="text-lg font-medium mb-4">
                                        Today's Schedule
                                    </h3>

                                    <!-- Calendar Events with times -->
                                    <div class="relative border-muted">
                                        {#each filteredTodayEvents as event, i}
                                            <div class="mb-6 relative">
                                                <div
                                                    class="absolute -left-[25px] top-0 h-4 w-4 rounded-full {getEventTimeColor(
                                                        event,
                                                    )
                                                        .replace('bg-', '')
                                                        .split(' ')[0]}"
                                                ></div>
                                                <div
                                                    class="text-xs text-muted-foreground mb-1"
                                                >
                                                    {formatEventTime(event)}
                                                </div>
                                                <div
                                                    class="p-3 rounded {getEventTimeColor(
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
                                                </div>
                                            </div>
                                        {/each}
                                    </div>

                                    <!-- Step Indicator -->
                                    <div class="mt-6 text-center">
                                        <div
                                            class="text-sm text-muted-foreground"
                                        >
                                            Step 2 of 5
                                        </div>
                                    </div>
                                {:else if $chroniclesStore.currentStep === 3}
                                    <!-- Step 3: Context panel - Habit trackers -->
                                    <h3 class="text-lg font-medium mb-4">
                                        Your Habits Today
                                    </h3>

                                    <!-- Mock Habit Trackers -->
                                    <div class="space-y-4">
                                        <div class="p-3 rounded-lg bg-muted/30">
                                            <div
                                                class="flex justify-between items-center"
                                            >
                                                <div
                                                    class="text-sm font-medium"
                                                >
                                                    Morning Meditation
                                                </div>
                                                <div class="text-green-500">
                                                    <CheckCircle2
                                                        class="h-4 w-4"
                                                    />
                                                </div>
                                            </div>
                                            <div
                                                class="text-xs text-muted-foreground mt-1"
                                            >
                                                7 day streak
                                            </div>
                                        </div>

                                        <div class="p-3 rounded-lg bg-muted/30">
                                            <div
                                                class="flex justify-between items-center"
                                            >
                                                <div
                                                    class="text-sm font-medium"
                                                >
                                                    Reading
                                                </div>
                                                <div class="text-green-500">
                                                    <CheckCircle2
                                                        class="h-4 w-4"
                                                    />
                                                </div>
                                            </div>
                                            <div
                                                class="text-xs text-muted-foreground mt-1"
                                            >
                                                3 day streak
                                            </div>
                                        </div>

                                        <div class="p-3 rounded-lg bg-muted/30">
                                            <div
                                                class="flex justify-between items-center"
                                            >
                                                <div
                                                    class="text-sm font-medium"
                                                >
                                                    Exercise
                                                </div>
                                                <div
                                                    class="text-muted-foreground"
                                                >
                                                    <svg
                                                        width="15"
                                                        height="15"
                                                        viewBox="0 0 15 15"
                                                        fill="none"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        class="h-4 w-4"
                                                        ><path
                                                            d="M7.49991 0.876892C3.84222 0.876892 0.877075 3.84204 0.877075 7.49972C0.877075 11.1574 3.84222 14.1226 7.49991 14.1226C11.1576 14.1226 14.1227 11.1574 14.1227 7.49972C14.1227 3.84204 11.1576 0.876892 7.49991 0.876892ZM7.49988 1.82689C10.6305 1.82689 13.1727 4.36904 13.1727 7.49972C13.1727 10.6304 10.6305 13.1726 7.49988 13.1726C4.3692 13.1726 1.82706 10.6304 1.82706 7.49972C1.82706 4.36904 4.3692 1.82689 7.49988 1.82689ZM7.50001 3.84967C7.22386 3.84967 7.00001 4.07352 7.00001 4.34967V7.49967C7.00001 7.77582 7.22386 7.99967 7.50001 7.99967H9.50001C9.77616 7.99967 10 7.77582 10 7.49967C10 7.22353 9.77616 6.99967 9.50001 6.99967H8.00001V4.34967C8.00001 4.07352 7.77616 3.84967 7.50001 3.84967Z"
                                                            fill="currentColor"
                                                            fill-rule="evenodd"
                                                            clip-rule="evenodd"
                                                        ></path></svg
                                                    >
                                                </div>
                                            </div>
                                            <div
                                                class="text-xs text-muted-foreground mt-1"
                                            >
                                                Not completed
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Step Indicator -->
                                    <div class="mt-8 text-center">
                                        <div
                                            class="text-sm text-muted-foreground"
                                        >
                                            Step 3 of 5
                                        </div>
                                    </div>
                                {:else if $chroniclesStore.currentStep === 4}
                                    <!-- Step 4: Context panel - Recent past challenges -->
                                    <h3 class="text-lg font-medium mb-4">
                                        Recent Challenges
                                    </h3>

                                    <!-- Mock Recent Challenges -->
                                    <div class="space-y-4">
                                        <div class="p-3 rounded-lg bg-muted/30">
                                            <div
                                                class="text-xs text-muted-foreground"
                                            >
                                                Yesterday
                                            </div>
                                            <div class="text-sm mt-1">
                                                Struggled with focus during team
                                                meeting
                                            </div>
                                        </div>

                                        <div class="p-3 rounded-lg bg-muted/30">
                                            <div
                                                class="text-xs text-muted-foreground"
                                            >
                                                3 days ago
                                            </div>
                                            <div class="text-sm mt-1">
                                                Project deadline stress
                                            </div>
                                        </div>

                                        <div class="p-3 rounded-lg bg-muted/30">
                                            <div
                                                class="text-xs text-muted-foreground"
                                            >
                                                Last week
                                            </div>
                                            <div class="text-sm mt-1">
                                                Communication issues with team
                                                members
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Step Indicator -->
                                    <div class="mt-8 text-center">
                                        <div
                                            class="text-sm text-muted-foreground"
                                        >
                                            Step 4 of 5
                                        </div>
                                    </div>
                                {:else if $chroniclesStore.currentStep === 5}
                                    <!-- Step 5: Context panel - Tomorrow's calendar -->
                                    <h3 class="text-lg font-medium mb-4">
                                        Tomorrow's Schedule
                                    </h3>

                                    <!-- Tomorrow's Calendar Events -->
                                    <div class="mt-4">
                                        <h4
                                            class="text-sm font-medium mb-2 flex items-center"
                                        >
                                            <Calendar class="h-4 w-4 mr-2" />
                                            <span>Tomorrow's Calendar</span>
                                        </h4>
                                        <div class="space-y-2">
                                            {#each sortEventsByTime(getTomorrowEvents($calendarStore.events)) as event}
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

                                    <!-- Step Indicator -->
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

    <!-- Add fixed navigation buttons at the bottom of the screen -->
    <div class="fixed-nav-buttons">
        <div class="container mx-auto px-4">
            <div class="flex justify-start items-center space-x-2">
                <Button
                    variant="outline"
                    on:click={prevStep}
                    disabled={$chroniclesStore.currentStep === 1}
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
                    {$chroniclesStore.currentStep === 5
                        ? "Finish Journal"
                        : "Next"}
                    {#if $chroniclesStore.currentStep !== 5}
                        <ChevronRight class="h-4 w-4" />
                    {/if}
                </Button>
            </div>
        </div>
    </div>
</div>

{#if showJsonData && $chroniclesStore.currentEntry}
    <div class="fixed bottom-4 left z-50 w-96 max-w-full shadow-xl">
        <Card
            class="p-4 text-xs bg-black bg-opacity-50 font-mono overflow-auto max-h-[50vh]"
        >
            <div class="flex justify-between items-center mb-2">
                <h3 class="text-sm font-semibold">JSON Data Preview</h3>
                <Button variant="ghost" size="sm" class="h-6 w-6 p-0">
                    <FileCode size={14} />
                </Button>
            </div>
            <pre
                class="whitespace-pre-wrap break-all text-[10px]">{JSON.stringify(
                    $chroniclesStore.currentEntry,
                    null,
                    2,
                )}</pre>
        </Card>
    </div>
{/if}

<style>
    /* Add styles for fixed navigation buttons */
    .fixed-nav-buttons {
        position: absolute;
        right: 0;
        background-color: var(--background);
        border-top: 1px solid var(--border);
        padding: 1rem 0;
        z-index: 10;
    }

    /* Add padding to the bottom of the page to ensure content isn't hidden behind the fixed navigation */
    .chronicles-container {
        padding-bottom: 5rem;
        position: relative;
        min-height: calc(100vh - 4rem);
        overflow: hidden;
        border-radius: 0.5rem;
    }

    /* Chronicles background element - this is what will change color */
    .chronicles-background {
        position: absolute;
        inset: 0;
        z-index: 0;
        opacity: 0.7;
        border-radius: 0.5rem;
        pointer-events: none; /* Make sure clicks pass through */
        transition: background 1s ease;
    }

    /* Animation for active mood */
    button:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
    }

    /* Pulse animation for active mood */
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

    /* Fixed height containers for smoother transitions */
    .journal-panel-container,
    .context-panel-content {
        height: 100%;
        min-height: 400px;
    }

    .journal-card {
        transition: all 0.3s ease;
        border: 1px solid rgba(var(--primary-rgb), 0.2);
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

    /* Updated styles for step navigation */
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

    /* Improved element styling */
    .mood-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.15);
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

    /* Mobile improvements */
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

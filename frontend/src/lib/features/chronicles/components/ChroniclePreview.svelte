<script lang="ts">
    import { Card } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import { Progress } from "$lib/components/ui/progress";
    import { fade, fly, scale } from "svelte/transition";
    import { getContext } from "svelte";
    import {
        Heart,
        Award,
        PenLine,
        Lightbulb,
        ArrowRight,
        CloudRain,
        Sun,
        Calendar,
    } from "lucide-svelte";
    import type { JournalEntry } from "../types";

    // Props
    export let entry: JournalEntry | null = null;

    // Emoji mapping for moods
    const moodEmojis: Record<string, string> = {
        happy: "😊",
        excited: "🤩",
        peaceful: "😌",
        neutral: "😐",
        anxious: "😟",
        sad: "😔",
    };

    // Color mapping for moods
    const moodColors: Record<string, string> = {
        happy: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
        excited:
            "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
        peaceful:
            "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
        neutral:
            "bg-slate-100 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200",
        anxious:
            "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
        sad: "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
    };

    // Helper function to get date display
    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }

    // Function to get energy color based on level
    function getEnergyColor(level: number): string {
        if (level <= 3) return "bg-red-100 dark:bg-red-900/30";
        if (level <= 6) return "bg-amber-100 dark:bg-amber-900/30";
        return "bg-green-100 dark:bg-green-900/30";
    }

    // Function to get energy text color based on level
    function getEnergyTextColor(level: number): string {
        if (level <= 3) return "text-red-800 dark:text-red-200";
        if (level <= 6) return "text-amber-800 dark:text-amber-200";
        return "text-green-800 dark:text-green-200";
    }
</script>

{#if entry}
    <div class="w-full" in:fade={{ duration: 300 }}>
        <Card class="p-4 sm:p-6 overflow-hidden preview-card">
            <!-- Header Section -->
            <div class="mb-6 text-center">
                <div
                    class="inline-block p-4 rounded-full mb-4 {moodColors[
                        entry.mood
                    ] || 'bg-primary/10'}"
                    in:scale={{ duration: 400, delay: 200 }}
                >
                    <div class="text-4xl sm:text-5xl">
                        {moodEmojis[entry.mood] || "😐"}
                    </div>
                </div>
                <h1 class="text-xl sm:text-2xl font-bold text-primary">
                    {formatDate(entry.date)}
                </h1>
                <div class="flex flex-wrap justify-center gap-2 mt-3">
                    {#if entry.tags}
                        {#each entry.tags
                            .split(",")
                            .map((t) => t.trim()) as tag}
                            {#if tag}
                                <Badge
                                    variant="outline"
                                    class="capitalize tag-badge">#{tag}</Badge
                                >
                            {/if}
                        {/each}
                    {/if}
                </div>
            </div>

            <Separator class="my-4 sm:my-6" />

            <!-- Mood & Energy Section -->
            <div
                class="mb-6 sm:mb-8"
                in:fly={{ y: 20, duration: 300, delay: 100 }}
            >
                <h2
                    class="text-lg font-semibold flex items-center mb-3 sm:mb-4"
                >
                    <Heart class="h-5 w-5 text-pink-500 mr-2" />
                    <span>Mood & Energy</span>
                </h2>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div
                        class="p-3 sm:p-4 rounded-lg {moodColors[entry.mood] ||
                            'bg-muted/30'} mood-card"
                    >
                        <div class="text-sm text-muted-foreground mb-1">
                            Mood
                        </div>
                        <div class="flex items-center">
                            <span class="text-2xl mr-2"
                                >{moodEmojis[entry.mood] || "😐"}</span
                            >
                            <span class="text-lg capitalize">{entry.mood}</span>
                        </div>
                    </div>

                    <div
                        class="p-3 sm:p-4 rounded-lg {getEnergyColor(
                            entry.energy || 5,
                        )} energy-card"
                    >
                        <div class="text-sm text-muted-foreground mb-1">
                            Energy Level
                        </div>
                        <div
                            class="mb-2 {getEnergyTextColor(
                                entry.energy || 5,
                            )} text-lg font-medium"
                        >
                            {entry.energy}/10
                        </div>
                        <Progress
                            value={(entry.energy || 5) * 10}
                            class="h-2 energy-progress"
                        />
                    </div>
                </div>
            </div>

            <!-- Memorable Events Section -->
            {#if entry.memorable_events && entry.memorable_events.length > 0}
                <div
                    class="mb-6 sm:mb-8"
                    in:fly={{ y: 20, duration: 300, delay: 200 }}
                >
                    <h2
                        class="text-lg font-semibold flex items-center mb-3 sm:mb-4"
                    >
                        <Calendar class="h-5 w-5 text-blue-500 mr-2" />
                        <span>Memorable Events</span>
                    </h2>

                    <div class="space-y-2">
                        {#each entry.memorable_events as event, i}
                            <div
                                class="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-l-4 border-blue-400 dark:border-blue-600 event-card"
                            >
                                {event}
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Wins & Gratitude Section -->
            {#if entry.wins && entry.wins.length > 0}
                <div
                    class="mb-6 sm:mb-8"
                    in:fly={{ y: 20, duration: 300, delay: 300 }}
                >
                    <h2
                        class="text-lg font-semibold flex items-center mb-3 sm:mb-4"
                    >
                        <Award class="h-5 w-5 text-amber-500 mr-2" />
                        <span>Wins & Gratitude</span>
                    </h2>

                    <div class="space-y-2">
                        {#each entry.wins as win, i}
                            <div
                                class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border-l-4 border-amber-400 dark:border-amber-600 win-card"
                            >
                                {win}
                            </div>
                        {/each}
                    </div>

                    {#if entry.habits_completed !== undefined}
                        <div
                            class="mt-4 p-3 rounded-lg {entry.habits_completed
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                                : 'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200'} flex items-center habit-card"
                        >
                            <div class="mr-3">
                                {#if entry.habits_completed}
                                    <div
                                        class="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center"
                                    >
                                        <svg
                                            width="15"
                                            height="15"
                                            viewBox="0 0 15 15"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="h-4 w-4 text-green-500"
                                            ><path
                                                d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                                                fill="currentColor"
                                                fill-rule="evenodd"
                                                clip-rule="evenodd"
                                            ></path></svg
                                        >
                                    </div>
                                {:else}
                                    <div
                                        class="h-5 w-5 rounded-full bg-orange-500/20 flex items-center justify-center"
                                    >
                                        <svg
                                            width="15"
                                            height="15"
                                            viewBox="0 0 15 15"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="h-4 w-4 text-orange-500"
                                            ><path
                                                d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                                                fill="currentColor"
                                                fill-rule="evenodd"
                                                clip-rule="evenodd"
                                            ></path></svg
                                        >
                                    </div>
                                {/if}
                            </div>
                            <div>
                                Habits completed: <span class="font-medium"
                                    >{entry.habits_completed
                                        ? "Yes"
                                        : "No"}</span
                                >
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Challenges Section -->
            {#if entry.challenges}
                <div
                    class="mb-6 sm:mb-8"
                    in:fly={{ y: 20, duration: 300, delay: 400 }}
                >
                    <h2
                        class="text-lg font-semibold flex items-center mb-3 sm:mb-4"
                    >
                        <PenLine class="h-5 w-5 text-indigo-500 mr-2" />
                        <span>Challenges & Growth</span>
                    </h2>

                    <div
                        class="p-3 sm:p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 mb-4 challenge-card"
                    >
                        <div class="text-sm text-muted-foreground mb-1">
                            Challenges
                        </div>
                        <div class="whitespace-pre-line">
                            {entry.challenges}
                        </div>
                    </div>

                    {#if entry.lessons_learned}
                        <div
                            class="p-3 sm:p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 lessons-card"
                        >
                            <div class="text-sm text-muted-foreground mb-1">
                                Lessons Learned
                            </div>
                            <div class="whitespace-pre-line">
                                {entry.lessons_learned}
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Tomorrow's Focus Section -->
            {#if entry.tomorrow_focus}
                <div class="mb-4" in:fly={{ y: 20, duration: 300, delay: 500 }}>
                    <h2
                        class="text-lg font-semibold flex items-center mb-3 sm:mb-4"
                    >
                        <Lightbulb class="h-5 w-5 text-yellow-500 mr-2" />
                        <span>Tomorrow's Focus</span>
                    </h2>

                    <div
                        class="p-3 sm:p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 mb-4 focus-card"
                    >
                        <div class="flex items-start">
                            <ArrowRight
                                class="h-5 w-5 text-yellow-500 mt-0.5 mr-2 flex-shrink-0"
                            />
                            <div class="whitespace-pre-line">
                                {entry.tomorrow_focus}
                            </div>
                        </div>
                    </div>

                    {#if entry.potential_obstacles}
                        <div
                            class="p-3 sm:p-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-200 obstacles-card"
                        >
                            <div class="text-sm text-muted-foreground mb-1">
                                Potential Obstacles
                            </div>
                            <div class="whitespace-pre-line">
                                {entry.potential_obstacles}
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        </Card>
    </div>
{:else}
    <Card class="p-6 text-center">
        <div class="text-muted-foreground">
            No journal entry available for this date.
        </div>
    </Card>
{/if}

<style>
    /* Add subtle hover effect to sections */
    .preview-card {
        transition: all 0.3s ease;
        border: 1px solid rgba(var(--primary-rgb), 0.2);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .rounded-lg {
        transition: all 0.2s ease-out;
    }

    .rounded-lg:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
    }

    .mood-card,
    .energy-card,
    .event-card,
    .win-card,
    .habit-card,
    .challenge-card,
    .lessons-card,
    .focus-card,
    .obstacles-card {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .tag-badge {
        transition: all 0.2s ease;
    }

    .tag-badge:hover {
        background-color: var(--primary);
        color: var(--primary-foreground);
    }

    .energy-progress {
        height: 6px;
        border-radius: 3px;
    }

    /* Mobile improvements */
    @media (max-width: 640px) {
        h2 {
            font-size: 1.1rem;
        }

        .p-3 {
            padding: 0.5rem 0.75rem;
        }
    }
</style>

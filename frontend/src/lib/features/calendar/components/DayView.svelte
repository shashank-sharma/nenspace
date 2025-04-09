<script lang="ts">
    import type { CalendarEvent } from "../types";
    import { isToday, formatDateReadable } from "../utils/date";
    import SimpleEventCard from "./SimpleEventCard.svelte";

    export let events: CalendarEvent[] = [];
    export let selectedDate: Date;
    export let onDateSelect: (date: Date) => void;
    export let onEventClick: (event: CalendarEvent, e?: MouseEvent) => void;

    const HOURS = Array.from({ length: 24 }, (_, i) => i);

    function isSameDay(date1: Date, date2: Date): boolean {
        return (
            date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate()
        );
    }

    function filterEventsForDay(
        events: CalendarEvent[],
        date: Date,
    ): CalendarEvent[] {
        if (!events || events.length === 0) return [];

        return events.filter((event) => {
            if (!event || !event.start) return false;
            const eventDate = new Date(event.start);
            return isSameDay(eventDate, date);
        });
    }

    $: dayEvents = filterEventsForDay(events, selectedDate);
    $: allDayEvents = dayEvents.filter((event) => event.is_day_event);

    function getEventsByHour(hour: number): CalendarEvent[] {
        return dayEvents.filter((event) => {
            if (event.is_day_event) return false;

            const eventStart = new Date(event.start);
            return eventStart.getHours() === hour;
        });
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "ArrowLeft") {
            const prevDay = new Date(selectedDate);
            prevDay.setDate(prevDay.getDate() - 1);
            onDateSelect(prevDay);
        } else if (event.key === "ArrowRight") {
            const nextDay = new Date(selectedDate);
            nextDay.setDate(nextDay.getDate() + 1);
            onDateSelect(nextDay);
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="w-full max-w-3xl mx-auto">
    <div
        class="flex justify-between items-center mb-4 sticky top-0 bg-background z-10 p-2"
    >
        <h2 class="text-2xl font-semibold">
            {formatDateReadable(selectedDate)}
            {#if isToday(selectedDate)}
                <span
                    class="ml-2 text-sm bg-primary text-primary-foreground px-2 py-0.5 rounded-full"
                    >Today</span
                >
            {/if}
        </h2>

        <div class="flex gap-2">
            <button
                class="p-2 rounded-full hover:bg-muted transition-colors"
                on:click={() => {
                    const prevDay = new Date(selectedDate);
                    prevDay.setDate(prevDay.getDate() - 1);
                    onDateSelect(prevDay);
                }}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg
                >
            </button>

            <button
                class="p-2 rounded-full hover:bg-muted transition-colors"
                on:click={() => {
                    const today = new Date();
                    onDateSelect(today);
                }}
            >
                Today
            </button>

            <button
                class="p-2 rounded-full hover:bg-muted transition-colors"
                on:click={() => {
                    const nextDay = new Date(selectedDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    onDateSelect(nextDay);
                }}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg
                >
            </button>
        </div>
    </div>

    <div class="mb-6">
        {#if allDayEvents.length > 0}
            <div class="bg-muted/30 p-3 rounded-lg">
                <h3 class="text-sm font-medium mb-2">All-day Events</h3>
                <div class="space-y-2">
                    {#each allDayEvents as event (event.id)}
                        <div
                            class="cursor-pointer max-w-full"
                            on:click={(e) => onEventClick(event, e)}
                        >
                            <SimpleEventCard {event} maxWidth="100%" />
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>

    <div class="space-y-1">
        {#each HOURS as hour (hour)}
            {@const hourEvents = getEventsByHour(hour)}
            {@const isCurrentHour =
                isToday(selectedDate) && new Date().getHours() === hour}

            <div
                class="grid grid-cols-[60px_1fr] gap-2 min-h-20 border-b border-muted/40 py-1
                      {isCurrentHour ? 'bg-primary/5' : ''}"
            >
                <div class="text-sm text-muted-foreground text-right pt-1">
                    {hour.toString().padStart(2, "0")}:00
                </div>

                <div class="relative">
                    <div class="space-y-1 py-1 pr-1">
                        {#if hourEvents.length > 0}
                            {#each hourEvents as event (event.id)}
                                <div
                                    class="cursor-pointer max-w-full"
                                    on:click={(e) => onEventClick(event, e)}
                                >
                                    <SimpleEventCard {event} maxWidth="100%" />
                                </div>
                            {/each}
                        {:else if hour === 12 && dayEvents.length === 0}
                            <div class="text-sm text-muted-foreground italic">
                                No events for this day
                            </div>
                        {/if}
                    </div>

                    {#if isCurrentHour && isToday(selectedDate)}
                        {@const now = new Date()}
                        {@const minutePercentage =
                            (now.getMinutes() / 60) * 100}
                        <div
                            class="absolute left-0 right-0 border-t border-primary z-10"
                            style="top: {minutePercentage}%"
                        >
                            <div
                                class="absolute -left-3 -top-1.5 w-3 h-3 rounded-full bg-primary"
                            ></div>
                        </div>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>

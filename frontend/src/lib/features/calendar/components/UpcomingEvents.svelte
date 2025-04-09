<script lang="ts">
    import type { CalendarEvent } from "../types";
    import { isSameDay, isToday } from "../utils/date";
    import {
        format,
        startOfMonth,
        endOfMonth,
        startOfWeek,
        endOfWeek,
        isWithinInterval,
    } from "date-fns";
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription,
    } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Calendar, Clock } from "lucide-svelte";

    export let events: CalendarEvent[] = [];
    export let selectedDate: Date;
    export let view: "month" | "week" | "day" = "month";

    $: filteredEvents = getFilteredEvents(events, selectedDate, view);
    $: viewTitle = getViewTitle(selectedDate, view);
    $: sortedEvents = [...filteredEvents].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );

    function getViewTitle(date: Date, view: string): string {
        switch (view) {
            case "month":
                return format(date, "MMMM yyyy");
            case "week":
                return `Week of ${format(startOfWeek(date), "MMM d")}`;
            case "day":
                return format(date, "EEEE, MMMM d");
            default:
                return "Upcoming Events";
        }
    }

    function getFilteredEvents(
        events: CalendarEvent[],
        date: Date,
        view: string,
    ): CalendarEvent[] {
        if (!events || events.length === 0) return [];

        switch (view) {
            case "month": {
                const monthStart = startOfMonth(date);
                const monthEnd = endOfMonth(date);
                return events.filter((event) => {
                    const eventDate = new Date(event.start);
                    return isWithinInterval(eventDate, {
                        start: monthStart,
                        end: monthEnd,
                    });
                });
            }
            case "week": {
                const weekStart = startOfWeek(date);
                const weekEnd = endOfWeek(date);
                return events.filter((event) => {
                    const eventDate = new Date(event.start);
                    return isWithinInterval(eventDate, {
                        start: weekStart,
                        end: weekEnd,
                    });
                });
            }
            case "day": {
                return events.filter((event) => {
                    const eventDate = new Date(event.start);
                    return isSameDay(eventDate, date);
                });
            }
            default:
                return events;
        }
    }

    function formatEventTime(event: CalendarEvent): string {
        const start = new Date(event.start);
        if (event.is_day_event) return "All day";
        return format(start, "h:mm a");
    }

    function groupEventsByDay(
        events: CalendarEvent[],
    ): Record<string, CalendarEvent[]> {
        const grouped: Record<string, CalendarEvent[]> = {};

        events.forEach((event) => {
            const date = new Date(event.start);
            const dateKey = format(date, "yyyy-MM-dd");

            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }

            grouped[dateKey].push(event);
        });

        return grouped;
    }

    $: groupedEvents = view === "day" ? null : groupEventsByDay(sortedEvents);
    $: dayEvents = view === "day" ? getDayEvents(sortedEvents) : null;

    function getDayEvents(events: CalendarEvent[]) {
        const now = new Date();
        const currentHour = now.getHours();

        const past: CalendarEvent[] = [];
        const current: CalendarEvent[] = [];
        const upcoming: CalendarEvent[] = [];

        events.forEach((event) => {
            const eventDate = new Date(event.start);
            const eventHour = eventDate.getHours();

            if (eventHour < currentHour) {
                past.push(event);
            } else if (eventHour === currentHour) {
                current.push(event);
            } else {
                upcoming.push(event);
            }
        });

        return { past, current, upcoming };
    }
</script>

<Card class="border shadow-sm mt-4">
    <CardHeader class="pb-2">
        <CardTitle class="flex items-center text-lg">
            <Calendar class="mr-2 h-4 w-4" />
            {viewTitle} Events
        </CardTitle>
        <CardDescription class="text-sm">
            {#if sortedEvents.length === 0}
                No events scheduled
            {:else}
                {sortedEvents.length} event{sortedEvents.length !== 1
                    ? "s"
                    : ""}
            {/if}
        </CardDescription>
    </CardHeader>

    <CardContent class="space-y-3 max-h-[400px] overflow-y-auto">
        {#if sortedEvents.length === 0}
            <div class="text-center py-4 text-muted-foreground">
                <p>No events found for this {view}</p>
            </div>
        {:else if view === "day"}
            {#if dayEvents && (dayEvents.current.length > 0 || dayEvents.upcoming.length > 0)}
                <div class="space-y-4">
                    {#if dayEvents.current.length > 0}
                        <div>
                            <h3
                                class="text-sm font-medium mb-2 flex items-center"
                            >
                                <Badge
                                    variant="outline"
                                    class="mr-2 bg-amber-100 text-amber-800 border-amber-200"
                                    >Current</Badge
                                >
                                Happening Now
                            </h3>
                            <div class="space-y-2">
                                {#each dayEvents.current as event}
                                    <div
                                        class="p-2 border rounded-md bg-amber-50 border-amber-200"
                                    >
                                        <div
                                            class="flex justify-between items-start"
                                        >
                                            <div class="font-medium">
                                                {event.summary}
                                            </div>
                                            <div
                                                class="text-xs flex items-center text-amber-700"
                                            >
                                                <Clock class="h-3 w-3 mr-1" />
                                                {formatEventTime(event)}
                                            </div>
                                        </div>
                                        {#if event.description}
                                            <div
                                                class="text-xs text-muted-foreground mt-1"
                                            >
                                                {@html event.description}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    {#if dayEvents.upcoming.length > 0}
                        <div>
                            <h3
                                class="text-sm font-medium mb-2 flex items-center"
                            >
                                <Badge
                                    variant="outline"
                                    class="mr-2 bg-blue-100 text-blue-800 border-blue-200"
                                    >Upcoming</Badge
                                >
                                Coming Up Today
                            </h3>
                            <div class="space-y-2">
                                {#each dayEvents.upcoming as event}
                                    <div class="p-2 border rounded-md">
                                        <div
                                            class="flex justify-between items-start"
                                        >
                                            <div class="font-medium">
                                                {event.summary}
                                            </div>
                                            <div
                                                class="text-xs flex items-center text-muted-foreground"
                                            >
                                                <Clock class="h-3 w-3 mr-1" />
                                                {formatEventTime(event)}
                                            </div>
                                        </div>
                                        {#if event.description}
                                            <div
                                                class="text-xs text-muted-foreground mt-1"
                                            >
                                                {@html event.description}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    {#if dayEvents.past.length > 0}
                        <div>
                            <h3
                                class="text-sm font-medium mb-2 flex items-center"
                            >
                                <Badge
                                    variant="outline"
                                    class="mr-2 bg-gray-100 text-gray-800 border-gray-200"
                                    >Past</Badge
                                >
                                Earlier Today
                            </h3>
                            <div class="space-y-2">
                                {#each dayEvents.past as event}
                                    <div
                                        class="p-2 border rounded-md opacity-60"
                                    >
                                        <div
                                            class="flex justify-between items-start"
                                        >
                                            <div class="font-medium">
                                                {event.summary}
                                            </div>
                                            <div
                                                class="text-xs flex items-center text-muted-foreground"
                                            >
                                                <Clock class="h-3 w-3 mr-1" />
                                                {formatEventTime(event)}
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    {#if dayEvents.past.length === 0 && dayEvents.current.length === 0 && dayEvents.upcoming.length === 0}
                        <div class="text-center py-4 text-muted-foreground">
                            <p>No events scheduled for today</p>
                        </div>
                    {/if}
                </div>
            {:else}
                <div class="text-center py-4 text-muted-foreground">
                    <p>Your schedule is clear for today!</p>
                    <p class="text-xs mt-2">Enjoy your free time</p>
                </div>
            {/if}
        {:else if groupedEvents}
            <div class="space-y-4">
                {#each Object.entries(groupedEvents) as [dateKey, dayEvents]}
                    {@const date = new Date(dateKey)}
                    <div>
                        <h3 class="text-sm font-medium mb-2 flex items-center">
                            {#if isToday(date)}
                                <Badge class="mr-2">Today</Badge>
                            {/if}
                            {format(date, "EEE, MMM d")}
                        </h3>
                        <div class="space-y-2">
                            {#each dayEvents as event}
                                <div
                                    class="p-2 border rounded-md {isToday(date)
                                        ? 'bg-muted/20'
                                        : ''}"
                                >
                                    <div
                                        class="flex justify-between items-start"
                                    >
                                        <div class="font-medium">
                                            {event.summary}
                                        </div>
                                        <div
                                            class="text-xs flex items-center text-muted-foreground"
                                        >
                                            <Clock class="h-3 w-3 mr-1" />
                                            {formatEventTime(event)}
                                        </div>
                                    </div>
                                    {#if event.description}
                                        <div
                                            class="text-xs text-muted-foreground mt-1"
                                        >
                                            {@html event.description}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </CardContent>
</Card>

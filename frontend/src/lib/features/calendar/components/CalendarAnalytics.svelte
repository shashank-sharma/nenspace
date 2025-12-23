<script lang="ts">
    import type { CalendarEvent } from "../types";
    import { format, startOfMonth, endOfMonth } from "date-fns";
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription,
    } from "$lib/components/ui/card";
    import { Activity } from "lucide-svelte";

    let { events = [], selectedDate = $bindable(new Date()) } = $props<{
        events?: CalendarEvent[];
        selectedDate?: Date;
    }>();

    const eventsThisMonth = $derived(getEventsInMonth(events, selectedDate));
    const eventsByDayOfWeek = $derived(
        getEventsByDayOfWeek(eventsThisMonth, selectedDate),
    );
    const eventsByTimeOfDay = $derived(
        getEventsByTimeOfDay(eventsThisMonth, selectedDate),
    );
    const mostBusyDay = $derived(getMostBusyDay(eventsByDayOfWeek));
    const totalEventsThisMonth = $derived(eventsThisMonth.length);

    function getEventsByDayOfWeek(
        monthEvents: CalendarEvent[],
        currentDate: Date,
    ) {
        const dayCount = [0, 0, 0, 0, 0, 0, 0];
        const monthName = format(currentDate, "MMMM");

        monthEvents.forEach((event) => {
            // Skip events with empty or missing start date
            if (!event.start || event.start.trim() === "") {
                return;
            }
            
            try {
                const dateStr = event.start;
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    return;
                }
                const day = date.getDay();
                dayCount[day]++;
            } catch (err) {
                // Silently skip invalid dates
                return;
            }
        });

        return dayCount;
    }

    function getEventsByTimeOfDay(
        monthEvents: CalendarEvent[],
        currentDate: Date,
    ) {
        const timeCount = {
            morning: 0, // 5-11
            afternoon: 0, // 12-16
            evening: 0, // 17-21
            night: 0, // 22-4
        };

        monthEvents.forEach((event) => {
            if (event.is_day_event) {
                timeCount.morning += 0.25;
                timeCount.afternoon += 0.25;
                timeCount.evening += 0.25;
                timeCount.night += 0.25;
                return;
            }

            const date = new Date(event.start);
            const hour = date.getHours();

            if (hour >= 5 && hour < 12) {
                timeCount.morning++;
            } else if (hour >= 12 && hour < 17) {
                timeCount.afternoon++;
            } else if (hour >= 17 && hour < 22) {
                timeCount.evening++;
            } else {
                timeCount.night++;
            }
        });

        return timeCount;
    }

    function getMostBusyDay(counts: number[]) {
        const max = Math.max(...counts);
        const index = counts.indexOf(max);
        const days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ];
        return { day: days[index], count: max };
    }

    function getEventsInMonth(events: CalendarEvent[], date: Date) {
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);

        return events.filter((event) => {
            // Skip events with empty or missing start date
            if (!event.start || event.start.trim() === "") {
                return false;
            }
            
            try {
                const eventDate = new Date(event.start);
                if (isNaN(eventDate.getTime())) {
                    return false;
                }
                return eventDate >= monthStart && eventDate <= monthEnd;
            } catch (err) {
                return false;
            }
        });
    }

    const maxDayCount = $derived(Math.max(...eventsByDayOfWeek));
    const maxTimeCount = $derived(
        Math.max(
            eventsByTimeOfDay.morning,
            eventsByTimeOfDay.afternoon,
            eventsByTimeOfDay.evening,
            eventsByTimeOfDay.night,
        ),
    );

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const barColors = [
        "bg-muted-foreground",
        "bg-primary",
        "bg-primary",
        "bg-primary",
        "bg-primary",
        "bg-primary",
        "bg-muted-foreground",
    ];

    function getBarHeight(value: number, max: number) {
        if (max === 0) return 0;
        return Math.max(3, (value / max) * 80);
    }
</script>

<Card class="border shadow-sm mt-4 calendar-analytics-card h-full flex flex-col">
    <CardHeader class="pb-2 flex-shrink-0">
        <CardTitle class="flex items-center text-lg">
            <Activity class="mr-2 h-4 w-4" />
            Monthly Calendar Analytics
        </CardTitle>
    </CardHeader>

    <CardContent class="flex-1 min-h-0 overflow-auto">
        {#if events.length > 0}
            <div class="space-y-6">
                <div class="grid grid-cols-2 gap-2">
                    <div class="border rounded-md p-3 text-center">
                        <div class="text-2xl font-bold">
                            {totalEventsThisMonth}
                        </div>
                        <div class="text-xs text-muted-foreground">
                            Events this month
                        </div>
                    </div>
                    <div class="border rounded-md p-3 text-center">
                        <div class="text-2xl font-bold">
                            {mostBusyDay.count}
                        </div>
                        <div class="text-xs text-muted-foreground">
                            Events on {mostBusyDay.day}s
                        </div>
                    </div>
                </div>

                <div>
                    <h3 class="text-sm font-medium mb-3">
                        {format(selectedDate, "MMMM")} Events by Day of Week
                    </h3>
                    <div class="h-32 flex items-end justify-between">
                        {#each eventsByDayOfWeek as count, i}
                            <div class="flex flex-col items-center w-10">
                                <div
                                    class="text-xs mb-1 font-medium text-muted-foreground"
                                >
                                    {count}
                                </div>
                                <div
                                    class="w-7 rounded-t hover:opacity-80 transition-opacity {barColors[
                                        i
                                    ]}"
                                    style="height: {getBarHeight(
                                        count,
                                        maxDayCount,
                                    )}px;"
                                    title="{count} events on {dayNames[i]}"
                                ></div>
                                <div class="text-xs mt-1 font-medium">
                                    {dayNames[i]}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>

                <div>
                    <h3 class="text-sm font-medium mb-3">
                        {format(selectedDate, "MMMM")} Events by Time of Day
                    </h3>
                    <div class="flex items-center space-x-2">
                        <div class="flex-1 space-y-2">
                            <div class="flex justify-between items-center">
                                <span class="text-xs">Morning</span>
                                <div
                                    class="w-full h-2 mx-2 bg-gray-100 rounded-full overflow-hidden"
                                >
                                    <div
                                        class="bg-yellow-400 h-full rounded-full"
                                        style="width: {(eventsByTimeOfDay.morning /
                                            maxTimeCount) *
                                            100}%"
                                    ></div>
                                </div>
                                <span class="text-xs font-medium w-6 text-right"
                                    >{Math.round(
                                        eventsByTimeOfDay.morning,
                                    )}</span
                                >
                            </div>

                            <div class="flex justify-between items-center">
                                <span class="text-xs">Afternoon</span>
                                <div
                                    class="w-full h-2 mx-2 bg-gray-100 rounded-full overflow-hidden"
                                >
                                    <div
                                        class="bg-orange-400 h-full rounded-full"
                                        style="width: {(eventsByTimeOfDay.afternoon /
                                            maxTimeCount) *
                                            100}%"
                                    ></div>
                                </div>
                                <span class="text-xs font-medium w-6 text-right"
                                    >{Math.round(
                                        eventsByTimeOfDay.afternoon,
                                    )}</span
                                >
                            </div>

                            <div class="flex justify-between items-center">
                                <span class="text-xs">Evening</span>
                                <div
                                    class="w-full h-2 mx-2 bg-gray-100 rounded-full overflow-hidden"
                                >
                                    <div
                                        class="bg-purple-400 h-full rounded-full"
                                        style="width: {(eventsByTimeOfDay.evening /
                                            maxTimeCount) *
                                            100}%"
                                    ></div>
                                </div>
                                <span class="text-xs font-medium w-6 text-right"
                                    >{Math.round(
                                        eventsByTimeOfDay.evening,
                                    )}</span
                                >
                            </div>

                            <div class="flex justify-between items-center">
                                <span class="text-xs">Night</span>
                                <div
                                    class="w-full h-2 mx-2 bg-gray-100 rounded-full overflow-hidden"
                                >
                                    <div
                                        class="bg-blue-400 h-full rounded-full"
                                        style="width: {(eventsByTimeOfDay.night /
                                            maxTimeCount) *
                                            100}%"
                                    ></div>
                                </div>
                                <span class="text-xs font-medium w-6 text-right"
                                    >{Math.round(eventsByTimeOfDay.night)}</span
                                >
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        {:else}
            <div class="py-8 text-center text-muted-foreground">
                <p>Not enough events to display analytics</p>
                <p class="text-xs mt-1">Add more events to see insights</p>
            </div>
        {/if}
    </CardContent>
</Card>

<style>
    .calendar-analytics-card {
        /* Card already has h-full flex flex-col from classes */
    }
    
    /* Custom scrollbar styles are now global in app.css */
</style>

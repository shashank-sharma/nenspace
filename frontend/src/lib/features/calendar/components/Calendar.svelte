<script lang="ts">
    import { onMount } from "svelte";
    import { calendarStore } from "../stores/calendar.store";
    import type { CalendarEvent, CalendarSync } from "../types";
    import MonthView from "./MonthView.svelte";
    import WeekView from "./WeekView.svelte";
    import DayView from "./DayView.svelte";
    import EventHoverCard from "./EventHoverCard.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Card } from "$lib/components/ui/card";
    import { Tabs, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { ChevronLeft, ChevronRight } from "lucide-svelte";
    import {
        format,
        addDays,
        addMonths,
        subMonths,
        addWeeks,
        subWeeks,
    } from "date-fns";

    // Optional props
    export let calendars: CalendarSync[] = [];
    export let showCalendarInfo: boolean = true;

    let selectedTab = "month";
    let isEventDialogOpen = false;
    let clickPosition = { x: 0, y: 0 };

    $: view = $calendarStore.view;
    $: selectedDate = $calendarStore.selectedDate;
    $: selectedEvent = $calendarStore.selectedEvent;
    $: hasCalendarSync =
        $calendarStore.calendars && $calendarStore.calendars.length > 0;

    onMount(() => {
        if (calendars && calendars.length > 0) {
            update$calendarStore(calendars);
        }

        if ($calendarStore.view) {
            selectedTab = $calendarStore.view;
        }
    });

    function update$calendarStore(calendars: CalendarSync[]) {
        if (calendars.length > 0) {
            calendarStore.fetchCalendars();
        }
    }

    function handleDateSelect(date: Date) {
        calendarStore.setSelectedDate(date);
    }

    function handleViewChange(event: CustomEvent<string>) {
        if (event.detail === "day") {
            calendarStore.setView("day");
        }
    }

    function handleEventClick(event: CalendarEvent, e?: MouseEvent) {
        if (e) {
            clickPosition = { x: e.clientX, y: e.clientY };
        } else {
            clickPosition = {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
            };
        }

        const eventDate = new Date(event.start);
        calendarStore.setSelectedDate(eventDate);

        calendarStore.setSelectedEvent(event);
        isEventDialogOpen = true;
    }

    function closeEventDialog() {
        isEventDialogOpen = false;
        setTimeout(() => {
            calendarStore.setSelectedEvent(null);
        }, 300);
    }

    function goToToday() {
        calendarStore.setSelectedDate(new Date());
    }

    function navigatePrevious() {
        const currentDate = $calendarStore.selectedDate;

        if ($calendarStore.view === "month") {
            calendarStore.setSelectedDate(subMonths(currentDate, 1));
        } else if ($calendarStore.view === "week") {
            calendarStore.setSelectedDate(subWeeks(currentDate, 1));
        } else {
            calendarStore.setSelectedDate(addDays(currentDate, -1));
        }
    }

    function navigateNext() {
        const currentDate = $calendarStore.selectedDate;

        if ($calendarStore.view === "month") {
            calendarStore.setSelectedDate(addMonths(currentDate, 1));
        } else if ($calendarStore.view === "week") {
            calendarStore.setSelectedDate(addWeeks(currentDate, 1));
        } else {
            calendarStore.setSelectedDate(addDays(currentDate, 1));
        }
    }

    function formatNavDate(date: Date, view: "month" | "week" | "day"): string {
        if (view === "month") {
            return format(date, "MMMM yyyy");
        } else if (view === "week") {
            return `Week of ${format(date, "MMM d, yyyy")}`;
        } else {
            return format(date, "EEEE, MMMM d, yyyy");
        }
    }
</script>

<svelte:window
    on:click={(e) => {
        clickPosition = { x: e.clientX, y: e.clientY };
    }}
/>

<div class="space-y-4">
    {#if hasCalendarSync}
        <Card class="border shadow-sm rounded-lg calendar-container">
            <div class="p-4">
                <div
                    class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4"
                >
                    <div class="flex flex-col">
                        <div class="text-xl font-semibold">
                            {formatNavDate(selectedDate, view)}
                        </div>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <div class="flex gap-1">
                            <Button
                                size="sm"
                                variant="outline"
                                on:click={goToToday}
                            >
                                Today
                            </Button>
                            <div class="flex">
                                <Button
                                    size="icon"
                                    class="h-9 w-9 rounded-r-none border-r"
                                    on:click={navigatePrevious}
                                >
                                    <ChevronLeft class="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    class="h-9 w-9 rounded-l-none"
                                    on:click={navigateNext}
                                >
                                    <ChevronRight class="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <Tabs value={view} class="w-[250px]">
                            <TabsList class="grid w-full grid-cols-3">
                                <TabsTrigger
                                    value="month"
                                    on:click={() =>
                                        calendarStore.setView("month")}
                                    >Month</TabsTrigger
                                >
                                <TabsTrigger
                                    value="week"
                                    on:click={() =>
                                        calendarStore.setView("week")}
                                    >Week</TabsTrigger
                                >
                                <TabsTrigger
                                    value="day"
                                    on:click={() =>
                                        calendarStore.setView("day")}
                                    >Day</TabsTrigger
                                >
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                {#if view === "month"}
                    <MonthView
                        events={$calendarStore.events}
                        {selectedDate}
                        onDateSelect={handleDateSelect}
                        onEventClick={handleEventClick}
                        on:changeView={handleViewChange}
                    />
                {:else if view === "week"}
                    <WeekView
                        events={$calendarStore.events}
                        {selectedDate}
                        onDateSelect={handleDateSelect}
                        onEventClick={handleEventClick}
                    />
                {:else}
                    <DayView
                        events={$calendarStore.events}
                        {selectedDate}
                        onDateSelect={handleDateSelect}
                        onEventClick={handleEventClick}
                    />
                {/if}
            </div>
        </Card>
    {/if}
</div>

<EventHoverCard
    isOpen={isEventDialogOpen}
    event={selectedEvent}
    onClose={closeEventDialog}
    position={clickPosition}
/>

<style>
    :global([data-calendar-theme="minimal"]) .calendar-container {
        background-color: hsl(var(--background) / 95%);
        border-color: hsl(var(--border) / 40%);
        box-shadow: none;
    }

    :global([data-calendar-theme="gradient"]) .calendar-container {
        background: linear-gradient(
            to bottom right,
            hsl(var(--background)),
            hsl(var(--muted) / 30%)
        );
        border-color: hsl(var(--border) / 20%);
    }

    :global([data-calendar-theme="dark"]) .calendar-container {
        background-color: hsl(var(--muted) / 95%);
        border-color: hsl(var(--border));
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
</style>

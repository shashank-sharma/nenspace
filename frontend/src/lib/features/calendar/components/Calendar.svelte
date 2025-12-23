<script lang="ts">
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
    import type { CalendarEvent, CalendarView } from "../types";
    import { createEventDispatcher } from "svelte";

    let {
        events = [],
        view = $bindable("month"),
        selectedDate = $bindable(new Date()),
    } = $props<{
        events?: CalendarEvent[];
        view?: CalendarView;
        selectedDate?: Date;
    }>();

    const dispatch = createEventDispatcher();

    let selectedEvent = $state<CalendarEvent | null>(null);
    let isEventDialogOpen = $state(false);
    let clickPosition = $state({ x: 0, y: 0 });

    $effect(() => {
        if (selectedEvent) {
            isEventDialogOpen = true;
        } else {
            isEventDialogOpen = false;
        }
    });

    function handleEventClick(event: CustomEvent<{ event: CalendarEvent }>) {
        selectedEvent = event.detail.event;
        dispatch("eventClick", event.detail);
    }

    function closeEventDialog() {
        selectedEvent = null;
    }
</script>

<svelte:window
    on:click={(e) => {
        clickPosition = { x: e.clientX, y: e.clientY };
    }}
/>

<div class="calendar-root h-full flex flex-col">
    {#if events.length > 0}
        <Card class="border shadow-sm rounded-lg calendar-container h-full flex flex-col">
            <div class="flex-1 min-h-0 overflow-auto calendar-scroll-area p-4">
                {#if view === "month"}
                    <MonthView
                        {events}
                        {selectedDate}
                        on:selectDate={(e) => (selectedDate = e.detail)}
                        on:eventClick={handleEventClick}
                    />
                {:else if view === "week"}
                    <WeekView
                        {events}
                        {selectedDate}
                        on:selectDate={(e) => (selectedDate = e.detail)}
                        on:eventClick={handleEventClick}
                    />
                {:else}
                    <DayView
                        {events}
                        {selectedDate}
                        on:selectDate={(e) => (selectedDate = e.detail)}
                        on:eventClick={handleEventClick}
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
    /* Custom scrollbar styles are now global in app.css */
</style>

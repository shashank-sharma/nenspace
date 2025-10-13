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
        dispatch("eventClick", event.detail);
    }

    function closeEventDialog() {
        setTimeout(() => {
            selectedEvent = null;
        }, 300);
    }

    function goToToday() {
        selectedDate = new Date();
    }

    function navigatePrevious() {
        if (view === "month") {
            selectedDate = subMonths(selectedDate, 1);
        } else if (view === "week") {
            selectedDate = subWeeks(selectedDate, 1);
        } else {
            selectedDate = addDays(selectedDate, -1);
        }
    }

    function navigateNext() {
        if (view === "month") {
            selectedDate = addMonths(selectedDate, 1);
        } else if (view === "week") {
            selectedDate = addWeeks(selectedDate, 1);
        } else {
            selectedDate = addDays(selectedDate, 1);
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
    {#if events.length > 0}
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
                        <Tabs {view} class="w-[250px]">
                            <TabsList class="grid w-full grid-cols-3">
                                <TabsTrigger
                                    value="month"
                                    on:click={() => (view = "month")}
                                    >Month</TabsTrigger
                                >
                                <TabsTrigger
                                    value="week"
                                    on:click={() => (view = "week")}
                                    >Week</TabsTrigger
                                >
                                <TabsTrigger
                                    value="day"
                                    on:click={() => (view = "day")}
                                    >Day</TabsTrigger
                                >
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

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
    /* These styles were probably intended for a theme switcher that is not implemented here. */
    /* Removing them as they are marked as unused by the linter. */
</style>

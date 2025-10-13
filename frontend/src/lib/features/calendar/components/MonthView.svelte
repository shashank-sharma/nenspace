<script lang="ts">
    import type { CalendarEvent } from "../types";
    import { getMonthDays, isSameDay, isToday } from "../utils/date";
    import SimpleEventCard from "./SimpleEventCard.svelte";
    import { createEventDispatcher } from "svelte";

    let { events = [], selectedDate } = $props<{
        events?: CalendarEvent[];
        selectedDate: Date;
    }>();

    const dispatch = createEventDispatcher<{
        selectDate: Date;
        eventClick: { event: CalendarEvent; e?: MouseEvent };
        changeView: "day";
    }>();

    const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    let monthDays = $derived(getMonthDays(selectedDate));
    let currentMonth = $derived(selectedDate.getMonth());
    let currentYear = $derived(selectedDate.getFullYear());

    function handleDateClick(date: Date) {
        dispatch("selectDate", date);
    }

    function handleDblClick(date: Date) {
        dispatch("selectDate", date);
        dispatch("changeView", "day");
    }

    function getEventsForDate(date: Date): CalendarEvent[] {
        return events.filter((event: CalendarEvent) => {
            const eventStartDate = new Date(event.start);
            return isSameDay(eventStartDate, date);
        });
    }
</script>

<div class="w-full">
    <div class="grid grid-cols-7 gap-1 mb-1 text-center">
        {#each DAYS_OF_WEEK as day}
            <div class="font-medium text-sm py-2">{day}</div>
        {/each}
    </div>

    <div class="grid grid-cols-7 gap-1">
        {#each monthDays as day}
            {@const isCurrentMonth = day.getMonth() === currentMonth}
            {@const isSelected = isSameDay(day, selectedDate)}
            {@const dayEvents = getEventsForDate(day)}

            <button
                class="aspect-square p-1 border rounded-lg transition-all duration-200 ease-in-out text-left align-top
                       {isCurrentMonth ? 'bg-card' : 'bg-muted/30 opacity-50'}
                       {isSelected ? 'ring-2 ring-primary' : ''}
                       {isToday(day) ? 'border-primary' : 'border-border'}"
                onclick={() => handleDateClick(day)}
                ondblclick={() => handleDblClick(day)}
            >
                <div class="flex justify-between items-start">
                    <span
                        class="inline-flex items-center justify-center h-6 w-6 rounded-full text-sm
                               {isToday(day)
                            ? 'bg-primary text-primary-foreground font-medium'
                            : ''}"
                    >
                        {day.getDate()}
                    </span>
                </div>

                <div class="mt-1 space-y-1 overflow-hidden max-h-28">
                    {#each dayEvents.slice(0, 3) as event (event.id)}
                        <div
                            class="cursor-pointer w-full"
                            role="button"
                            tabindex="0"
                            onclick={(e) => {
                                e.stopPropagation();
                                dispatch("eventClick", { event, e });
                            }}
                            onkeydown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    dispatch("eventClick", { event });
                                }
                            }}
                        >
                            <SimpleEventCard {event} compact={true} />
                        </div>
                    {/each}

                    {#if dayEvents.length > 3}
                        <div
                            class="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
                        >
                            +{dayEvents.length - 3} more
                        </div>
                    {/if}
                </div>
            </button>
        {/each}
    </div>
</div>

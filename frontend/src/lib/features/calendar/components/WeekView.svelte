<script lang="ts">
    import type { CalendarEvent } from "../types";
    import {
        getWeekDays,
        isSameDay,
        isToday,
        formatDateReadable,
    } from "../utils/date";
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

    const DAYS_OF_WEEK = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];
    const HOURS = Array.from({ length: 24 }, (_, i) => i);

    let weekDays = $derived(getWeekDays(selectedDate));

    function getEventsForDate(date: Date): CalendarEvent[] {
        return events.filter((event: CalendarEvent) => {
            const eventStartDate = new Date(event.start);
            return isSameDay(eventStartDate, date);
        });
    }

    function getAllDayEventsForDate(date: Date): CalendarEvent[] {
        return getEventsForDate(date).filter(
            (event) => event.is_day_event || event.is_all_day,
        );
    }

    function getEventsByHour(date: Date, hour: number): CalendarEvent[] {
        return getEventsForDate(date).filter((event) => {
            if (event.is_day_event || event.is_all_day) return false;

            const eventStart = new Date(event.start);
            return eventStart.getHours() === hour;
        });
    }

    function handleDblClick(day: Date) {
        dispatch("selectDate", day);
        dispatch("changeView", "day");
    }

    function navigateWeek(direction: "prev" | "next") {
        const newDate = new Date(selectedDate);
        const daysToAdd = direction === "prev" ? -7 : 7;
        newDate.setDate(newDate.getDate() + daysToAdd);
        dispatch("selectDate", newDate);
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "ArrowLeft") {
            const prevDay = new Date(selectedDate);
            prevDay.setDate(prevDay.getDate() - 1);
            dispatch("selectDate", prevDay);
        } else if (event.key === "ArrowRight") {
            const nextDay = new Date(selectedDate);
            nextDay.setDate(nextDay.getDate() + 1);
            dispatch("selectDate", nextDay);
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="w-full">
    <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">
            Week of {formatDateReadable(weekDays[0])}
        </h2>

        <div class="flex gap-2">
            <button
                class="p-2 rounded-full hover:bg-muted transition-colors"
                onclick={() => navigateWeek("prev")}
                aria-label="Previous week"
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
                    stroke-linejoin="round"
                >
                    <path d="m15 18-6-6 6-6" />
                </svg>
            </button>

            <button
                class="p-2 rounded-full hover:bg-muted transition-colors"
                onclick={() => {
                    dispatch("selectDate", new Date());
                }}
            >
                Today
            </button>

            <button
                class="p-2 rounded-full hover:bg-muted transition-colors"
                onclick={() => navigateWeek("next")}
                aria-label="Next week"
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
                    stroke-linejoin="round"
                >
                    <path d="m9 18 6-6-6-6" />
                </svg>
            </button>
        </div>
    </div>

    <div class="grid grid-cols-[40px_1fr] gap-0">
        <div class="h-16"></div>

        <div class="grid grid-cols-7 gap-x-[1px]">
            {#each weekDays as day, index}
                {@const isSelectedDay = isSameDay(day, selectedDate)}
                <button
                    class="text-center py-2 px-1 cursor-pointer rounded-t-md transition-colors hover:bg-muted/30
                        {isSelectedDay ? 'bg-primary/10' : ''}
                        {isToday(day)
                        ? 'border-b-2 border-primary'
                        : 'border-b border-muted/50'}"
                    onclick={() => dispatch("selectDate", day)}
                    ondblclick={() => handleDblClick(day)}
                >
                    <div class="font-medium text-xs md:text-sm">
                        {DAYS_OF_WEEK[day.getDay()].substring(0, 3)}
                    </div>
                    <div
                        class="inline-flex items-center justify-center h-7 w-7 rounded-full text-sm mt-1
                            {isToday(day)
                            ? 'bg-primary text-primary-foreground'
                            : ''}
                            {isSelectedDay && !isToday(day)
                            ? 'bg-primary/10 font-medium'
                            : ''}"
                    >
                        {day.getDate()}
                    </div>
                </button>
            {/each}
        </div>

        <div
            class="text-xs text-right pr-2 py-2 border-b border-muted/30 font-medium"
        >
            All day
        </div>

        <div class="grid grid-cols-7 gap-x-[1px] border-b border-muted/30">
            {#each weekDays as day, index}
                {@const allDayEvents = getAllDayEventsForDate(day)}
                {@const isSelectedDay = isSameDay(day, selectedDate)}
                <div
                    class="min-h-[40px] p-1 {isSelectedDay
                        ? 'bg-primary/5'
                        : ''} {index < 6 ? 'border-r border-muted/20' : ''}"
                >
                    {#if allDayEvents.length > 0}
                        <div class="space-y-1">
                            {#each allDayEvents as event (event.id)}
                                <button
                                    class="cursor-pointer w-full"
                                    onclick={(e) =>
                                        dispatch("eventClick", { event, e })}
                                >
                                    <SimpleEventCard
                                        {event}
                                        compact={true}
                                        maxWidth="100%"
                                    />
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>

        {#each HOURS as hour (hour)}
            <div
                class="text-xs text-right pr-2 pt-2 border-b border-muted/30 h-[60px]"
            >
                {hour.toString().padStart(2, "0")}:00
            </div>

            <div class="grid grid-cols-7 gap-x-[1px] border-b border-muted/30">
                {#each weekDays as day, index (day.getTime() + hour)}
                    {@const hourEvents = getEventsByHour(day, hour)}
                    {@const isCurrentHour =
                        isToday(day) && new Date().getHours() === hour}
                    {@const isSelectedDay = isSameDay(day, selectedDate)}

                    <div
                        class="min-h-[60px] p-1 relative
                            {isCurrentHour ? 'bg-primary/5' : ''}
                            {isSelectedDay ? 'bg-primary/5' : ''}
                            {index < 6 ? 'border-r border-muted/20' : ''}"
                    >
                        {#if hourEvents.length > 0}
                            <div class="space-y-1 z-10 relative">
                                {#each hourEvents as event (event.id)}
                                    <button
                                        class="cursor-pointer w-full"
                                        onclick={(e) =>
                                            dispatch("eventClick", {
                                                event,
                                                e,
                                            })}
                                    >
                                        <SimpleEventCard
                                            {event}
                                            compact={true}
                                            maxWidth="100%"
                                        />
                                    </button>
                                {/each}
                            </div>
                        {/if}

                        {#if isCurrentHour && isToday(day)}
                            {@const now = new Date()}
                            {@const minutePercentage =
                                (now.getMinutes() / 60) * 100}
                            <div
                                class="absolute left-0 right-0 border-t border-primary z-10"
                                style="top: {minutePercentage}%"
                            >
                                <div
                                    class="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-primary shadow-sm"
                                ></div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</div>

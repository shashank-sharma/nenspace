<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { ChevronLeft, ChevronRight } from "lucide-svelte";
    import {
        format,
        startOfMonth,
        endOfMonth,
        startOfWeek,
        endOfWeek,
        eachDayOfInterval,
        isSameMonth,
        isSameDay,
        isToday,
        addMonths,
        subMonths,
    } from "date-fns";
    import { cn } from "$lib/utils";
    import type { CalendarEvent } from "../types";

    let {
        selectedDate = $bindable(new Date()),
        events = [],
    } = $props<{
        selectedDate?: Date;
        events?: CalendarEvent[];
    }>();

    let currentMonth = $state(new Date(selectedDate));

    // Update current month when selectedDate changes significantly
    $effect(() => {
        if (
            selectedDate.getMonth() !== currentMonth.getMonth() ||
            selectedDate.getFullYear() !== currentMonth.getFullYear()
        ) {
            currentMonth = new Date(selectedDate);
        }
    });

    const monthStart = $derived(startOfMonth(currentMonth));
    const monthEnd = $derived(endOfMonth(currentMonth));
    const calendarStart = $derived(startOfWeek(monthStart, { weekStartsOn: 0 }));
    const calendarEnd = $derived(endOfWeek(monthEnd, { weekStartsOn: 0 }));
    const days = $derived(eachDayOfInterval({ start: calendarStart, end: calendarEnd }));

    const monthYear = $derived(format(currentMonth, "MMMM yyyy"));
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function handleDayClick(day: Date) {
        selectedDate = new Date(day);
    }

    function navigateMonth(direction: "prev" | "next") {
        currentMonth = direction === "prev" ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1);
    }

    function goToToday() {
        const today = new Date();
        selectedDate = today;
        currentMonth = new Date(today);
    }

    function hasEventOnDay(day: Date): boolean {
        return events.some((event) => {
            const eventDate = new Date(event.start);
            return isSameDay(eventDate, day);
        });
    }

    function getEventCountForDay(day: Date): number {
        return events.filter((event) => {
            const eventDate = new Date(event.start);
            return isSameDay(eventDate, day);
        }).length;
    }
</script>

<Card class="mini-calendar-card">
    <CardHeader class="pb-3">
        <div class="flex items-center justify-between">
            <CardTitle class="text-base font-semibold">{monthYear}</CardTitle>
            <div class="flex items-center gap-1">
                <Button
                    size="icon"
                    variant="ghost"
                    class="h-7 w-7"
                    on:click={() => navigateMonth("prev")}
                >
                    <ChevronLeft class="h-4 w-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    class="h-7 w-7"
                    on:click={() => navigateMonth("next")}
                >
                    <ChevronRight class="h-4 w-4" />
                </Button>
            </div>
        </div>
        <Button
            size="sm"
            variant="outline"
            class="w-full mt-2 h-7 text-xs"
            on:click={goToToday}
        >
            Today
        </Button>
    </CardHeader>
    <CardContent class="pt-0">
        <!-- Week day headers -->
        <div class="grid grid-cols-7 gap-1 mb-1">
            {#each weekDays as day}
                <div class="text-center text-xs font-medium text-muted-foreground py-1">
                    {day}
                </div>
            {/each}
        </div>

        <!-- Calendar days grid -->
        <div class="grid grid-cols-7 gap-1">
            {#each days as day}
                {@const isCurrentMonth = isSameMonth(day, currentMonth)}
                {@const isSelected = isSameDay(day, selectedDate)}
                {@const isTodayDate = isToday(day)}
                {@const hasEvents = hasEventOnDay(day)}
                {@const eventCount = getEventCountForDay(day)}
                
                <button
                    type="button"
                    class={cn(
                        "relative h-8 w-full rounded-md text-xs transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                        !isCurrentMonth && "text-muted-foreground/50",
                        isSelected && "bg-primary text-primary-foreground font-semibold",
                        !isSelected && isTodayDate && "bg-accent font-semibold",
                        !isSelected && !isTodayDate && isCurrentMonth && "text-foreground"
                    )}
                    on:click={() => handleDayClick(day)}
                >
                    <span class="relative z-10">{format(day, "d")}</span>
                    {#if hasEvents && !isSelected}
                        <span
                            class={cn(
                                "absolute bottom-0.5 left-1/2 -translate-x-1/2",
                                "h-1 w-1 rounded-full",
                                isCurrentMonth ? "bg-primary" : "bg-muted-foreground/50"
                            )}
                        ></span>
                    {/if}
                </button>
            {/each}
        </div>
    </CardContent>
</Card>

<style>
    .mini-calendar-card {
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }
</style>


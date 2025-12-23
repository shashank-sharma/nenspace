<script lang="ts">
    import { getMonthYear, getWeekNumber, isFirstDayOfWeek, isToday } from '../utils/date.utils';
    import { getDatesInMonth } from '../utils/date.utils';
    import DateMarker from './DateMarker.svelte';
    import type { EntryDensity } from '../types';
    import { cn } from '$lib/utils';

    let { 
        year, 
        month, 
        entryDensity = new Map(),
        onDateClick,
        onDotClick,
        highlightedDates = new Set()
    } = $props<{
        year: number;
        month: number;
        entryDensity?: Map<string, number>;
        onDateClick?: (date: Date) => void;
        onDotClick?: (dateKey: string) => void;
        highlightedDates?: Set<string>;
    }>();

    const dates = getDatesInMonth(year, month);
    const monthYear = getMonthYear(new Date(year, month, 1));
    
    // Group dates by week for week number display
    const weeks: Array<{ weekNumber: number; dates: Date[] }> = [];
    let currentWeek: Date[] = [];
    let currentWeekNumber: number | null = null;

    dates.forEach((date, index) => {
        const weekNumber = getWeekNumber(date);
        const isFirstDay = isFirstDayOfWeek(date) || index === 0;
        
        if (isFirstDay && currentWeek.length > 0) {
            weeks.push({ weekNumber: currentWeekNumber!, dates: [...currentWeek] });
            currentWeek = [];
        }
        
        if (currentWeekNumber === null || isFirstDay) {
            currentWeekNumber = weekNumber;
        }
        
        currentWeek.push(date);
    });
    
    if (currentWeek.length > 0) {
        weeks.push({ weekNumber: currentWeekNumber!, dates: [...currentWeek] });
    }
</script>

<div class="mb-6 relative">
    <h3 class="text-xs font-semibold text-muted-foreground mb-3 px-2">
        {monthYear}
    </h3>
    <div class="flex flex-col">
        {#each weeks as { weekNumber, dates: weekDates }}
            <div class="flex flex-col">
                {#each weekDates as date}
                    {@const dateKey = date.toISOString().split('T')[0]}
                    {@const count = entryDensity.get(dateKey) || 0}
                    {@const isHighlighted = highlightedDates.has(dateKey)}
                    {@const isCurrentDate = isToday(date)}
                    <div class="flex items-center relative w-full min-h-[32px] mb-0.5">
                        <!-- Week number on left (only show for first day of week) -->
                        {#if isFirstDayOfWeek(date) || date === weekDates[0]}
                            <div class="absolute left-0 text-[10px] text-muted-foreground/60 w-8 z-20">
                                W{weekNumber}
                            </div>
                        {/if}
                        
                        <!-- Entry count circles (positioned on left side) -->
                        {#if count > 0}
                            <div 
                                class="absolute left-8 z-10 top-1/2 -translate-y-1/2 flex gap-0.5 items-center cursor-pointer hover:opacity-100 transition-opacity"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    onDotClick?.(dateKey);
                                }}
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onDotClick?.(dateKey);
                                    }
                                }}
                                title="Click to highlight entries"
                            >
                                {#each Array(Math.min(count, 5)) as _}
                                    <div class={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        isCurrentDate ? "bg-primary" : "bg-muted-foreground/70"
                                    )}></div>
                                {/each}
                                {#if count > 5}
                                    <span class={cn(
                                        "text-[9px] ml-0.5",
                                        isCurrentDate ? "text-primary" : "text-muted-foreground/70"
                                    )}>+{count - 5}</span>
                                {/if}
                            </div>
                        {/if}
                        
                        <!-- Horizontal line indicator (right side of circles, before date text) -->
                        <div class={cn(
                            "absolute h-0.5 top-1/2 -translate-y-1/2 z-0",
                            count > 0 ? "left-[60px] right-[80px]" : "left-8 right-[80px]",
                            isCurrentDate ? "bg-primary" : "bg-border/30"
                        )}></div>
                        
                        <!-- Date marker (absolutely positioned at rightmost edge) -->
                        <div class="absolute right-0 z-10 top-1/2 -translate-y-1/2">
                            <DateMarker
                                date={date}
                                entryCount={0}
                                isHighlighted={isHighlighted}
                                onClick={() => onDateClick?.(date)}
                                onDotClick={() => onDotClick?.(dateKey)}
                            />
                        </div>
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</div>


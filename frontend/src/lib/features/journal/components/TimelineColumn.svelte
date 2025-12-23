<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { JournalStorageService } from '../services/journal-storage.service';
    import TimelineAxis from './TimelineAxis.svelte';
    import { JournalSyncService } from '../services/journal-sync.service.svelte';
    import { getMonthYear, getStartOfDay } from '../utils/date.utils';
    import type { LocalStreamEntry } from '../types';
    import { Card, CardContent } from '$lib/components/ui/card';
    import { ChevronUp, ChevronDown } from 'lucide-svelte';

    let { selectedDate, onDateSelect } = $props<{
        selectedDate?: Date | null;
        onDateSelect?: (date: Date) => void;
    }>();

    let totalEntries = $state(0);
    let entryDensity = $state(new Map<string, number>());
    let highlightedDates = $state(new Set<string>());
    let monthsToShow = $state<Array<{ year: number; month: number }>>([]);
    
    // Scroll indicators
    let scrollContainer: HTMLDivElement | null = null;
    let showTopFade = $state(false);
    let showBottomFade = $state(false);
    let canScroll = $state(false);
    let resizeObserver: ResizeObserver | null = null;

    async function loadEntryDensity() {
        try {
            const allEntries = await JournalStorageService.getAllEntries();
            totalEntries = allEntries.length;

            // Calculate density
            const density = new Map<string, number>();
            allEntries.forEach(entry => {
                const dateKey = getStartOfDay(entry.entry_date);
                density.set(dateKey, (density.get(dateKey) || 0) + 1);
            });
            entryDensity = density;

            // Get highlighted dates
            const highlighted = allEntries
                .filter(e => e.is_highlighted)
                .map(e => getStartOfDay(e.entry_date));
            highlightedDates = new Set(highlighted);

            // Generate months to show (last 12 months)
            const months: Array<{ year: number; month: number }> = [];
            const now = new Date();
            for (let i = 0; i < 12; i++) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push({ year: date.getFullYear(), month: date.getMonth() });
            }
            monthsToShow = months;
            
            // Check scrollability after data loads
            if (browser) {
                setTimeout(() => checkScrollability(), 50);
            }
        } catch (error) {
            console.error('Failed to load entry density:', error);
        }
    }

    function handleDateClick(date: Date) {
        onDateSelect?.(date);
    }

    async function handleDotClick(dateKey: string) {
        try {
            const entries = await JournalStorageService.getEntriesByDate(dateKey);
            for (const entry of entries) {
                const updated = { ...entry, is_highlighted: !entry.is_highlighted };
                await JournalStorageService.saveEntry(updated);
                await JournalSyncService.queueEntry(updated);
            }
            await loadEntryDensity();
        } catch (error) {
            console.error('Failed to toggle highlight:', error);
        }
    }

    function checkScrollability() {
        if (!scrollContainer || !browser) return;
        
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const hasScroll = scrollHeight > clientHeight;
        canScroll = hasScroll;
        
        // Show top fade/arrow if scrollable (always visible when scrollable)
        showTopFade = hasScroll;
        
        // Show bottom fade/arrow if scrollable (always visible when scrollable)
        showBottomFade = hasScroll;
    }

    function handleScroll() {
        checkScrollability();
    }

    onMount(async () => {
        await loadEntryDensity();
        
        // Wait for DOM to update after loading
        if (browser) {
            setTimeout(() => {
                if (scrollContainer) {
                    checkScrollability();
                    scrollContainer.addEventListener('scroll', handleScroll);
                    
                    // Check on resize
                    resizeObserver = new ResizeObserver(() => {
                        checkScrollability();
                    });
                    resizeObserver.observe(scrollContainer);
                }
            }, 100);
        }
    });

    onDestroy(() => {
        if (scrollContainer) {
            scrollContainer.removeEventListener('scroll', handleScroll);
        }
        if (resizeObserver) {
            resizeObserver.disconnect();
        }
    });
</script>

<div class="h-full p-4">
    <Card class="h-full flex flex-col shadow-lg">
        <!-- No header needed - entry count moved to main content -->
        <CardContent class="flex-1 p-0 relative overflow-hidden">
            <div 
                class="h-full overflow-y-auto timeline-scrollbar relative" 
                bind:this={scrollContainer} 
                onscroll={handleScroll}
            >
                <!-- Top gradient fade and sticky arrow - no gap -->
                {#if showTopFade}
                    <div class="sticky top-0 left-0 right-0 h-12 bg-gradient-to-b from-card via-card/80 to-transparent pointer-events-none z-20 flex items-center justify-center">
                        <ChevronUp class="h-4 w-4 text-muted-foreground/70" />
                    </div>
                {/if}
                
                <!-- Timeline -->
                <div class="relative pr-0 w-full px-4">
                    <!-- Month axes -->
                    <div class="relative z-10 w-full">
                        {#each monthsToShow as { year, month }}
                            <TimelineAxis
                                {year}
                                {month}
                                {entryDensity}
                                highlightedDates={highlightedDates}
                                onDateClick={handleDateClick}
                                onDotClick={handleDotClick}
                            />
                        {/each}
                    </div>
                </div>
                
                <!-- Bottom gradient fade and sticky arrow - no gap -->
                {#if showBottomFade}
                    <div class="sticky bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none z-20 flex items-center justify-center">
                        <ChevronDown class="h-4 w-4 text-muted-foreground/70" />
                    </div>
                {/if}
            </div>
        </CardContent>
    </Card>
</div>

<style>
    /* Hide scrollbar but keep scrolling functionality */
    .timeline-scrollbar {
        scrollbar-width: none; /* Firefox - hide scrollbar */
        -ms-overflow-style: none; /* IE and Edge - hide scrollbar */
    }

    .timeline-scrollbar::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera - hide scrollbar */
    }
</style>

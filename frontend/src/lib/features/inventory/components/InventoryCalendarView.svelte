<script lang="ts">
    import { onMount } from 'svelte';
    import { InventoryService } from '../services';
    import type { InventoryItem } from '../types';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { ChevronLeft, ChevronRight } from 'lucide-svelte';
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
    } from 'date-fns';
    import { cn } from '$lib/utils';
    import { getItemTypeConfig, ITEM_TYPE_COLORS } from '../constants';
    import { Badge } from '$lib/components/ui/badge';
    import * as Dialog from '$lib/components/ui/dialog';

    let currentMonth = $state(new Date());
    let selectedDate = $state<Date | null>(null);
    let items = $state<InventoryItem[]>([]);
    let isLoading = $state(true);
    let showDateDialog = $state(false);

    const monthStart = $derived(startOfMonth(currentMonth));
    const monthEnd = $derived(endOfMonth(currentMonth));
    const calendarStart = $derived(startOfWeek(monthStart, { weekStartsOn: 0 }));
    const calendarEnd = $derived(endOfWeek(monthEnd, { weekStartsOn: 0 }));
    const days = $derived(eachDayOfInterval({ start: calendarStart, end: calendarEnd }));

    const monthYear = $derived(format(currentMonth, 'MMMM yyyy'));
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let isInitialLoad = $state(true);
    let lastLoadedMonth = $state<string | null>(null);

    async function loadItems() {
        // Prevent multiple simultaneous loads
        if (isLoading) return;
        
        const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
        if (lastLoadedMonth === monthKey && !isInitialLoad) {
            return;
        }

        isLoading = true;
        try {
            const startDate = calendarStart.toISOString().split('T')[0];
            const endDate = calendarEnd.toISOString().split('T')[0];
            
            const [expiringItems, subscriptions, warranties] = await Promise.all([
                InventoryService.getItemsByDateRange(startDate, endDate, 'expiration_date'),
                InventoryService.getItemsByDateRange(startDate, endDate, 'subscription_end'),
                InventoryService.getItemsByDateRange(startDate, endDate, 'warranty_expiry'),
            ]);

            items = [...expiringItems, ...subscriptions, ...warranties];
            lastLoadedMonth = monthKey;
            isInitialLoad = false;
        } catch (error) {
            console.error('Error loading calendar items:', error);
        } finally {
            isLoading = false;
        }
    }

    function getItemsForDate(date: Date): InventoryItem[] {
        return items.filter(item => {
            let itemDate: Date | null = null;
            
            if (item.expiration_date) {
                itemDate = new Date(item.expiration_date);
            } else if (item.subscription_end) {
                itemDate = new Date(item.subscription_end);
            } else if (item.warranty_expiry) {
                itemDate = new Date(item.warranty_expiry);
            }
            
            return itemDate && isSameDay(itemDate, date);
        });
    }

    function getItemTypeForDate(date: Date): string[] {
        const itemsForDate = getItemsForDate(date);
        return [...new Set(itemsForDate.map(item => item.item_type || 'generic'))];
    }

    function handleDayClick(day: Date) {
        const itemsForDay = getItemsForDate(day);
        if (itemsForDay.length > 0) {
            selectedDate = day;
            showDateDialog = true;
        }
    }

    function navigateMonth(direction: 'prev' | 'next') {
        currentMonth = direction === 'prev' ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1);
    }

    function goToToday() {
        const today = new Date();
        currentMonth = new Date(today);
    }

    const itemsForSelectedDate = $derived(selectedDate ? getItemsForDate(selectedDate) : []);

    // Only reload when the month changes
    $effect(() => {
        // Track currentMonth to trigger reload when it changes
        const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
        if (lastLoadedMonth !== monthKey || isInitialLoad) {
            loadItems();
        }
    });
</script>

<Card>
    <CardHeader>
        <div class="flex items-center justify-between">
            <CardTitle>{monthYear}</CardTitle>
            <div class="flex items-center gap-2">
                <Button size="sm" variant="outline" on:click={goToToday}>
                    Today
                </Button>
                <div class="flex items-center gap-1">
                    <Button
                        size="icon"
                        variant="ghost"
                        class="h-8 w-8"
                        on:click={() => navigateMonth('prev')}
                    >
                        <ChevronLeft class="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        class="h-8 w-8"
                        on:click={() => navigateMonth('next')}
                    >
                        <ChevronRight class="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    </CardHeader>
    <CardContent>
        <!-- Week day headers -->
        <div class="grid grid-cols-7 gap-1 mb-1">
            {#each weekDays as day}
                <div class="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                </div>
            {/each}
        </div>

        <!-- Calendar days grid -->
        <div class="grid grid-cols-7 gap-1">
            {#each days as day}
                {@const isCurrentMonth = isSameMonth(day, currentMonth)}
                {@const isTodayDate = isToday(day)}
                {@const itemsForDay = getItemsForDate(day)}
                {@const itemTypes = getItemTypeForDate(day)}
                {@const hasItems = itemsForDay.length > 0}

                <button
                    type="button"
                    class={cn(
                        'relative h-20 w-full rounded-md text-xs transition-colors p-1 text-left',
                        'hover:bg-accent hover:text-accent-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                        !isCurrentMonth && 'text-muted-foreground/50',
                        isTodayDate && 'border-2 border-primary',
                        hasItems && 'bg-accent/50'
                    )}
                    on:click={() => handleDayClick(day)}
                >
                    <div class="flex flex-col h-full">
                        <span class={cn(
                            'font-medium mb-1',
                            isTodayDate && 'text-primary font-bold'
                        )}>
                            {format(day, 'd')}
                        </span>
                        {#if hasItems}
                            <div class="flex flex-wrap gap-0.5 flex-1 overflow-hidden">
                                {#each itemTypes.slice(0, 3) as type}
                                    {@const typeConfig = getItemTypeConfig(type as any)}
                                    <div
                                        class={cn(
                                            'h-1.5 w-full rounded',
                                            ITEM_TYPE_COLORS[type as any].split(' ')[0]
                                        )}
                                        title={typeConfig.label}
                                    ></div>
                                {/each}
                                {#if itemsForDay.length > 3}
                                    <span class="text-[10px] text-muted-foreground">
                                        +{itemsForDay.length - 3}
                                    </span>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </button>
            {/each}
        </div>

        <!-- Legend -->
        <div class="mt-4 pt-4 border-t flex flex-wrap gap-2 text-xs">
            <span class="text-muted-foreground">Legend:</span>
            {#each ['physical_purchase', 'subscription', 'software_license', 'warranty_item'] as type}
                {@const typeConfig = getItemTypeConfig(type as any)}
                <div class="flex items-center gap-1">
                    <div class={cn('h-3 w-3 rounded', ITEM_TYPE_COLORS[type as any].split(' ')[0])}></div>
                    <span>{typeConfig.label}</span>
                </div>
            {/each}
        </div>
    </CardContent>
</Card>

<Dialog.Root bind:open={showDateDialog}>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Items'}
            </Dialog.Title>
        </Dialog.Header>
        <div class="space-y-2 max-h-[400px] overflow-y-auto">
            {#each itemsForSelectedDate as item}
                <div class="p-3 border rounded-md">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1">
                            <p class="font-medium">{item.name}</p>
                            {#if item.item_type}
                                {@const typeConfig = getItemTypeConfig(item.item_type)}
                                <Badge class={ITEM_TYPE_COLORS[item.item_type]} variant="outline">
                                    {typeConfig.label}
                                </Badge>
                            {/if}
                        </div>
                        <div class="text-sm text-muted-foreground">
                            {#if item.expiration_date}
                                Expires: {format(new Date(item.expiration_date), 'MMM d')}
                            {:else if item.subscription_end}
                                Ends: {format(new Date(item.subscription_end), 'MMM d')}
                            {:else if item.warranty_expiry}
                                Warranty: {format(new Date(item.warranty_expiry), 'MMM d')}
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </Dialog.Content>
</Dialog.Root>


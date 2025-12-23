<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { InventoryItem } from '../types';
    import InventoryCard from './InventoryCard.svelte';
    import { DateUtil } from '$lib/utils/date.util';
    import { Badge } from '$lib/components/ui/badge';
    import { getItemTypeConfig, ITEM_TYPE_COLORS } from '../constants';

    let {
        items,
        groupBy = 'purchase_date',
    } = $props<{
        items: InventoryItem[];
        groupBy?: 'purchase_date' | 'expiration_date' | 'subscription_end' | 'warranty_expiry' | 'created';
    }>();

    const dispatch = createEventDispatcher<{
        edit: InventoryItem;
        delete: InventoryItem;
    }>();

    type GroupedItems = {
        date: string;
        label: string;
        items: InventoryItem[];
    };

    const groupedItems = $derived(() => {
        const groups = new Map<string, InventoryItem[]>();

        for (const item of items) {
            let dateStr = '';
            let date: Date | null = null;

            switch (groupBy) {
                case 'purchase_date':
                    dateStr = item.purchase_date || '';
                    break;
                case 'expiration_date':
                    dateStr = item.expiration_date || '';
                    break;
                case 'subscription_end':
                    dateStr = item.subscription_end || '';
                    break;
                case 'warranty_expiry':
                    dateStr = item.warranty_expiry || '';
                    break;
                case 'created':
                    dateStr = item.created || '';
                    break;
            }

            if (!dateStr) {
                const noDateKey = 'No Date';
                if (!groups.has(noDateKey)) {
                    groups.set(noDateKey, []);
                }
                groups.get(noDateKey)!.push(item);
                continue;
            }

            date = new Date(dateStr);
            const key = date.toISOString().split('T')[0];

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(item);
        }

        const result: GroupedItems[] = [];
        const noDateItems = groups.get('No Date');
        if (noDateItems) {
            result.push({
                date: '',
                label: 'No Date',
                items: noDateItems,
            });
            groups.delete('No Date');
        }

        const sortedDates = Array.from(groups.keys()).sort((a, b) => {
            return new Date(b).getTime() - new Date(a).getTime();
        });

        for (const dateKey of sortedDates) {
            const date = new Date(dateKey);
            result.push({
                date: dateKey,
                label: DateUtil.formatLong(date),
                items: groups.get(dateKey)!,
            });
        }

        return result;
    });

    function handleEdit(item: InventoryItem) {
        dispatch('edit', item);
    }

    function handleDelete(item: InventoryItem) {
        dispatch('delete', item);
    }
</script>

<div class="space-y-8">
    {#each groupedItems() as group (group.date || 'no-date')}
        <div class="space-y-4">
            <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border"></div>
                <h3 class="text-lg font-semibold">{group.label}</h3>
                <Badge variant="outline">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</Badge>
                <div class="h-px flex-1 bg-border"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ml-8">
                {#each group.items as item (item.id)}
                    <InventoryCard
                        {item}
                        on:edit={(e) => handleEdit(e.detail)}
                        on:delete={(e) => handleDelete(e.detail)}
                    />
                {/each}
            </div>
        </div>
    {/each}
</div>


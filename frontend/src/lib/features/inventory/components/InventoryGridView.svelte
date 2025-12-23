<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { InventoryItem } from '../types';
    import InventoryCard from './InventoryCard.svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { getCategoryConfig, getItemTypeConfig, INVENTORY_CATEGORIES, INVENTORY_ITEM_TYPES } from '../constants';

    let {
        items,
        groupBy = 'none',
    } = $props<{
        items: InventoryItem[];
        groupBy?: 'type' | 'category' | 'location' | 'purchase_date' | 'expiration_date' | 'none';
    }>();

    const dispatch = createEventDispatcher<{
        edit: InventoryItem;
        delete: InventoryItem;
    }>();

    type GroupedItems = {
        key: string;
        label: string;
        items: InventoryItem[];
    };

    const groupedItems = $derived(() => {
        if (groupBy === 'none') {
            return [{ key: 'all', label: 'All Items', items }];
        }

        const groups = new Map<string, InventoryItem[]>();

        for (const item of items) {
            let key = '';
            let label = '';

            switch (groupBy) {
                case 'type':
                    key = item.item_type || 'generic';
                    const typeConfig = getItemTypeConfig(key as any);
                    label = typeConfig.label;
                    break;
                case 'category':
                    key = item.category;
                    const catConfig = getCategoryConfig(item.category);
                    label = catConfig.label;
                    break;
                case 'location':
                    key = item.location || 'No Location';
                    label = key;
                    break;
                case 'purchase_date':
                    if (item.purchase_date) {
                        const date = new Date(item.purchase_date);
                        key = date.toISOString().split('T')[0];
                        label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                    } else {
                        key = 'no-date';
                        label = 'No Purchase Date';
                    }
                    break;
                case 'expiration_date':
                    if (item.expiration_date) {
                        const date = new Date(item.expiration_date);
                        key = date.toISOString().split('T')[0];
                        label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                    } else {
                        key = 'no-date';
                        label = 'No Expiration Date';
                    }
                    break;
            }

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(item);
        }

        const result: GroupedItems[] = [];
        for (const [key, groupItems] of groups.entries()) {
            const firstItem = groupItems[0];
            let label = '';
            
            switch (groupBy) {
                case 'type':
                    label = getItemTypeConfig((firstItem.item_type || 'generic') as any).label;
                    break;
                case 'category':
                    label = getCategoryConfig(firstItem.category).label;
                    break;
                case 'location':
                    label = firstItem.location || 'No Location';
                    break;
                case 'purchase_date':
                    label = firstItem.purchase_date 
                        ? new Date(firstItem.purchase_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : 'No Purchase Date';
                    break;
                case 'expiration_date':
                    label = firstItem.expiration_date
                        ? new Date(firstItem.expiration_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : 'No Expiration Date';
                    break;
            }

            result.push({ key, label, items: groupItems });
        }

        // Sort groups
        if (groupBy === 'purchase_date' || groupBy === 'expiration_date') {
            result.sort((a, b) => {
                if (a.key === 'no-date') return 1;
                if (b.key === 'no-date') return -1;
                return new Date(b.key).getTime() - new Date(a.key).getTime();
            });
        } else {
            result.sort((a, b) => a.label.localeCompare(b.label));
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

<div class="space-y-6">
    {#each groupedItems() as group (group.key)}
        {#if groupBy !== 'none'}
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="h-px flex-1 bg-border"></div>
                    <h3 class="text-lg font-semibold">{group.label}</h3>
                    <Badge variant="outline">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</Badge>
                    <div class="h-px flex-1 bg-border"></div>
                </div>
            </div>
        {/if}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 {groupBy !== 'none' ? 'ml-4' : ''}">
            {#each group.items as item (item.id)}
                <InventoryCard
                    {item}
                    on:edit={(e) => handleEdit(e.detail)}
                    on:delete={(e) => handleDelete(e.detail)}
                />
            {/each}
        </div>
    {/each}
</div>


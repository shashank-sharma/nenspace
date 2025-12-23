<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { InventoryItem } from '../types';
    import { Button } from '$lib/components/ui/button';
    import { Pencil, Trash2 } from 'lucide-svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { getCategoryConfig, getItemTypeConfig, ITEM_TYPE_COLORS } from '../constants';
    import { DateUtil } from '$lib/utils/date.util';
    import {
        Table,
        TableBody,
        TableCell,
        TableHead,
        TableHeader,
        TableRow,
    } from '$lib/components/ui/table';
    import type { InventoryCategory, InventoryItemType } from '../types';

    let {
        items,
        sortBy = 'name',
        sortOrder = 'asc',
        groupBy = 'none',
    } = $props<{
        items: InventoryItem[];
        sortBy?: 'name' | 'date' | 'price' | 'expiration' | 'created';
        sortOrder?: 'asc' | 'desc';
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
        let processed = [...items];

        // Apply sorting first
        processed.sort((a, b) => {
            let comparison = 0;
            
            switch (sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'date':
                    const dateA = a.purchase_date ? new Date(a.purchase_date).getTime() : 0;
                    const dateB = b.purchase_date ? new Date(b.purchase_date).getTime() : 0;
                    comparison = dateA - dateB;
                    break;
                case 'price':
                    comparison = (a.purchase_price || 0) - (b.purchase_price || 0);
                    break;
                case 'expiration':
                    const expA = a.expiration_date ? new Date(a.expiration_date).getTime() : 0;
                    const expB = b.expiration_date ? new Date(b.expiration_date).getTime() : 0;
                    comparison = expA - expB;
                    break;
                case 'created':
                    comparison = new Date(a.created).getTime() - new Date(b.created).getTime();
                    break;
            }
            
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        if (groupBy === 'none') {
            return [{ key: 'all', label: 'All Items', items: processed }];
        }

        const groups = new Map<string, InventoryItem[]>();

        for (const item of processed) {
            let key = '';
            let label = '';

            switch (groupBy) {
                case 'type':
                    key = item.item_type || 'generic';
                    label = getItemTypeConfig(key as any).label;
                    break;
                case 'category':
                    key = item.category;
                    label = getCategoryConfig(item.category).label;
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
            <div class="space-y-2">
                <div class="flex items-center gap-3 py-2">
                    <div class="h-px flex-1 bg-border"></div>
                    <h3 class="text-lg font-semibold">{group.label}</h3>
                    <Badge variant="outline">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</Badge>
                    <div class="h-px flex-1 bg-border"></div>
                </div>
            </div>
        {/if}
        <div class="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Purchase Date</TableHead>
                        <TableHead class="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {#each group.items as item (item.id)}
                <TableRow>
                    <TableCell class="font-medium">{item.name}</TableCell>
                    <TableCell>
                        {#if item.item_type}
                            {@const typeConfig = getItemTypeConfig(item.item_type)}
                            <Badge class={ITEM_TYPE_COLORS[item.item_type]}>
                                {typeConfig.label}
                            </Badge>
                        {:else}
                            <span class="text-muted-foreground">-</span>
                        {/if}
                    </TableCell>
                    <TableCell>
                        {@const catConfig = getCategoryConfig(item.category)}
                        <Badge variant="outline">{catConfig.label}</Badge>
                    </TableCell>
                    <TableCell>
                        {item.quantity}
                        {#if item.unit}
                            <span class="text-muted-foreground"> {item.unit}</span>
                        {/if}
                    </TableCell>
                    <TableCell>
                        {#if item.location}
                            {item.location}
                        {:else}
                            <span class="text-muted-foreground">-</span>
                        {/if}
                    </TableCell>
                    <TableCell>
                        {#if item.purchase_price && item.purchase_price > 0}
                            ${item.purchase_price.toFixed(2)}
                        {:else}
                            <span class="text-muted-foreground">-</span>
                        {/if}
                    </TableCell>
                    <TableCell>
                        {#if item.purchase_date}
                            {DateUtil.formatShort(new Date(item.purchase_date))}
                        {:else}
                            <span class="text-muted-foreground">-</span>
                        {/if}
                    </TableCell>
                    <TableCell class="text-right">
                        <div class="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" on:click={() => handleEdit(item)}>
                                <Pencil class="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" on:click={() => handleDelete(item)}>
                                <Trash2 class="h-4 w-4" />
                            </Button>
                        </div>
                    </TableCell>
                    </TableRow>
                    {/each}
                </TableBody>
            </Table>
        </div>
    {/each}
</div>


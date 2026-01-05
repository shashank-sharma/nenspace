<script lang="ts">
    import * as Select from '$lib/components/ui/select';
    import { Button } from '$lib/components/ui/button';
    import { ArrowUp, ArrowDown } from 'lucide-svelte';
    import type { SortOption, SortOrder } from '../types';

    let {
        sortBy = $bindable('name' as SortOption),
        sortOrder = $bindable('asc' as SortOrder)
    } = $props<{
        sortBy?: SortOption;
        sortOrder?: SortOrder;
    }>();

    function toggleSortOrder() {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
</script>

<div class="flex items-center gap-2">
    <Select.Root bind:selected={sortBy}>
        <Select.Trigger class="w-[140px]">
            <Select.Value placeholder="Sort by" />
        </Select.Trigger>
        <Select.Content>
            <Select.Item value="name">Name</Select.Item>
            <Select.Item value="date">Date</Select.Item>
            <Select.Item value="size">Size</Select.Item>
            <Select.Item value="type">Type</Select.Item>
        </Select.Content>
    </Select.Root>
    <Button variant="outline" size="icon" onclick={toggleSortOrder} title="Toggle sort order">
        {#if sortOrder === 'asc'}
            <ArrowUp class="h-4 w-4" />
        {:else}
            <ArrowDown class="h-4 w-4" />
        {/if}
    </Button>
</div>


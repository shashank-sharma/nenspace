<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { InventoryItem } from '../types';
    import InventoryCard from './InventoryCard.svelte';

    let { items } = $props<{
        items: InventoryItem[];
    }>();

    const dispatch = createEventDispatcher<{
        edit: InventoryItem;
        delete: InventoryItem;
    }>();

    function handleEdit(item: InventoryItem) {
        dispatch('edit', item);
    }

    function handleDelete(item: InventoryItem) {
        dispatch('delete', item);
    }
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each items as item (item.id)}
        <InventoryCard
            {item}
            on:edit={(e) => handleEdit(e.detail)}
            on:delete={(e) => handleDelete(e.detail)}
        />
    {/each}
</div>


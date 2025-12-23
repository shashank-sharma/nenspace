<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Button } from '$lib/components/ui/button';
    import { Plus } from 'lucide-svelte';
    import { INVENTORY_ITEM_TYPES } from '../constants';
    import type { InventoryItemType } from '../types';

    let {
        variant = 'default',
    } = $props<{
        variant?: 'default' | 'outline' | 'ghost';
    }>();

    const dispatch = createEventDispatcher<{
        open: void;
    }>();

    function handleClick() {
        dispatch('open');
    }
</script>

<Button variant={variant} on:click={handleClick}>
    <Plus class="h-4 w-4 mr-2" />
    Add Item
</Button>


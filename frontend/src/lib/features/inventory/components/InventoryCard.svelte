<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { InventoryItem } from '../types';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import { Pencil, Trash2, AlertTriangle, CreditCard, Shield } from 'lucide-svelte';
    import { CATEGORY_COLORS, getCategoryConfig, getItemTypeConfig, ITEM_TYPE_COLORS, inferItemType } from '../constants';
import type { InventoryCategory } from '../types';
    import { DateUtil } from '$lib/utils/date.util';
    import * as Card from '$lib/components/ui/card';

    let { item } = $props<{
        item: InventoryItem;
    }>();

    const dispatch = createEventDispatcher<{
        edit: InventoryItem;
        delete: InventoryItem;
    }>();

    const categoryConfig = $derived(getCategoryConfig(item.category));
    const itemType = $derived(item.item_type || inferItemType(item));
    const typeConfig = $derived(getItemTypeConfig(itemType));
    const isExpired = $derived.by(() => {
        if (!item.expiration_date) return false;
        return new Date(item.expiration_date) < new Date();
    });
    
    const isSubscriptionExpiring = $derived.by(() => {
        if (!item.subscription_end || itemType !== 'subscription') return false;
        const endDate = new Date(item.subscription_end);
        const now = new Date();
        const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilEnd <= 30 && daysUntilEnd > 0;
    });
    
    const isWarrantyExpiring = $derived.by(() => {
        if (!item.warranty_expiry || itemType !== 'warranty_item') return false;
        const expiryDate = new Date(item.warranty_expiry);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    });

    const isExpiringSoon = $derived.by(() => {
        if (!item.expiration_date) return false;
        if (isExpired) return false;
        const expiryDate = new Date(item.expiration_date);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
    });

    const isLowQuantity = $derived(item.quantity <= 5);

    function handleEdit() {
        dispatch('edit', item);
    }

    function handleDelete() {
        dispatch('delete', item);
    }
</script>

<Card.Root class="hover:shadow-md transition-shadow">
    <Card.Header>
        <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <Card.Title class="text-lg font-semibold truncate">{item.name}</Card.Title>
                    {#if itemType !== 'generic'}
                        <svelte:component this={typeConfig.icon} class="h-4 w-4 text-muted-foreground" />
                    {/if}
                </div>
                {#if item.description}
                    <Card.Description class="mt-1 line-clamp-2">
                        {item.description}
                    </Card.Description>
                {/if}
            </div>
            <div class="flex flex-col gap-1 items-end">
                {#if itemType !== 'generic'}
                    <Badge class={ITEM_TYPE_COLORS[itemType]}>
                        {typeConfig.label}
                    </Badge>
                {/if}
                <Badge variant="outline" class={CATEGORY_COLORS[item.category as InventoryCategory]}>
                    {categoryConfig.label}
                </Badge>
            </div>
        </div>
    </Card.Header>

    <Card.Content class="space-y-3">
        {#if item.location || item.quantity !== undefined}
            <div class="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {#if item.quantity !== undefined}
                    <span>
                        Quantity: <span class="font-medium text-foreground">{item.quantity}</span>
                        {#if item.unit}
                            <span class="text-muted-foreground"> {item.unit}</span>
                        {/if}
                    </span>
                {/if}
                {#if item.location}
                    <span>
                        Location: <span class="font-medium text-foreground">{item.location}</span>
                    </span>
                {/if}
            </div>
        {/if}

        {#if item.purchase_date || item.purchase_price}
            <div class="text-sm text-muted-foreground">
                {#if item.purchase_date}
                    <div>Purchased: {DateUtil.formatMedium(new Date(item.purchase_date))}</div>
                {/if}
                {#if item.purchase_price && item.purchase_price > 0}
                    <div>Price: ${item.purchase_price.toFixed(2)}</div>
                {/if}
            </div>
        {/if}

        {#if item.expiration_date}
            <div class="flex items-center gap-2">
                {#if isExpired}
                    <AlertTriangle class="h-4 w-4 text-destructive" />
                    <span class="text-sm text-destructive font-medium">
                        Expired: {DateUtil.formatMedium(new Date(item.expiration_date))}
                    </span>
                {:else if isExpiringSoon}
                    <AlertTriangle class="h-4 w-4 text-orange-500" />
                    <span class="text-sm text-orange-500 font-medium">
                        Expires: {DateUtil.formatMedium(new Date(item.expiration_date))}
                    </span>
                {:else}
                    <span class="text-sm text-muted-foreground">
                        Expires: {DateUtil.formatMedium(new Date(item.expiration_date))}
                    </span>
                {/if}
            </div>
        {/if}

        {#if item.warranty_expiry}
            <div class="flex items-center gap-2">
                {#if isWarrantyExpiring}
                    <Shield class="h-4 w-4 text-orange-500" />
                    <span class="text-sm text-orange-500 font-medium">
                        Warranty expires: {DateUtil.formatMedium(new Date(item.warranty_expiry))}
                    </span>
                {:else}
                    <Shield class="h-4 w-4 text-muted-foreground" />
                    <span class="text-sm text-muted-foreground">
                        Warranty expires: {DateUtil.formatMedium(new Date(item.warranty_expiry))}
                    </span>
                {/if}
            </div>
        {/if}

        {#if itemType === 'subscription'}
            {#if item.subscription_end}
                <div class="flex items-center gap-2">
                    {#if isSubscriptionExpiring}
                        <CreditCard class="h-4 w-4 text-orange-500" />
                        <span class="text-sm text-orange-500 font-medium">
                            Subscription ends: {DateUtil.formatMedium(new Date(item.subscription_end))}
                        </span>
                    {:else}
                        <CreditCard class="h-4 w-4 text-muted-foreground" />
                        <span class="text-sm text-muted-foreground">
                            Subscription ends: {DateUtil.formatMedium(new Date(item.subscription_end))}
                        </span>
                    {/if}
                </div>
            {/if}
            {#if item.subscription_recurrence}
                <div class="text-sm text-muted-foreground">
                    Recurrence: <span class="font-medium text-foreground capitalize">{item.subscription_recurrence}</span>
                </div>
            {/if}
            {#if item.subscription_cost && item.subscription_cost > 0}
                <div class="text-sm text-muted-foreground">
                    Cost: <span class="font-medium text-foreground">${item.subscription_cost.toFixed(2)}</span>
                    {#if item.subscription_recurrence}
                        <span class="text-muted-foreground">/{item.subscription_recurrence}</span>
                    {/if}
                </div>
            {/if}
            {#if item.url}
                <div class="text-sm">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
                        {item.url}
                    </a>
                </div>
            {/if}
        {/if}

        {#if itemType === 'software_license'}
            {#if item.platform}
                <div class="text-sm text-muted-foreground">
                    Platform: <span class="font-medium text-foreground">{item.platform}</span>
                </div>
            {/if}
            {#if item.license_key}
                <div class="text-sm text-muted-foreground">
                    License: <span class="font-medium text-foreground font-mono text-xs">{item.license_key}</span>
                </div>
            {/if}
            {#if item.url}
                <div class="text-sm">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
                        {item.url}
                    </a>
                </div>
            {/if}
        {/if}

        {#if item.tags && item.tags.length > 0}
            <div class="flex flex-wrap gap-1">
                {#each item.tags as tag}
                    <Badge variant="outline" class="text-xs">{tag}</Badge>
                {/each}
            </div>
        {/if}

        {#if isLowQuantity && item.category === 'pantry'}
            <div class="flex items-center gap-2 text-sm text-orange-500">
                <AlertTriangle class="h-4 w-4" />
                <span>Low quantity</span>
            </div>
        {/if}
    </Card.Content>

    <Card.Footer class="flex justify-end gap-2">
        <Button size="sm" variant="outline" on:click={handleEdit}>
            <Pencil class="h-4 w-4 mr-1" />
            Edit
        </Button>
        <Button size="sm" variant="destructive" on:click={handleDelete}>
            <Trash2 class="h-4 w-4 mr-1" />
            Delete
        </Button>
    </Card.Footer>
</Card.Root>


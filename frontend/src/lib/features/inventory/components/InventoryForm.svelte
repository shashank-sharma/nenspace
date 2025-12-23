<script lang="ts">
    import { onMount } from 'svelte';
    import { createEventDispatcher } from 'svelte';
    import * as Dialog from '$lib/components/ui/dialog';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Textarea } from '$lib/components/ui/textarea';
    import * as Select from '$lib/components/ui/select';
    import { validateWithToast, required, maxLength } from '$lib/utils';
import { toast } from 'svelte-sonner';
    import type { InventoryItem, InventoryItemType } from '../types';
    import { INVENTORY_CATEGORIES, INVENTORY_ITEM_TYPES, getItemTypeConfig, inferItemType, COMMON_LOCATIONS, COMMON_PLATFORMS, COMMON_SUBSCRIPTION_PROVIDERS, COMMON_UNITS, type ItemTemplate } from '../constants';
    import DateTimePicker from '$lib/components/DateTimePicker.svelte';
    import { today, getLocalTimeZone, parseDate } from '@internationalized/date';
    import type { DateValue } from '@internationalized/date';
    import { Badge } from '$lib/components/ui/badge';

    let {
        open = $bindable(),
        item = null,
        itemType: initialItemType = null,
        template = null,
    } = $props<{
        open?: boolean;
        item?: InventoryItem | null;
        itemType?: InventoryItemType | null;
        template?: ItemTemplate | null;
    }>();

    const dispatch = createEventDispatcher<{
        submit: Partial<InventoryItem>;
        close: void;
    }>();

    const isEdit = $derived(!!item);
    
    // Step-based flow: 0 = type selection, 1 = form
    let currentStep = $state<0 | 1>(initialItemType || template ? 1 : 0);
    let currentItemType = $state<InventoryItemType | null>(initialItemType);
    const typeConfig = $derived(currentItemType ? getItemTypeConfig(currentItemType) : null);
    const visibleFields = $derived(typeConfig?.visibleFields || {
        name: true,
        description: true,
        category: true,
        quantity: true,
        unit: true,
        location: true,
        purchase_date: true,
        purchase_price: true,
        warranty_expiry: true,
        expiration_date: true,
        license_key: true,
        platform: true,
        url: true,
        subscription_end: true,
        subscription_recurrence: false,
        subscription_cost: false,
        tags: true,
        images: true,
    });

    let formData = $state<Partial<InventoryItem>>({
        name: '',
        description: '',
        category: 'other',
        quantity: 1,
        unit: '',
        location: '',
        purchase_date: '',
        purchase_price: 0,
        warranty_expiry: '',
        expiration_date: '',
        license_key: '',
        platform: '',
        url: '',
        subscription_end: '',
        subscription_recurrence: undefined,
        subscription_cost: undefined,
        tags: [],
    });

    let selectedCategory = $state<{ value: string; label: string } | undefined>(undefined);
    let tagsInput = $state('');
    let purchaseDateValue = $state<DateValue | undefined>(undefined);
    let warrantyDateValue = $state<DateValue | undefined>(undefined);
    let expirationDateValue = $state<DateValue | undefined>(undefined);
    let subscriptionDateValue = $state<DateValue | undefined>(undefined);

    function extractDateString(dateStr: string): string {
        if (!dateStr) return '';
        // Handle both "2026-09-29 18:30:00.000Z" and "2026-09-29T18:30:00.000Z" formats
        return dateStr.replace(' ', 'T').split('T')[0];
    }

    function resetForm() {
        // Don't reset if we don't have a type selected yet
        if (!currentItemType && !template) {
            return;
        }
        
        const defaultType = currentItemType || template?.itemType || 'generic';
        const config = getItemTypeConfig(defaultType);
        
        // Apply template defaults if provided
        const templateDefaults = template?.defaults || {};
        
        // Smart defaults based on item type
        const todayDate = new Date();
        const smartDefaults: Partial<InventoryItem> = {};
        let newPurchaseDateValue: DateValue | undefined = undefined;
        let newSubscriptionDateValue: DateValue | undefined = undefined;
        
        if (currentItemType === 'physical_purchase' && !templateDefaults.purchase_date) {
            smartDefaults.purchase_date = todayDate.toISOString();
            try {
                newPurchaseDateValue = today(getLocalTimeZone());
            } catch (e) {
                console.warn('Failed to set purchase date:', e);
            }
        }
        
        if (currentItemType === 'subscription' && !templateDefaults.subscription_end) {
            // Default to 1 year from today for subscriptions
            const oneYearLater = new Date(todayDate);
            oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
            smartDefaults.subscription_end = oneYearLater.toISOString();
            try {
                newSubscriptionDateValue = parseDate(oneYearLater.toISOString().split('T')[0]);
            } catch (e) {
                console.warn('Failed to set subscription date:', e);
            }
        }
        
        formData = {
            name: template?.name || '',
            description: template?.description || '',
            category: template?.category || config.defaultCategory,
            item_type: template?.itemType || defaultType,
            quantity: templateDefaults.quantity ?? (visibleFields.quantity ? 1 : 0),
            unit: templateDefaults.unit || '',
            location: templateDefaults.location || '',
            purchase_date: templateDefaults.purchase_date || smartDefaults.purchase_date || '',
            purchase_price: templateDefaults.purchase_price || 0,
            warranty_expiry: templateDefaults.warranty_expiry || '',
            expiration_date: templateDefaults.expiration_date || '',
            license_key: templateDefaults.license_key || '',
            platform: templateDefaults.platform || '',
            url: templateDefaults.url || '',
            subscription_end: templateDefaults.subscription_end || smartDefaults.subscription_end || '',
            subscription_recurrence: templateDefaults.subscription_recurrence,
            subscription_cost: templateDefaults.subscription_cost,
            tags: templateDefaults.tags || [],
        };
        selectedCategory = INVENTORY_CATEGORIES.find(c => c.value === formData.category);
        tagsInput = formData.tags?.join(', ') || '';
        
        // Set date values safely
        purchaseDateValue = newPurchaseDateValue;
        subscriptionDateValue = newSubscriptionDateValue;
        warrantyDateValue = undefined;
        expirationDateValue = undefined;
        
        // Update currentItemType if template provided
        if (template) {
            currentItemType = template.itemType;
        }
    }

    function initializeForm() {
        if (item) {
            // Infer item type if not set
            if (!currentItemType) {
                currentItemType = item.item_type || inferItemType(item);
            }
            
            formData = {
                name: item.name,
                description: item.description || '',
                category: item.category,
                item_type: item.item_type || currentItemType || 'generic',
                quantity: item.quantity,
                unit: item.unit || '',
                location: item.location || '',
                purchase_date: item.purchase_date || '',
                purchase_price: item.purchase_price || 0,
                warranty_expiry: item.warranty_expiry || '',
                expiration_date: item.expiration_date || '',
                license_key: item.license_key || '',
                platform: item.platform || '',
                url: item.url || '',
                subscription_end: item.subscription_end || '',
                subscription_recurrence: item.subscription_recurrence,
                subscription_cost: item.subscription_cost,
                tags: item.tags || [],
            };
            selectedCategory = INVENTORY_CATEGORIES.find(c => c.value === item.category);
            tagsInput = item.tags?.join(', ') || '';

            if (item.purchase_date) {
                const dateStr = extractDateString(item.purchase_date);
                if (dateStr) {
                    try {
                        purchaseDateValue = parseDate(dateStr);
                    } catch (e) {
                        console.warn('Failed to parse purchase_date:', item.purchase_date, e);
                    }
                }
            }
            if (item.warranty_expiry) {
                const dateStr = extractDateString(item.warranty_expiry);
                if (dateStr) {
                    try {
                        warrantyDateValue = parseDate(dateStr);
                    } catch (e) {
                        console.warn('Failed to parse warranty_expiry:', item.warranty_expiry, e);
                    }
                }
            }
            if (item.expiration_date) {
                const dateStr = extractDateString(item.expiration_date);
                if (dateStr) {
                    try {
                        expirationDateValue = parseDate(dateStr);
                    } catch (e) {
                        console.warn('Failed to parse expiration_date:', item.expiration_date, e);
                    }
                }
            }
            if (item.subscription_end) {
                const dateStr = extractDateString(item.subscription_end);
                if (dateStr) {
                    try {
                        subscriptionDateValue = parseDate(dateStr);
                    } catch (e) {
                        console.warn('Failed to parse subscription_end:', item.subscription_end, e);
                    }
                }
            }
        } else {
            // For new items, use the provided itemType or template or default to generic
            if (template) {
                currentItemType = template.itemType;
                resetForm();
            } else if (initialItemType) {
                currentItemType = initialItemType;
                resetForm();
            }
            // If no type is provided, don't reset form - user will select type in step 0
        }
    }

    function handleTypeSelect(itemType: InventoryItemType) {
        currentItemType = itemType;
        currentStep = 1;
        // Use a small delay to ensure state is updated before resetting form
        setTimeout(() => {
            resetForm();
        }, 0);
    }

    function handleBack() {
        currentStep = 0;
        currentItemType = null;
        purchaseDateValue = undefined;
        warrantyDateValue = undefined;
        expirationDateValue = undefined;
        subscriptionDateValue = undefined;
    }

    function handleSubmit() {
        if (!formData.name || !formData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        if (formData.name.length > 100) {
            toast.error('Name must be less than 100 characters');
            return;
        }

        // Validate required fields based on item type
        if (typeConfig) {
            for (const field of typeConfig.requiredFields) {
                if (field === 'purchase_date' && !formData.purchase_date) {
                    toast.error('Purchase date is required for this item type');
                    return;
                }
                if (field === 'warranty_expiry' && !formData.warranty_expiry) {
                    toast.error('Warranty expiry is required for this item type');
                    return;
                }
                if (field === 'subscription_end' && !formData.subscription_end) {
                    toast.error('Subscription end date is required for this item type');
                    return;
                }
            }
        }

        if (formData.quantity !== undefined && formData.quantity < 0) {
            toast.error('Quantity must be 0 or greater');
            return;
        }

        const tags = tagsInput
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        const submitData: Partial<InventoryItem> = {
            ...formData,
            item_type: currentItemType || 'generic',
            tags,
        };

        if (purchaseDateValue) {
            const date = new Date(purchaseDateValue.year, purchaseDateValue.month - 1, purchaseDateValue.day);
            submitData.purchase_date = date.toISOString();
        }

        if (warrantyDateValue) {
            const date = new Date(warrantyDateValue.year, warrantyDateValue.month - 1, warrantyDateValue.day);
            submitData.warranty_expiry = date.toISOString();
        }

        if (expirationDateValue) {
            const date = new Date(expirationDateValue.year, expirationDateValue.month - 1, expirationDateValue.day);
            submitData.expiration_date = date.toISOString();
        }

        if (subscriptionDateValue) {
            const date = new Date(subscriptionDateValue.year, subscriptionDateValue.month - 1, subscriptionDateValue.day);
            submitData.subscription_end = date.toISOString();
        }

        dispatch('submit', submitData);
    }

    function handleClose() {
        // Reset state when closing
        currentStep = 0;
        currentItemType = null;
        purchaseDateValue = undefined;
        warrantyDateValue = undefined;
        expirationDateValue = undefined;
        subscriptionDateValue = undefined;
        dispatch('close');
    }

    $effect(() => {
        if (open) {
            if (initialItemType || template) {
                currentStep = 1;
            } else {
                currentStep = 0;
            }
            initializeForm();
        }
    });
</script>

<Dialog.Root bind:open onOpenChange={(o) => !o && handleClose()}>
    <Dialog.Content class="max-w-2xl max-h-[90vh] overflow-y-auto">
        <Dialog.Header>
            {#if currentStep === 0}
                <Dialog.Title>What are you adding?</Dialog.Title>
                <Dialog.Description>
                    Select the type of item to get a streamlined form with only the fields you need
                </Dialog.Description>
            {:else}
                <Dialog.Title>
                    {isEdit ? 'Edit Item' : template ? `Add ${template.name}` : typeConfig ? `Add ${typeConfig.label}` : 'Add New Item'}
                </Dialog.Title>
                <Dialog.Description>
                    {isEdit 
                        ? 'Update inventory item details' 
                        : template
                            ? `Quick add ${template.name.toLowerCase()} with pre-filled defaults`
                            : typeConfig 
                                ? typeConfig.description 
                                : 'Add a new item to your inventory'}
                </Dialog.Description>
            {/if}
        </Dialog.Header>

        {#if currentStep === 0}
            <!-- Type Selection Step -->
            <div class="space-y-4 py-4">
                <div class="grid grid-cols-1 gap-3">
                    {#each INVENTORY_ITEM_TYPES as typeConfig}
                        <Button
                            variant="outline"
                            class="justify-start h-auto py-4 px-4 hover:bg-accent transition-colors"
                            on:click={() => handleTypeSelect(typeConfig.value)}
                        >
                            <div class="flex items-start gap-3 w-full">
                                <div class="p-2 rounded-md {typeConfig.color}">
                                    <svelte:component this={typeConfig.icon} class="h-5 w-5" />
                                </div>
                                <div class="text-left flex-1">
                                    <div class="font-semibold text-base">{typeConfig.label}</div>
                                    <div class="text-sm text-muted-foreground mt-1">{typeConfig.description}</div>
                                </div>
                            </div>
                        </Button>
                    {/each}
                </div>
            </div>
        {:else}
            <!-- Form Step -->
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                }}
                class="space-y-4"
            >
                {#if !isEdit}
                    <div class="flex items-center justify-between pb-2 border-b">
                        <div class="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                on:click={handleBack}
                            >
                                ← Back
                            </Button>
                            {#if typeConfig}
                                <div class="flex items-center gap-2">
                                    <div class="p-1.5 rounded-md {typeConfig.color}">
                                        <svelte:component this={typeConfig.icon} class="h-4 w-4" />
                                    </div>
                                    <span class="text-sm font-medium">{typeConfig.label}</span>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}

                <div class="space-y-2">
                    <Label for="name">Name *</Label>
                    <Input
                        id="name"
                        type="text"
                        placeholder="Item name"
                        bind:value={formData.name}
                        required
                        autofocus
                    />
                </div>

            {#if visibleFields.description}
                <div class="space-y-2">
                    <Label for="description">Description</Label>
                    <Textarea
                        id="description"
                        placeholder="Item description"
                        bind:value={formData.description}
                        rows={3}
                    />
                </div>
            {/if}

            {#if visibleFields.category}
                <div class="space-y-2">
                    <Label for="category">Category *</Label>
                    <Select.Root
                        selected={selectedCategory}
                        onSelectedChange={(value) => {
                            selectedCategory = value as { value: string; label: string } | undefined;
                            if (value) {
                                formData.category = (value.value || 'other') as any;
                            }
                        }}
                    >
                        <Select.Trigger>
                            <Select.Value placeholder="Select category" />
                        </Select.Trigger>
                        <Select.Content>
                            {#each INVENTORY_CATEGORIES as category}
                                <Select.Item value={category.value}>
                                    {category.label}
                                </Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>
            {/if}

            {#if visibleFields.quantity}
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <Label for="quantity">Quantity</Label>
                        <Input
                            id="quantity"
                            type="number"
                            min="0"
                            bind:value={formData.quantity}
                        />
                    </div>

                    {#if visibleFields.unit}
                        <div class="space-y-2">
                            <Label for="unit">Unit</Label>
                            <div class="space-y-2">
                                <Input
                                    id="unit"
                                    type="text"
                                    placeholder="e.g., kg, lbs, pieces"
                                    bind:value={formData.unit}
                                />
                                <div class="flex flex-wrap gap-2">
                                    {#each COMMON_UNITS as unit}
                                        <Badge
                                            variant={formData.unit === unit ? 'default' : 'outline'}
                                            class="cursor-pointer"
                                            on:click={() => formData.unit = unit}
                                        >
                                            {unit}
                                        </Badge>
                                    {/each}
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}

            {#if visibleFields.location}
                <div class="space-y-2">
                    <Label for="location">Location</Label>
                    <div class="space-y-2">
                        <Input
                            id="location"
                            type="text"
                            placeholder="Where is this item located?"
                            bind:value={formData.location}
                        />
                        <div class="flex flex-wrap gap-2">
                            {#each COMMON_LOCATIONS as location}
                                <Badge
                                    variant={formData.location === location ? 'default' : 'outline'}
                                    class="cursor-pointer"
                                    on:click={() => formData.location = location}
                                >
                                    {location}
                                </Badge>
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}

            {#if visibleFields.purchase_date || visibleFields.purchase_price}
                <div class="grid grid-cols-2 gap-4">
                    {#if visibleFields.purchase_date}
                        <div class="space-y-2">
                            <div class="flex items-center justify-between">
                                <Label for="purchase_date">Purchase Date {typeConfig?.requiredFields.includes('purchase_date') ? '*' : ''}</Label>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    class="h-7 text-xs"
                                    on:click={() => {
                                        const now = new Date();
                                        purchaseDateValue = today(getLocalTimeZone());
                                        formData.purchase_date = now.toISOString();
                                    }}
                                >
                                    Today
                                </Button>
                            </div>
                            <DateTimePicker
                                bind:value={purchaseDateValue}
                                placeholder="Select date"
                                on:change={(e: CustomEvent<Date>) => {
                                    if (e.detail) {
                                        formData.purchase_date = e.detail.toISOString();
                                    }
                                }}
                            />
                        </div>
                    {/if}

                    {#if visibleFields.purchase_price}
                        <div class="space-y-2">
                            <Label for="purchase_price">Purchase Price</Label>
                            <Input
                                id="purchase_price"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                bind:value={formData.purchase_price}
                            />
                        </div>
                    {/if}
                </div>
            {/if}

            {#if visibleFields.warranty_expiry}
                <div class="space-y-2">
                    <Label for="warranty_expiry">Warranty Expiry {typeConfig?.requiredFields.includes('warranty_expiry') ? '*' : ''}</Label>
                    <DateTimePicker
                        bind:value={warrantyDateValue}
                        placeholder="Select date"
                        on:change={(e: CustomEvent<Date>) => {
                            if (e.detail) {
                                formData.warranty_expiry = e.detail.toISOString();
                            }
                        }}
                    />
                </div>
            {/if}

            {#if visibleFields.expiration_date}
                <div class="space-y-2">
                    <Label for="expiration_date">Expiration Date</Label>
                    <DateTimePicker
                        bind:value={expirationDateValue}
                        placeholder="Select date"
                        on:change={(e: CustomEvent<Date>) => {
                            if (e.detail) {
                                formData.expiration_date = e.detail.toISOString();
                            }
                        }}
                    />
                </div>
            {/if}

            {#if visibleFields.license_key}
                <div class="space-y-2">
                    <Label for="license_key">License Key</Label>
                    <Input
                        id="license_key"
                        type="text"
                        placeholder="License key or serial number"
                        bind:value={formData.license_key}
                    />
                </div>
            {/if}

            {#if visibleFields.platform}
                <div class="space-y-2">
                    <Label for="platform">Platform</Label>
                    <div class="space-y-2">
                        <Input
                            id="platform"
                            type="text"
                            placeholder="e.g., Windows, macOS, iOS"
                            bind:value={formData.platform}
                        />
                        <div class="flex flex-wrap gap-2">
                            {#each COMMON_PLATFORMS as platform}
                                <Badge
                                    variant={formData.platform === platform ? 'default' : 'outline'}
                                    class="cursor-pointer"
                                    on:click={() => formData.platform = platform}
                                >
                                    {platform}
                                </Badge>
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}

            {#if visibleFields.url}
                <div class="space-y-2">
                    <Label for="url">URL</Label>
                    <div class="space-y-2">
                        <Input
                            id="url"
                            type="url"
                            placeholder="https://example.com"
                            bind:value={formData.url}
                        />
                        {#if currentItemType === 'subscription'}
                            <div class="flex flex-wrap gap-2">
                                {#each COMMON_SUBSCRIPTION_PROVIDERS as provider}
                                    <Badge
                                        variant="outline"
                                        class="cursor-pointer"
                                        on:click={() => {
                                            formData.name = provider;
                                            if (provider === 'Netflix') formData.url = 'https://www.netflix.com';
                                            else if (provider === 'Spotify') formData.url = 'https://www.spotify.com';
                                            else if (provider === 'Amazon Prime') formData.url = 'https://www.amazon.com/prime';
                                            else if (provider === 'Disney+') formData.url = 'https://www.disneyplus.com';
                                            else if (provider === 'Hulu') formData.url = 'https://www.hulu.com';
                                            else if (provider === 'YouTube Premium') formData.url = 'https://www.youtube.com/premium';
                                            else if (provider === 'Adobe Creative Cloud') formData.url = 'https://www.adobe.com/creativecloud.html';
                                            else if (provider === 'Microsoft 365') formData.url = 'https://www.microsoft.com/microsoft-365';
                                            else if (provider === 'Google Workspace') formData.url = 'https://workspace.google.com';
                                            else if (provider === 'GitHub') formData.url = 'https://github.com';
                                            else if (provider === 'Figma') formData.url = 'https://www.figma.com';
                                            else if (provider === 'Notion') formData.url = 'https://www.notion.so';
                                        }}
                                    >
                                        {provider}
                                    </Badge>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            {#if visibleFields.subscription_end}
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <Label for="subscription_end">Subscription End {typeConfig?.requiredFields.includes('subscription_end') ? '*' : ''}</Label>
                        <div class="flex gap-1">
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                class="h-7 text-xs"
                                on:click={() => {
                                    const today = new Date();
                                    const oneMonthLater = new Date(today);
                                    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
                                    subscriptionDateValue = parseDate(oneMonthLater.toISOString().split('T')[0]);
                                    formData.subscription_end = oneMonthLater.toISOString();
                                }}
                            >
                                +1 Month
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                class="h-7 text-xs"
                                on:click={() => {
                                    const today = new Date();
                                    const oneYearLater = new Date(today);
                                    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
                                    subscriptionDateValue = parseDate(oneYearLater.toISOString().split('T')[0]);
                                    formData.subscription_end = oneYearLater.toISOString();
                                }}
                            >
                                +1 Year
                            </Button>
                        </div>
                    </div>
                    <DateTimePicker
                        bind:value={subscriptionDateValue}
                        placeholder="Select date"
                        on:change={(e: CustomEvent<Date>) => {
                            if (e.detail) {
                                formData.subscription_end = e.detail.toISOString();
                            }
                        }}
                    />
                </div>
            {/if}

            {#if visibleFields.subscription_recurrence}
                <div class="space-y-2">
                    <Label for="subscription_recurrence">Recurrence</Label>
                    <Select.Root
                        selected={formData.subscription_recurrence ? { value: formData.subscription_recurrence, label: formData.subscription_recurrence } : undefined}
                        onSelectedChange={(value) => {
                            if (value) {
                                formData.subscription_recurrence = value.value as any;
                            }
                        }}
                    >
                        <Select.Trigger>
                            <Select.Value placeholder="Select recurrence" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="monthly">Monthly</Select.Item>
                            <Select.Item value="yearly">Yearly</Select.Item>
                            <Select.Item value="quarterly">Quarterly</Select.Item>
                            <Select.Item value="weekly">Weekly</Select.Item>
                            <Select.Item value="one-time">One-time</Select.Item>
                        </Select.Content>
                    </Select.Root>
                </div>
            {/if}

            {#if visibleFields.subscription_cost}
                <div class="space-y-2">
                    <Label for="subscription_cost">Subscription Cost</Label>
                    <Input
                        id="subscription_cost"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        bind:value={formData.subscription_cost}
                    />
                    <p class="text-xs text-muted-foreground">Recurring cost per billing period</p>
                </div>
            {/if}

            {#if visibleFields.tags}
                <div class="space-y-2">
                    <Label for="tags">Tags</Label>
                    <Input
                        id="tags"
                        type="text"
                        placeholder="Comma-separated tags"
                        bind:value={tagsInput}
                    />
                    <p class="text-xs text-muted-foreground">Separate tags with commas</p>
                </div>
            {/if}

                <div class="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" on:click={handleClose}>
                        Cancel
                    </Button>
                    <Button type="submit">
                        {isEdit ? 'Update' : 'Create'}
                    </Button>
                </div>
            </form>
        {/if}
    </Dialog.Content>
</Dialog.Root>


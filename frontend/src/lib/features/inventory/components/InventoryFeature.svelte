<script lang="ts">
    import { onMount } from 'svelte';
    import { InventoryService } from '../services';
    import { InventorySyncService } from '../services/inventory-sync.service.svelte';
    import type { InventoryItem, InventoryFilter, InventoryItemType } from '../types';
    import { INVENTORY_CATEGORIES, INVENTORY_ITEM_TYPES, SEARCH_DEBOUNCE_MS } from '../constants';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Package, LayoutDashboard, Calendar as CalendarIcon, Filter, X } from 'lucide-svelte';
    import SearchInput from '$lib/components/SearchInput.svelte';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import EmptyState from '$lib/components/EmptyState.svelte';
    import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
    import InventoryForm from './InventoryForm.svelte';
    import QuickAddMenu from './QuickAddMenu.svelte';
    import InventoryGridView from './InventoryGridView.svelte';
    import InventoryListView from './InventoryListView.svelte';
    import InventoryTimelineView from './InventoryTimelineView.svelte';
    import InventoryDashboard from './InventoryDashboard.svelte';
    import InventoryCalendarView from './InventoryCalendarView.svelte';
    import ViewModeSelector, { type ViewMode } from './ViewModeSelector.svelte';
    import * as Select from '$lib/components/ui/select';
    import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
    import { useModalState, useDebouncedFilter } from '$lib/hooks';
    import { withErrorHandling } from '$lib/utils/error-handler.util';
    import { DebugSettings, createPageDebug } from '$lib/utils/debug-helper';
    import ButtonControl from '$lib/components/debug/controls/ButtonControl.svelte';
    import SwitchControl from '$lib/components/debug/controls/SwitchControl.svelte';

    const debugSettings = new DebugSettings('inventoryDebugSettings', {
        showExpired: false,
        showLowQuantity: false,
        autoRefresh: false,
    });

    let showExpired = $state(debugSettings.get('showExpired'));
    let showLowQuantity = $state(debugSettings.get('showLowQuantity'));
    let autoRefresh = $state(debugSettings.get('autoRefresh'));

    let items = $state<InventoryItem[]>([]);
    let isLoading = $state(true);
    let filter = $state<InventoryFilter>({
        searchQuery: '',
        showExpired: false,
        showLowQuantity: false,
        minPrice: undefined,
        maxPrice: undefined,
        startDate: undefined,
        endDate: undefined,
        dateField: 'purchase_date',
    });

    const modals = useModalState<InventoryItem>();

    let selectedCategory = $state<{ value: string; label: string } | undefined>(undefined);
    let selectedItemType = $state<{ value: string; label: string } | undefined>(undefined);
    let viewMode = $state<ViewMode>('grid');
    let activeTab = $state<'items' | 'dashboard' | 'calendar'>('items');
    let groupBy = $state<'type' | 'category' | 'location' | 'purchase_date' | 'expiration_date' | 'none'>('none');
    let sortBy = $state<'name' | 'date' | 'price' | 'expiration' | 'created'>('created');
    let sortOrder = $state<'asc' | 'desc'>('desc');
    let selectedItemTypeForForm = $state<InventoryItemType | null>(null);
    let minPrice = $state<number | undefined>(undefined);
    let maxPrice = $state<number | undefined>(undefined);
    let startDate = $state<string | undefined>(undefined);
    let endDate = $state<string | undefined>(undefined);
    let dateField = $state<'purchase_date' | 'expiration_date' | 'subscription_end' | 'warranty_expiry'>('purchase_date');
    let showAdvancedFilters = $state(false);

    const filteredItems = $derived(() => {
        let filtered = [...items];

        if (filter.searchQuery) {
            const query = filter.searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query)
            );
        }

        if (filter.category) {
            filtered = filtered.filter(item => item.category === filter.category);
        }

        if (filter.itemType) {
            filtered = filtered.filter(item => (item.item_type || 'generic') === filter.itemType);
        }

        if (filter.showExpired) {
            const now = new Date();
            filtered = filtered.filter(item => {
                if (!item.expiration_date) return false;
                return new Date(item.expiration_date) < now;
            });
        }

        if (filter.showLowQuantity) {
            filtered = filtered.filter(item => item.quantity <= 5);
        }

        if (filter.minPrice !== undefined) {
            filtered = filtered.filter(item => (item.purchase_price || 0) >= filter.minPrice!);
        }

        if (filter.maxPrice !== undefined) {
            filtered = filtered.filter(item => (item.purchase_price || 0) <= filter.maxPrice!);
        }

        if (filter.startDate && filter.dateField) {
            const start = new Date(filter.startDate);
            filtered = filtered.filter(item => {
                const itemDate = item[filter.dateField!];
                if (!itemDate) return false;
                return new Date(itemDate) >= start;
            });
        }

        if (filter.endDate && filter.dateField) {
            const end = new Date(filter.endDate);
            filtered = filtered.filter(item => {
                const itemDate = item[filter.dateField!];
                if (!itemDate) return false;
                return new Date(itemDate) <= end;
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
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

        return filtered;
    });

    const stats = $derived(() => {
        const expired = items.filter(item => {
            if (!item.expiration_date) return false;
            return new Date(item.expiration_date) < new Date();
        }).length;

        const lowQuantity = items.filter(item => item.quantity <= 5).length;

        return {
            total: items.length,
            expired,
            lowQuantity,
        };
    });

    let refreshInterval: ReturnType<typeof setInterval> | null = null;

    $effect(() => {
        if (autoRefresh) {
            refreshInterval = setInterval(() => {
                loadItems(false);
            }, 30000);
        } else if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }

        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
        };
    });

    useDebouncedFilter(
        () => filter,
        () => loadItems(true),
        SEARCH_DEBOUNCE_MS
    );

    $effect(() => {
        filter.showExpired = showExpired;
        filter.showLowQuantity = showLowQuantity;
    });

    async function loadItems(reset = false) {
        if (isLoading && !reset) return;

        isLoading = true;

        await withErrorHandling(
            () => InventoryService.getItems(filter),
            {
                errorMessage: 'Failed to load items',
                onSuccess: (result) => {
                    items = result;
                },
            }
        );

        isLoading = false;
    }

    async function handleCreate(data: Partial<InventoryItem>) {
        await withErrorHandling(
            () => InventoryService.createItem(data),
            {
                successMessage: 'Item created successfully',
                errorMessage: 'Failed to create item',
                onSuccess: async () => {
                    modals.closeAll();
                    await loadItems(true);
                },
            }
        );
    }

    async function handleUpdate(data: Partial<InventoryItem>) {
        if (!modals.selectedItem) return;

        await withErrorHandling(
            () => InventoryService.updateItem(modals.selectedItem!.id, data),
            {
                successMessage: 'Item updated successfully',
                errorMessage: 'Failed to update item',
                onSuccess: async () => {
                    modals.closeAll();
                    await loadItems(true);
                },
            }
        );
    }

    async function handleDelete() {
        if (!modals.itemToDelete) return;

        await withErrorHandling(
            () => InventoryService.deleteItem(modals.itemToDelete!.id),
            {
                successMessage: 'Item deleted successfully',
                errorMessage: 'Failed to delete item',
                onSuccess: async () => {
                    modals.closeAll();
                    await loadItems(true);
                },
            }
        );
    }

    function handleFormSubmit(data: Partial<InventoryItem>) {
        if (modals.editModalOpen && modals.selectedItem) {
            handleUpdate(data);
        } else {
            handleCreate(data);
        }
    }

    function handleCategoryChange(value: { value: string; label: string } | undefined) {
        selectedCategory = value;
        filter.category = value?.value as any;
    }

    function handleItemTypeChange(value: { value: string; label: string } | undefined) {
        selectedItemType = value;
        filter.itemType = value?.value as any;
    }

    function handleQuickAddOpen() {
        modals.openCreate();
    }

    function handleFormClose() {
        modals.closeAll();
    }

    onMount(() => {
        loadItems(true);

        window.addEventListener('inventory-synced', () => {
            loadItems(true);
        });

        const cleanup = createPageDebug('inventory-feature', 'Inventory Feature')
            .addButton('refresh-items', 'Refresh Items', () => loadItems(true))
            .addButton('force-sync', 'Force Sync Now', () =>
                InventorySyncService.forceSyncNow()
            )
            .addSwitch(
                'show-expired',
                'Show Expired Items',
                showExpired,
                (checked: boolean) => {
                    showExpired = checked;
                    debugSettings.update('showExpired', checked);
                },
                'Toggle visibility of expired items'
            )
            .addSwitch(
                'show-low-quantity',
                'Show Low Quantity',
                showLowQuantity,
                (checked: boolean) => {
                    showLowQuantity = checked;
                    debugSettings.update('showLowQuantity', checked);
                },
                'Toggle visibility of items with low quantity'
            )
            .addSwitch(
                'auto-refresh',
                'Auto Refresh',
                autoRefresh,
                (checked: boolean) => {
                    autoRefresh = checked;
                    debugSettings.update('autoRefresh', checked);
                },
                'Automatically refresh items every 30s'
            )
            .register({
                ButtonControl: ButtonControl as any,
                SwitchControl: SwitchControl as any,
                SelectControl: null,
            });

        return () => {
            cleanup();
            window.removeEventListener('inventory-synced', () => {
                loadItems(true);
            });
            if (refreshInterval) clearInterval(refreshInterval);
        };
    });
</script>

<div class="container mx-auto p-4 max-w-screen-2xl">
    <div class="flex items-center justify-between mb-6">
        <div>
            <h1 class="text-3xl font-bold">Inventory</h1>
            <p class="text-muted-foreground mt-1">
                Manage your home items, digital assets, and pantry
            </p>
        </div>
        <QuickAddMenu on:open={handleQuickAddOpen} />
    </div>

    <!-- Tabs -->
    <Tabs bind:value={activeTab} class="mb-6">
        <TabsList>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="dashboard">
                <LayoutDashboard class="h-4 w-4 mr-2" />
                Dashboard
            </TabsTrigger>
            <TabsTrigger value="calendar">
                <CalendarIcon class="h-4 w-4 mr-2" />
                Calendar
            </TabsTrigger>
        </TabsList>
    </Tabs>

    {#if activeTab === 'dashboard'}
        <InventoryDashboard />
    {:else if activeTab === 'calendar'}
        <InventoryCalendarView />
    {:else}

        <div class="mb-6 space-y-4">
            <div class="flex flex-col sm:flex-row gap-4">
                <div class="flex-1">
                    <SearchInput
                        bind:value={filter.searchQuery}
                        placeholder="Search items..."
                    />
                </div>
                <div class="w-full sm:w-48">
                    <Select.Root
                        selected={selectedCategory}
                        onSelectedChange={(value) => {
                            handleCategoryChange(value as { value: string; label: string } | undefined);
                        }}
                    >
                        <Select.Trigger>
                            <Select.Value placeholder="All categories" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="">All categories</Select.Item>
                            {#each INVENTORY_CATEGORIES as category}
                                <Select.Item value={category.value}>
                                    {category.label}
                                </Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>
                <div class="w-full sm:w-48">
                    <Select.Root
                        selected={selectedItemType}
                        onSelectedChange={(value) => {
                            handleItemTypeChange(value as { value: string; label: string } | undefined);
                        }}
                    >
                        <Select.Trigger>
                            <Select.Value placeholder="All types" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="">All types</Select.Item>
                            {#each INVENTORY_ITEM_TYPES as type}
                                <Select.Item value={type.value}>
                                    {type.label}
                                </Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>
                <ViewModeSelector bind:value={viewMode} />
            </div>
            
            <div class="flex flex-wrap items-center gap-4">
                <!-- Sort Options -->
                <div class="flex items-center gap-2">
                    <span class="text-sm text-muted-foreground">Sort by:</span>
                    <Select.Root
                        selected={sortBy ? { value: sortBy, label: sortBy.charAt(0).toUpperCase() + sortBy.slice(1) } : undefined}
                        onSelectedChange={(value) => {
                            if (value) {
                                sortBy = value.value as any;
                            }
                        }}
                    >
                        <Select.Trigger class="w-[140px]">
                            <Select.Value placeholder="Sort" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="name">Name</Select.Item>
                            <Select.Item value="date">Purchase Date</Select.Item>
                            <Select.Item value="price">Price</Select.Item>
                            <Select.Item value="expiration">Expiration</Select.Item>
                            <Select.Item value="created">Created</Select.Item>
                        </Select.Content>
                    </Select.Root>
                    <Button
                        size="sm"
                        variant="outline"
                        on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
                        title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                        {sortOrder === 'asc' ? '↑' : '↓'}
                    </Button>
                </div>

                <!-- Grouping Options (for all views) -->
                <div class="flex items-center gap-2">
                    <span class="text-sm text-muted-foreground">Group by:</span>
                    <Select.Root
                        selected={groupBy ? { value: groupBy, label: groupBy === 'none' ? 'None' : groupBy.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) } : undefined}
                        onSelectedChange={(value) => {
                            if (value) {
                                groupBy = value.value as any;
                            }
                        }}
                    >
                        <Select.Trigger class="w-[160px]">
                            <Select.Value placeholder="No grouping" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="none">No grouping</Select.Item>
                            <Select.Item value="type">Type</Select.Item>
                            <Select.Item value="category">Category</Select.Item>
                            <Select.Item value="location">Location</Select.Item>
                            <Select.Item value="purchase_date">Purchase Date</Select.Item>
                            <Select.Item value="expiration_date">Expiration Date</Select.Item>
                        </Select.Content>
                    </Select.Root>
                </div>
            </div>

            <!-- Advanced Filters -->
            <div class="flex items-center gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    on:click={() => showAdvancedFilters = !showAdvancedFilters}
                >
                    <Filter class="h-4 w-4 mr-2" />
                    Advanced Filters
                </Button>
                {#if minPrice !== undefined || maxPrice !== undefined || startDate || endDate}
                    <Button
                        size="sm"
                        variant="ghost"
                        on:click={() => {
                            minPrice = undefined;
                            maxPrice = undefined;
                            startDate = undefined;
                            endDate = undefined;
                            filter.minPrice = undefined;
                            filter.maxPrice = undefined;
                            filter.startDate = undefined;
                            filter.endDate = undefined;
                        }}
                    >
                        <X class="h-4 w-4 mr-2" />
                        Clear Filters
                    </Button>
                {/if}
            </div>

            {#if showAdvancedFilters}
                <div class="p-4 border rounded-lg space-y-4 bg-muted/50">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Price Range -->
                        <div class="space-y-2">
                            <Label>Price Range</Label>
                            <div class="flex items-center gap-2">
                                <Input
                                    type="number"
                                    placeholder="Min price"
                                    value={minPrice?.toString() || ''}
                                    oninput={(e) => {
                                        const value = parseFloat((e.target as HTMLInputElement).value);
                                        minPrice = isNaN(value) ? undefined : value;
                                        filter.minPrice = isNaN(value) ? undefined : value;
                                    }}
                                />
                                <span class="text-muted-foreground">to</span>
                                <Input
                                    type="number"
                                    placeholder="Max price"
                                    value={maxPrice?.toString() || ''}
                                    oninput={(e) => {
                                        const value = parseFloat((e.target as HTMLInputElement).value);
                                        maxPrice = isNaN(value) ? undefined : value;
                                        filter.maxPrice = isNaN(value) ? undefined : value;
                                    }}
                                />
                            </div>
                        </div>

                        <!-- Date Range -->
                        <div class="space-y-2">
                            <Label>Date Range</Label>
                            <div class="flex items-center gap-2">
                                <Select.Root
                                    selected={dateField ? { value: dateField, label: dateField.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) } : undefined}
                                    onSelectedChange={(value) => {
                                        if (value) {
                                            dateField = value.value as any;
                                            filter.dateField = dateField;
                                        }
                                    }}
                                >
                                    <Select.Trigger class="w-[160px]">
                                        <Select.Value placeholder="Date field" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Item value="purchase_date">Purchase Date</Select.Item>
                                        <Select.Item value="expiration_date">Expiration Date</Select.Item>
                                        <Select.Item value="subscription_end">Subscription End</Select.Item>
                                        <Select.Item value="warranty_expiry">Warranty Expiry</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                                <Input
                                    type="date"
                                    placeholder="Start date"
                                    bind:value={startDate}
                                    oninput={(e) => {
                                        filter.startDate = (e.target as HTMLInputElement).value || undefined;
                                    }}
                                />
                                <Input
                                    type="date"
                                    placeholder="End date"
                                    bind:value={endDate}
                                    oninput={(e) => {
                                        filter.endDate = (e.target as HTMLInputElement).value || undefined;
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            {/if}

            {#if stats().total > 0}
                <div class="flex flex-wrap gap-4 text-sm">
                    <div class="flex items-center gap-2">
                        <span class="text-muted-foreground">Total:</span>
                        <span class="font-medium">{stats().total}</span>
                    </div>
                    {#if stats().expired > 0}
                        <div class="flex items-center gap-2">
                            <span class="text-muted-foreground">Expired:</span>
                            <span class="font-medium text-destructive">{stats().expired}</span>
                        </div>
                    {/if}
                    {#if stats().lowQuantity > 0}
                        <div class="flex items-center gap-2">
                            <span class="text-muted-foreground">Low Quantity:</span>
                            <span class="font-medium text-orange-500">{stats().lowQuantity}</span>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>

        {#if isLoading}
            <LoadingSpinner centered size="lg" label="Loading items..." />
        {:else if filteredItems().length === 0}
            <EmptyState
                icon={Package}
                title={items.length === 0 ? "No items yet" : "No items match your filters"}
                description={items.length === 0 ? "Start by adding your first inventory item" : "Try adjusting your search or filters"}
                actionLabel="Add Item"
                onaction={() => modals.openCreate()}
            />
        {:else}
                {#if viewMode === 'grid'}
                    <InventoryGridView
                        items={filteredItems()}
                        {groupBy}
                        on:edit={(e) => modals.openEdit(e.detail)}
                        on:delete={(e) => modals.openDelete(e.detail)}
                    />
                {:else if viewMode === 'list'}
                    <InventoryListView
                        items={filteredItems()}
                        {sortBy}
                        {sortOrder}
                        {groupBy}
                        on:edit={(e) => modals.openEdit(e.detail)}
                        on:delete={(e) => modals.openDelete(e.detail)}
                    />
                {:else if viewMode === 'timeline'}
                    <InventoryTimelineView
                        items={filteredItems()}
                        groupBy={groupBy === 'purchase_date' ? 'purchase_date' : groupBy === 'expiration_date' ? 'expiration_date' : 'created'}
                        on:edit={(e) => modals.openEdit(e.detail)}
                        on:delete={(e) => modals.openDelete(e.detail)}
                    />
                {/if}
        {/if}
    {/if}
</div>

{#if modals.createModalOpen}
    <InventoryForm
        bind:open={modals.createModalOpen}
        item={null}
        on:submit={(e) => handleFormSubmit(e.detail)}
        on:close={handleFormClose}
    />
{/if}

{#if modals.editModalOpen}
    <InventoryForm
        bind:open={modals.editModalOpen}
        item={modals.selectedItem}
        on:submit={(e) => handleFormSubmit(e.detail)}
        on:close={handleFormClose}
    />
{/if}

<ConfirmDialog
    bind:open={modals.deleteModalOpen}
    title="Delete this item?"
    description="This action cannot be undone."
    confirmText="Delete"
    variant="destructive"
    onconfirm={handleDelete}
/>


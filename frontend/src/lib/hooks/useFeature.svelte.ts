/**
 * useFeature Hook
 * 
 * Generic feature management hook that handles common patterns:
 * - Loading state
 * - Filtering/searching with debounce
 * - Modal state management
 * - CRUD operations
 * - Pagination
 * 
 * Eliminates ~100-150 lines of duplicate code per feature component.
 */

import { toast } from 'svelte-sonner';
import { onMount } from 'svelte';

export interface FeatureService<T, TCreate = Partial<T>, TFilter = any> {
    fetch: (filter?: TFilter, page?: number) => Promise<{ items: T[]; hasMore: boolean }>;
    create: (data: TCreate) => Promise<T>;
    update: (id: string, data: Partial<T>) => Promise<T>;
    delete: (id: string) => Promise<void>;
}

export interface FeatureOptions<T, TCreate = Partial<T>, TFilter = any> {
    service: FeatureService<T, TCreate, TFilter>;
    pageSize?: number;
    searchDebounceMs?: number;
    initialFilter?: TFilter;
    onLoadSuccess?: (items: T[]) => void | Promise<void>;
    onLoadError?: (error: any) => void;
    autoLoadOnMount?: boolean;
}

export function useFeature<T extends { id: string }, TCreate = Partial<T>, TFilter = any>(
    options: FeatureOptions<T, TCreate, TFilter>
) {
    // State
    let items = $state<T[]>([]);
    let isLoading = $state(false);
    let hasMore = $state(true);
    let page = $state(1);
    let filter = $state<TFilter>(options.initialFilter ?? ({} as TFilter));

    // Modal state
    let createModalOpen = $state(false);
    let editModalOpen = $state(false);
    let deleteModalOpen = $state(false);
    let itemToEdit = $state<T | null>(null);
    let itemToDelete = $state<T | null>(null);

    // Filter debounce
    let filterTimeout: ReturnType<typeof setTimeout> | null = null;
    let isInitialMount = true;

    /**
     * Load items from service
     */
    async function loadItems(reset = false): Promise<void> {
        if (isLoading && !reset) return;

        if (reset) {
            page = 1;
            hasMore = true;
        }

        isLoading = true;

        try {
            const result = await options.service.fetch(filter, page);
            
            if (reset) {
                items = result.items;
            } else {
                items = [...items, ...result.items];
            }

            hasMore = result.hasMore;
            page++;

            // Call success callback
            await options.onLoadSuccess?.(result.items);
        } catch (error) {
            console.error('Failed to load items:', error);
            options.onLoadError?.(error);
            toast.error('Failed to load items');
        } finally {
            isLoading = false;
        }
    }

    /**
     * Load more items (pagination)
     */
    async function loadMore(): Promise<void> {
        if (!hasMore || isLoading) return;
        await loadItems(false);
    }

    /**
     * Refresh items (reset and reload)
     */
    async function refresh(): Promise<void> {
        await loadItems(true);
    }

    /**
     * Create item
     */
    async function createItem(data: TCreate): Promise<T | null> {
        try {
            const created = await options.service.create(data);
            toast.success('Item created successfully');
            createModalOpen = false;
            await refresh();
            return created;
        } catch (error) {
            console.error('Failed to create item:', error);
            toast.error('Failed to create item');
            return null;
        }
    }

    /**
     * Update item
     */
    async function updateItem(id: string, data: Partial<T>): Promise<T | null> {
        try {
            const updated = await options.service.update(id, data);
            toast.success('Item updated successfully');
            editModalOpen = false;
            itemToEdit = null;
            await refresh();
            return updated;
        } catch (error) {
            console.error('Failed to update item:', error);
            toast.error('Failed to update item');
            return null;
        }
    }

    /**
     * Delete item
     */
    async function deleteItem(id: string): Promise<boolean> {
        try {
            await options.service.delete(id);
            toast.success('Item deleted successfully');
            deleteModalOpen = false;
            itemToDelete = null;
            await refresh();
            return true;
        } catch (error) {
            console.error('Failed to delete item:', error);
            toast.error('Failed to delete item');
            return false;
        }
    }

    /**
     * Open create modal
     */
    function openCreateModal(): void {
        createModalOpen = true;
    }

    /**
     * Open edit modal
     */
    function openEditModal(item: T): void {
        itemToEdit = item;
        editModalOpen = true;
    }

    /**
     * Open delete modal
     */
    function openDeleteModal(item: T): void {
        itemToDelete = item;
        deleteModalOpen = true;
    }

    /**
     * Close all modals
     */
    function closeModals(): void {
        createModalOpen = false;
        editModalOpen = false;
        deleteModalOpen = false;
        itemToEdit = null;
        itemToDelete = null;
    }

    /**
     * Update filter (with debounce)
     */
    function updateFilter(newFilter: Partial<TFilter>): void {
        filter = { ...filter, ...newFilter };
    }

    /**
     * Debounced filter effect
     */
    $effect(() => {
        // Trigger effect on filter changes
        JSON.stringify(filter);

        if (isInitialMount) {
            isInitialMount = false;
            return;
        }

        if (filterTimeout) clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            loadItems(true);
        }, options.searchDebounceMs ?? 300);
    });

    // Auto-load on mount if enabled
    if (options.autoLoadOnMount !== false) {
        onMount(() => {
            loadItems(true);
        });
    }

    return {
        // State
        get items() { return items; },
        get isLoading() { return isLoading; },
        get hasMore() { return hasMore; },
        get filter() { return filter; },
        get page() { return page; },

        // Modal state
        get createModalOpen() { return createModalOpen; },
        set createModalOpen(value: boolean) { createModalOpen = value; },
        get editModalOpen() { return editModalOpen; },
        set editModalOpen(value: boolean) { editModalOpen = value; },
        get deleteModalOpen() { return deleteModalOpen; },
        set deleteModalOpen(value: boolean) { deleteModalOpen = value; },
        get itemToEdit() { return itemToEdit; },
        get itemToDelete() { return itemToDelete; },

        // Methods
        loadItems,
        loadMore,
        refresh,
        createItem,
        updateItem,
        deleteItem,
        updateFilter,
        openCreateModal,
        openEditModal,
        openDeleteModal,
        closeModals,
    };
}

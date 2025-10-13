/**
 * Client-Side Pagination Hook
 * Reusable pagination logic for Svelte 5 components
 */

export interface PaginationOptions<T> {
    items: T[] | (() => T[]);
    initialPageSize?: number;
    pageSizeOptions?: number[];
}

/**
 * Hook for client-side pagination
 * Automatically handles page resets when data changes
 * 
 * @param options - Pagination configuration
 * @returns Pagination state and methods
 * 
 * @example
 * const pagination = usePagination({
 *     items: tasks,
 *     initialPageSize: 10,
 *     pageSizeOptions: [10, 20, 50],
 * });
 * 
 * // In template:
 * {#each pagination.paginatedItems as item}
 *     <Item {item} />
 * {/each}
 * 
 * <Pagination
 *     currentPage={pagination.currentPage}
 *     totalPages={pagination.totalPages}
 *     onNextPage={pagination.nextPage}
 *     onPreviousPage={pagination.previousPage}
 * />
 */
export function usePagination<T>(options: PaginationOptions<T>) {
    let currentPage = $state(1);
    let pageSize = $state(options.initialPageSize ?? 10);

    // Helper to get items (supports both array and getter function)
    const getItems = () => typeof options.items === 'function' ? options.items() : options.items;

    // Derived values
    const totalItems = $derived(getItems().length);
    const totalPages = $derived(Math.ceil(totalItems / pageSize));

    const paginatedItems = $derived.by(() => {
        const items = getItems();
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        return items.slice(start, end);
    });

    const hasNextPage = $derived(currentPage < totalPages);
    const hasPreviousPage = $derived(currentPage > 1);
    const startIndex = $derived((currentPage - 1) * pageSize + 1);
    const endIndex = $derived(Math.min(currentPage * pageSize, totalItems));

    // Auto-reset to page 1 when items change and current page becomes invalid
    $effect(() => {
        // Trigger effect when items or totalPages change
        const _items = getItems();
        const _totalPages = totalPages;

        if (currentPage > _totalPages && _totalPages > 0) {
            currentPage = 1;
        }
    });

    /**
     * Navigate to a specific page
     */
    function goToPage(page: number): void {
        const validPage = Math.max(1, Math.min(page, totalPages));
        currentPage = validPage;
    }

    /**
     * Go to next page
     */
    function nextPage(): void {
        if (hasNextPage) {
            currentPage++;
        }
    }

    /**
     * Go to previous page
     */
    function previousPage(): void {
        if (hasPreviousPage) {
            currentPage--;
        }
    }

    /**
     * Go to first page
     */
    function goToFirstPage(): void {
        currentPage = 1;
    }

    /**
     * Go to last page
     */
    function goToLastPage(): void {
        currentPage = totalPages;
    }

    /**
     * Change page size and reset to page 1
     */
    function setPageSize(newSize: number): void {
        pageSize = newSize;
        currentPage = 1;
    }

    return {
        // State (read/write for two-way binding)
        get currentPage() {
            return currentPage;
        },
        set currentPage(value: number) {
            goToPage(value);
        },
        get pageSize() {
            return pageSize;
        },
        set pageSize(value: number) {
            setPageSize(value);
        },
        // Derived state (read-only)
        get totalPages() {
            return totalPages;
        },
        get totalItems() {
            return totalItems;
        },
        get paginatedItems() {
            return paginatedItems;
        },
        get hasNextPage() {
            return hasNextPage;
        },
        get hasPreviousPage() {
            return hasPreviousPage;
        },
        get startIndex() {
            return startIndex;
        },
        get endIndex() {
            return endIndex;
        },

        // Methods
        goToPage,
        nextPage,
        previousPage,
        goToFirstPage,
        goToLastPage,
        setPageSize,
    };
}

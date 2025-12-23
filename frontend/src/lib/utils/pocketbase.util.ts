/**
 * PocketBase Utilities
 * 
 * Shared utilities for working with PocketBase collections.
 * Provides pagination helpers, constants, and type-safe collection operations.
 * 
 * Eliminates duplicate pagination logic across services.
 */

import { pb } from '$lib/config/pocketbase';
import type { RecordModel } from 'pocketbase';

// ========================================
// Constants
// ========================================

/** Default number of items per page for pagination */
export const PAGINATION_PER_PAGE = 500;

/** Maximum number of items to fetch in a single pagination request */
export const PAGINATION_MAX_PER_PAGE = 500;

/** Default sort order (newest first) */
export const DEFAULT_SORT = '-updated';

// ========================================
// Types
// ========================================

export interface PaginationOptions {
    /** Page number (1-based) */
    page?: number;
    /** Items per page */
    perPage?: number;
    /** Filter string */
    filter?: string;
    /** Sort order */
    sort?: string;
    /** Expand relations */
    expand?: string;
    /** Request key for caching */
    requestKey?: string;
}

export interface FetchAllPagesOptions<T = RecordModel> {
    /** Collection name */
    collection: string;
    /** Filter string */
    filter?: string;
    /** Sort order */
    sort?: string;
    /** Items per page (default: PAGINATION_PER_PAGE) */
    perPage?: number;
    /** Expand relations */
    expand?: string;
    /** Transform function for items */
    transform?: (item: RecordModel) => T;
}

// ========================================
// Pagination Helpers
// ========================================

/**
 * Fetch all pages from a PocketBase collection with automatic pagination.
 * 
 * This utility handles pagination automatically, fetching all pages until
 * all items are retrieved. Use this when you need all items from a collection.
 * 
 * @example
 * ```typescript
 * // Fetch all entries for a user
 * const entries = await fetchAllPages<LocalStreamEntry>({
 *     collection: 'stream_entries',
 *     filter: `user = "${userId}"`,
 *     sort: '-updated',
 *     transform: (item) => item as LocalStreamEntry
 * });
 * ```
 * 
 * @param options - Pagination and collection options
 * @returns Array of all items from all pages
 * @throws Error if fetch fails
 */
export async function fetchAllPages<T = RecordModel>(
    options: FetchAllPagesOptions<T>
): Promise<T[]> {
    const {
        collection,
        filter,
        sort = DEFAULT_SORT,
        perPage = PAGINATION_PER_PAGE,
        expand,
        transform,
    } = options;

    const allItems: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const result = await pb.collection(collection).getList(page, perPage, {
            filter,
            sort,
            expand,
        });

        const items = transform
            ? result.items.map(transform)
            : (result.items as T[]);

        allItems.push(...items);
        hasMore = result.items.length === perPage;
        page++;
    }

    return allItems;
}

/**
 * Fetch a single page from a PocketBase collection.
 * 
 * Use this when you only need a specific page of results (e.g., for UI pagination).
 * 
 * @example
 * ```typescript
 * const result = await fetchPage({
 *     collection: 'tasks',
 *     page: 1,
 *     perPage: 20,
 *     filter: `user = "${userId}"`,
 *     sort: '-created'
 * });
 * ```
 * 
 * @param options - Pagination options
 * @returns Paginated result with items, total count, and pagination metadata
 * @throws Error if fetch fails
 */
export async function fetchPage<T = RecordModel>(
    options: PaginationOptions & { collection: string }
): Promise<{
    items: T[];
    totalItems: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasMore: boolean;
}> {
    const {
        collection,
        page = 1,
        perPage = PAGINATION_PER_PAGE,
        filter,
        sort = DEFAULT_SORT,
        expand,
        requestKey,
    } = options;

    const result = await pb.collection(collection).getList(page, perPage, {
        filter,
        sort,
        expand,
        requestKey,
    });

    const totalPages = Math.ceil(result.totalItems / perPage);

    return {
        items: result.items as T[],
        totalItems: result.totalItems,
        page: result.page,
        perPage: result.perPage,
        totalPages,
        hasMore: result.page < totalPages,
    };
}

/**
 * Check if a collection exists and is accessible.
 * 
 * @param collection - Collection name
 * @returns True if collection exists and is accessible
 */
export async function collectionExists(collection: string): Promise<boolean> {
    try {
        await pb.collection(collection).getList(1, 1);
        return true;
    } catch {
        return false;
    }
}


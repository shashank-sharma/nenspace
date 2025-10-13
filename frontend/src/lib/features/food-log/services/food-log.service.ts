import { pb } from '$lib/config/pocketbase';
import type { FoodLogEntry, FoodLogFormData, FoodLogFilter } from '../types';
import { NetworkService } from '$lib/services/network.service.svelte';
import { FoodLogStorageService, type LocalFoodLogEntry } from './food-log-storage.service';
import { FoodLogSyncService } from './food-log-sync.service.svelte';
import { generateLocalId, FilterBuilder } from '$lib/utils';

export class FoodLogService {
    /**
     * Fetch food log entries with pagination and filters
     * ✅ OFFLINE-FIRST: Returns local data when offline, syncs from server when online
     */
    static async getEntries(
        page: number,
        perPage: number,
        filter?: FoodLogFilter
    ): Promise<{
        items: FoodLogEntry[];
        totalItems: number;
        hasMore: boolean;
    }> {
        const userId = pb.authStore.model?.id;

        try {
            // OFFLINE-FIRST: Try server first, fallback to local
            if (NetworkService.isOnline) {
                // Build filter using FilterBuilder for type safety and SQL injection prevention
                const filterBuilder = FilterBuilder.create()
                    .equals('user', userId);

                // Add date range filter if provided
                if (filter?.date) {
                    const startOfDay = new Date(filter.date);
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(filter.date);
                    endOfDay.setHours(23, 59, 59, 999);
                    filterBuilder
                        .greaterThanOrEqual('date', startOfDay.toISOString())
                        .lessThanOrEqual('date', endOfDay.toISOString());
                }

                // Add tag filter if provided
                if (filter?.tag) {
                    filterBuilder.equals('tag', filter.tag);
                }

                // Add search term filter if provided
                if (filter?.searchTerm?.trim()) {
                    filterBuilder.contains('name', filter.searchTerm);
                }

                const result = await pb.collection('food_log').getList(page, perPage, {
                    sort: '-date',
                    filter: filterBuilder.build(),
                    expand: 'user',
                });

                // Cache entries locally for offline access
                const entries = result.items as unknown as FoodLogEntry[];
                await this.cacheEntries(entries);

                return {
                    items: entries,
                    totalItems: result.totalItems,
                    hasMore: result.items.length === perPage,
                };
            } else {
                // OFFLINE: Return cached entries
                console.log('📴 Offline mode: Loading from local cache');
                const localEntries = await FoodLogStorageService.getAllEntries(userId);

                // Apply filters locally
                let filteredEntries = localEntries;

                if (filter?.date) {
                    const targetDate = new Date(filter.date).toISOString().split('T')[0];
                    filteredEntries = filteredEntries.filter((entry) =>
                        entry.date.startsWith(targetDate)
                    );
                }

                if (filter?.tag) {
                    filteredEntries = filteredEntries.filter(
                        (entry) => entry.tag === filter.tag
                    );
                }

                if (filter?.searchTerm?.trim()) {
                    const searchLower = filter.searchTerm.toLowerCase();
                    filteredEntries = filteredEntries.filter((entry) =>
                        entry.name.toLowerCase().includes(searchLower)
                    );
                }

                // Implement pagination
                const start = (page - 1) * perPage;
                const end = start + perPage;
                const paginatedEntries = filteredEntries.slice(start, end);

                return {
                    items: paginatedEntries as FoodLogEntry[],
                    totalItems: filteredEntries.length,
                    hasMore: end < filteredEntries.length,
                };
            }
        } catch (error) {
            // Fallback to local cache on network error
            console.error('Failed to fetch from server, using local cache:', error);

            try {
                const localEntries = await FoodLogStorageService.getAllEntries(userId);
                return {
                    items: localEntries as FoodLogEntry[],
                    totalItems: localEntries.length,
                    hasMore: false,
                };
            } catch (cacheError) {
                console.error('Failed to load from cache:', cacheError);
                throw new Error('Failed to load food log entries');
            }
        }
    }

    /**
     * Cache entries locally for offline access
     */
    private static async cacheEntries(entries: FoodLogEntry[]): Promise<void> {
        try {
            const localEntries: LocalFoodLogEntry[] = entries.map((entry) => ({
                ...entry,
                syncStatus: 'synced' as const,
                lastModified: Date.now(),
            }));

            await FoodLogStorageService.saveEntries(localEntries);
        } catch (error) {
            console.error('Failed to cache entries:', error);
            // Don't throw - caching failure shouldn't break the main flow
        }
    }

    /**
     * Create a new food log entry
     * ✅ OFFLINE-FIRST: Queue for sync when offline
     */
    static async createEntry(data: FoodLogFormData): Promise<FoodLogEntry> {
        const userId = pb.authStore.model?.id;
        if (!userId) throw new Error('User not authenticated');

        try {
            if (NetworkService.isOnline) {
                // ONLINE: Create on server immediately
                const formData: Record<string, any> = {
                    name: data.name.trim(),
                    tag: data.tag,
                    date: data.date,
                    user: userId,
                };

                if (data.image) {
                    formData.image = data.image;
                }

                const created = await pb.collection('food_log').create(formData);
                const entry = created as unknown as FoodLogEntry;

                // Cache locally
                await this.cacheEntries([entry]);

                // Cache image blob if present
                if (data.image) {
                    await FoodLogStorageService.saveImage(entry.id, data.image);
                }

                return entry;
            } else {
                // OFFLINE: Create locally and queue for sync
                console.log('📴 Offline mode: Queuing entry for sync');

                const localId = generateLocalId();
                const now = new Date().toISOString();

                const localEntry: LocalFoodLogEntry = {
                    id: localId,
                    user: userId,
                    name: data.name.trim(),
                    image: data.image?.name || '',
                    tag: data.tag,
                    date: data.date,
                    created: now,
                    updated: now,
                    localId,
                    syncStatus: 'pending',
                    lastModified: Date.now(),
                };

                // Save to local storage
                await FoodLogStorageService.saveEntry(localEntry);

                // Save image blob if present
                if (data.image) {
                    await FoodLogStorageService.saveImage(localId, data.image);
                }

                // Queue for sync
                await FoodLogSyncService.queueEntry(localEntry);

                return localEntry as FoodLogEntry;
            }
        } catch (error) {
            console.error('Failed to create food log entry:', error);
            throw new Error('Failed to save food log entry');
        }
    }

    /**
     * Delete a food log entry
     * ✅ OFFLINE-FIRST: Delete locally and queue for sync
     */
    static async deleteEntry(id: string): Promise<void> {
        try {
            // Delete locally first
            await FoodLogStorageService.deleteEntry(id);
            await FoodLogStorageService.deleteImage(id);

            // If online, delete from server
            if (NetworkService.isOnline) {
                await pb.collection('food_log').delete(id);
            } else {
                // NOTE: Deletion queuing not implemented yet - local delete only
                console.log('📴 Offline: Entry deleted locally only');
            }
        } catch (error) {
            console.error('Failed to delete food log entry:', error);
            throw new Error('Failed to delete food log entry');
        }
    }

    /**
     * Update a food log entry
     * ✅ OFFLINE-FIRST: Update locally and queue for sync
     */
    static async updateEntry(
        id: string,
        data: Partial<FoodLogFormData>
    ): Promise<FoodLogEntry> {
        try {
            // Get existing entry
            const existingEntry = await FoodLogStorageService.getEntry(id);
            if (!existingEntry) {
                throw new Error('Entry not found locally');
            }

            // Update locally first
            const updatedEntry: LocalFoodLogEntry = {
                ...existingEntry,
                name: data.name?.trim() || existingEntry.name,
                tag: data.tag || existingEntry.tag,
                date: data.date || existingEntry.date,
                image: data.image?.name || existingEntry.image,
                syncStatus: 'pending',
                lastModified: Date.now(),
            };

            await FoodLogStorageService.saveEntry(updatedEntry);

            // Save image blob if present
            if (data.image) {
                await FoodLogStorageService.saveImage(id, data.image);
            }

            // If online, update on server
            if (NetworkService.isOnline) {
                const serverUpdate = await pb.collection('food_log').update(id, {
                    name: updatedEntry.name,
                    tag: updatedEntry.tag,
                    date: updatedEntry.date,
                });

                // Mark as synced
                updatedEntry.syncStatus = 'synced';
                updatedEntry.updated = serverUpdate.updated;
                await FoodLogStorageService.saveEntry(updatedEntry);

                return serverUpdate as unknown as FoodLogEntry;
            } else {
                // OFFLINE: Queue for sync
                console.log('📴 Offline: Entry updated locally, sync pending');
                await FoodLogSyncService.queueEntry(updatedEntry);
                return updatedEntry as FoodLogEntry;
            }
        } catch (error) {
            console.error('Failed to update food log entry:', error);
            throw new Error('Failed to update food log entry');
        }
    }

    /**
     * Get image URL for a food log entry
     * ✅ OFFLINE-FIRST: Return blob URL for local images
     */
    static async getImageUrl(entry: FoodLogEntry): Promise<string> {
        if (!entry.image) return '';

        // Check if we have a local blob
        const localBlob = await FoodLogStorageService.getImage(entry.id);
        if (localBlob) {
            return URL.createObjectURL(localBlob);
        }

        // Fallback to server URL
        return pb.files.getUrl(entry, entry.image);
    }

    /**
     * Get image URL synchronously (for backwards compatibility)
     */
    static getImageUrlSync(entry: FoodLogEntry): string {
        if (!entry.image) return '';
        return pb.files.getUrl(entry, entry.image);
    }

    /**
     * Clear all local cache (for debugging/reset)
     */
    static async clearLocalCache(): Promise<void> {
        await FoodLogStorageService.clearAll();
        console.log('✅ Local cache cleared');
    }

    /**
     * Get storage statistics
     */
    static async getStorageStats() {
        return await FoodLogStorageService.getStats();
    }
}


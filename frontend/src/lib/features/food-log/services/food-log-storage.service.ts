/**
 * Food Log Storage Service
 * 
 * Provides IndexedDB-based local storage for food log entries and images.
 * Enables offline-first functionality by caching data locally.
 * 
 * ✅ REFACTORED: Extends BaseStorageService to eliminate duplication
 */

import { BaseStorageService } from '$lib/services/base-storage.service';
import type { FoodLogEntry } from '../types';

const STORE_ENTRIES = 'entries';
const STORE_IMAGES = 'images';

export interface LocalFoodLogEntry extends FoodLogEntry {
    // Offline metadata
    localId?: string; // For entries created offline (before server sync)
    syncStatus: 'synced' | 'pending' | 'failed';
    lastModified: number; // Timestamp for conflict resolution
}

export interface QueuedImage {
    entryId: string;
    blob: Blob;
    timestamp: number;
}

class FoodLogStorageServiceImpl extends BaseStorageService<LocalFoodLogEntry> {
    constructor() {
        super({
            name: 'nen_space_food_log',
            version: 1,
            stores: [
                {
                    name: STORE_ENTRIES,
                    keyPath: 'id',
                    indexes: [
                        { name: 'date', keyPath: 'date' },
                        { name: 'syncStatus', keyPath: 'syncStatus' },
                        { name: 'user', keyPath: 'user' },
                    ],
                },
                {
                    name: STORE_IMAGES,
                    keyPath: 'entryId',
                },
            ],
        });
    }

    // ========================================
    // Entry Operations (using base methods)
    // ========================================

    async saveEntry(entry: LocalFoodLogEntry): Promise<void> {
        return this.save(STORE_ENTRIES, entry);
    }

    /**
     * Save multiple entries (bulk operation)
     */
    async saveEntries(entries: LocalFoodLogEntry[]): Promise<void> {
        return this.saveMany(STORE_ENTRIES, entries);
    }

    async getEntry(id: string): Promise<LocalFoodLogEntry | null> {
        return this.getById(STORE_ENTRIES, id);
    }

    async deleteEntry(id: string): Promise<void> {
        return this.delete(STORE_ENTRIES, id);
    }

    // ========================================
    // Food Log-Specific Query Methods
    // ========================================

    /**
     * Get all entries (with optional filter by user)
     */
    async getAllEntries(userId?: string): Promise<LocalFoodLogEntry[]> {
        const entries = userId 
            ? await this.getByIndex(STORE_ENTRIES, 'user', userId)
            : await this.getAll(STORE_ENTRIES);

        // Sort by date descending
        return entries.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }

    /**
     * Get pending entries (not yet synced)
     */
    async getPendingEntries(): Promise<LocalFoodLogEntry[]> {
        return this.getByIndex(STORE_ENTRIES, 'syncStatus', 'pending');
    }

    // ========================================
    // Image Storage Operations
    // ========================================

    /**
     * Save image blob to local storage
     */
    async saveImage(entryId: string, blob: Blob): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_IMAGES], 'readwrite');
            const store = transaction.objectStore(STORE_IMAGES);
            const request = store.put({ entryId, blob, timestamp: Date.now() });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(request.error?.message || 'Save image operation failed'));
        });
    }

    /**
     * Get image blob from local storage
     */
    async getImage(entryId: string): Promise<Blob | null> {
        await this.init();
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_IMAGES], 'readonly');
            const store = transaction.objectStore(STORE_IMAGES);
            const request = store.get(entryId);

            request.onsuccess = () => {
                const result = request.result as QueuedImage | undefined;
                resolve(result?.blob || null);
            };
            request.onerror = () => reject(new Error(request.error?.message || 'Get image operation failed'));
        });
    }

    /**
     * Delete image from local storage
     */
    async deleteImage(entryId: string): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_IMAGES], 'readwrite');
            const store = transaction.objectStore(STORE_IMAGES);
            const request = store.delete(entryId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(request.error?.message || 'Delete image operation failed'));
        });
    }

    // ========================================
    // Utility Methods
    // ========================================

    /**
     * Clear all local data
     */
    async clearAll(): Promise<void> {
        await this.init();
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(
                [STORE_ENTRIES, STORE_IMAGES],
                'readwrite',
            );

            transaction.objectStore(STORE_ENTRIES).clear();
            transaction.objectStore(STORE_IMAGES).clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(new Error(transaction.error?.message || 'Clear all operation failed'));
        });
    }

    /**
     * Get storage statistics
     */
    async getStats(): Promise<{
        totalEntries: number;
        pendingEntries: number;
        cachedImages: number;
    }> {
        const [totalEntries, pendingEntries, cachedImages] = await Promise.all([
            this.getAllEntries(),
            this.getPendingEntries(),
            this.count(STORE_IMAGES),
        ]);

        return {
            totalEntries: totalEntries.length,
            pendingEntries: pendingEntries.length,
            cachedImages,
        };
    }
}

// Export singleton instance
export const FoodLogStorageService = new FoodLogStorageServiceImpl();
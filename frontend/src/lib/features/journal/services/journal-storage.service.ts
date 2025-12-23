/**
 * Journal Storage Service
 * 
 * Provides IndexedDB-based local storage for stream entries.
 * Enables offline-first functionality by caching data locally.
 * 
 * Extends BaseStorageService to eliminate duplication
 */

import { BaseStorageService } from '$lib/services/base-storage.service';
import type { LocalStreamEntry } from '../types';
import { getStartOfDay } from '../utils/date.utils';

const STORE_ENTRIES = 'entries';

class JournalStorageServiceImpl extends BaseStorageService<LocalStreamEntry> {
    constructor() {
        super({
            name: 'nen_space_journal',
            version: 1,
            stores: [
                {
                    name: STORE_ENTRIES,
                    keyPath: 'id',
                    indexes: [
                        { name: 'syncStatus', keyPath: 'syncStatus' },
                        { name: 'user', keyPath: 'user' },
                        { name: 'entryDate', keyPath: 'entry_date' },
                        { name: 'entryType', keyPath: 'entry_type' },
                        { name: 'isHighlighted', keyPath: 'is_highlighted' },
                        { name: 'parentEntry', keyPath: 'parent_entry' },
                    ],
                },
            ],
        });
    }

    // ========================================
    // Entry Operations (using base methods)
    // ========================================

    async saveEntry(entry: LocalStreamEntry): Promise<void> {
        return this.save(STORE_ENTRIES, entry);
    }

    async getAllEntries(): Promise<LocalStreamEntry[]> {
        return this.getAll(STORE_ENTRIES);
    }

    async getEntry(entryId: string): Promise<LocalStreamEntry | null> {
        return this.getById(STORE_ENTRIES, entryId);
    }

    async deleteEntry(entryId: string): Promise<void> {
        return this.delete(STORE_ENTRIES, entryId);
    }

    // ========================================
    // Entry-Specific Query Methods
    // ========================================

    /**
     * Get entries by date
     */
    async getEntriesByDate(date: Date | string): Promise<LocalStreamEntry[]> {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const allEntries = await this.getAllEntries();
        return allEntries.filter(entry => {
            const entryDate = getStartOfDay(entry.entry_date);
            return entryDate === dateStr;
        });
    }

    /**
     * Get entries by date range
     */
    async getEntriesByDateRange(startDate: Date | string, endDate: Date | string): Promise<LocalStreamEntry[]> {
        const start = typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0];
        const end = typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0];
        const allEntries = await this.getAllEntries();
        return allEntries.filter(entry => {
            const entryDate = getStartOfDay(entry.entry_date);
            return entryDate >= start && entryDate <= end;
        });
    }

    /**
     * Get entries by type
     */
    async getEntriesByType(entryType: LocalStreamEntry['entry_type']): Promise<LocalStreamEntry[]> {
        return this.getByIndex(STORE_ENTRIES, 'entryType', entryType);
    }

    /**
     * Get highlighted entries
     */
    async getHighlightedEntries(): Promise<LocalStreamEntry[]> {
        return this.getByIndex(STORE_ENTRIES, 'isHighlighted', true);
    }

    /**
     * Get entries by parent entry (threaded entries)
     */
    async getChildEntries(parentId: string): Promise<LocalStreamEntry[]> {
        return this.getByIndex(STORE_ENTRIES, 'parentEntry', parentId);
    }

    /**
     * Get pending entries (need to be synced)
     */
    async getPendingEntries(): Promise<LocalStreamEntry[]> {
        return this.getByIndex(STORE_ENTRIES, 'syncStatus', 'pending');
    }

    /**
     * Get failed entries (sync failed)
     */
    async getFailedEntries(): Promise<LocalStreamEntry[]> {
        return this.getByIndex(STORE_ENTRIES, 'syncStatus', 'failed');
    }

    /**
     * Update entry sync status
     */
    async updateEntrySyncStatus(
        entryId: string,
        status: 'synced' | 'pending' | 'failed'
    ): Promise<void> {
        const entry = await this.getEntry(entryId);
        if (!entry) return;

        entry.syncStatus = status;
        entry.lastModified = Date.now();
        await this.saveEntry(entry);
    }

    /**
     * Get all entries sorted by date (newest first)
     */
    async getAllEntriesSorted(): Promise<LocalStreamEntry[]> {
        const entries = await this.getAllEntries();
        return entries.sort((a, b) => {
            const dateA = new Date(a.entry_date).getTime();
            const dateB = new Date(b.entry_date).getTime();
            if (dateA !== dateB) {
                return dateB - dateA; // Newest first
            }
            // If same date, sort by created time
            return new Date(b.created).getTime() - new Date(a.created).getTime();
        });
    }

    /**
     * Get entry density per day for a date range
     */
    async getEntryDensity(startDate: Date, endDate: Date): Promise<Map<string, number>> {
        const entries = await this.getEntriesByDateRange(startDate, endDate);
        const density = new Map<string, number>();

        entries.forEach(entry => {
            const dateKey = getStartOfDay(entry.entry_date);
            density.set(dateKey, (density.get(dateKey) || 0) + 1);
        });

        return density;
    }

    // ========================================
    // Utility Methods
    // ========================================

    /**
     * Clear all entries (for testing or reset)
     */
    async clearAllEntries(): Promise<void> {
        return this.clear(STORE_ENTRIES);
    }

    /**
     * Get count of pending and failed entries
     */
    async getSyncCounts(): Promise<{ pending: number; failed: number }> {
        const pending = await this.getPendingEntries();
        const failed = await this.getFailedEntries();
        
        return {
            pending: pending.length,
            failed: failed.length,
        };
    }

    /**
     * Get total entry count
     */
    async getTotalCount(): Promise<number> {
        return this.count(STORE_ENTRIES);
    }
}

// Export singleton instance
export const JournalStorageService = new JournalStorageServiceImpl();


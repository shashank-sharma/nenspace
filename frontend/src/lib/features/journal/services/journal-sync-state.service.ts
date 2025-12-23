/**
 * Journal Sync State Service
 * 
 * Manages sync state storage for version-based sync.
 * Stores sync metadata in IndexedDB for offline access.
 */

import { BaseStorageService } from '$lib/services/base-storage.service';
import type { StreamSyncState } from '../types';

const STORE_SYNC_STATE = 'sync_state';

class JournalSyncStateServiceImpl extends BaseStorageService<StreamSyncState> {
    constructor() {
        super({
            name: 'nen_space_journal_sync',
            version: 1,
            stores: [
                {
                    name: STORE_SYNC_STATE,
                    keyPath: 'user',
                    indexes: [
                        { name: 'syncStatus', keyPath: 'sync_status' },
                        { name: 'deviceId', keyPath: 'device_id' },
                    ],
                },
            ],
        });
    }

    /**
     * Get sync state for a user
     * 
     * @param userId - User ID
     * @returns Sync state or null if not found
     */
    async getSyncState(userId: string): Promise<StreamSyncState | null> {
        try {
            return await this.getById(STORE_SYNC_STATE, userId);
        } catch (error) {
            // If not found, return null
            return null;
        }
    }

    /**
     * Save sync state for a user
     * 
     * @param syncState - Sync state to save
     */
    async saveSyncState(syncState: StreamSyncState): Promise<void> {
        return this.save(STORE_SYNC_STATE, syncState);
    }

    /**
     * Update sync state
     * 
     * @param userId - User ID
     * @param updates - Partial sync state updates
     */
    async updateSyncState(
        userId: string,
        updates: Partial<StreamSyncState>
    ): Promise<void> {
        const current = await this.getSyncState(userId);
        if (!current) {
            throw new Error(`Sync state not found for user: ${userId}`);
        }

        const updated: StreamSyncState = {
            ...current,
            ...updates,
            updated: new Date().toISOString(),
        };

        return this.saveSyncState(updated);
    }

    /**
     * Clear sync state for a user (reset to initial state)
     * 
     * @param userId - User ID
     */
    async clearSyncState(userId: string): Promise<void> {
        return this.delete(STORE_SYNC_STATE, userId);
    }

    /**
     * Check if there's a pending conflict
     * 
     * @param userId - User ID
     * @returns True if there's a conflict that needs resolution
     */
    async hasPendingConflict(userId: string): Promise<boolean> {
        const state = await this.getSyncState(userId);
        return state?.sync_status === 'conflicted' && 
               state?.resolution_status === 'pending';
    }
}

// Export singleton instance
export const JournalSyncStateService = new JournalSyncStateServiceImpl();


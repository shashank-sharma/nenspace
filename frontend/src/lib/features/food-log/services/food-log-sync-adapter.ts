/**
 * Food Log Sync Adapter
 * Registers Food Log with the unified sync system
 */

import { browser } from '$app/environment';
import { UnifiedSyncService } from '$lib/services/unified-sync.service.svelte';
import type { FeatureSyncService, UnifiedPendingItem } from '$lib/services/unified-sync.service.svelte';
import { FoodLogSyncService } from './food-log-sync.service.svelte';
import { FoodLogStorageService } from './food-log-storage.service';

const foodLogSyncAdapter: FeatureSyncService = {
    get syncStatus() {
        return FoodLogSyncService.syncStatus;
    },

    async getPendingItems(): Promise<UnifiedPendingItem[]> {
        const pending = await FoodLogStorageService.getPendingEntries();
        return pending
            .filter(entry => entry.syncStatus === 'pending' || entry.syncStatus === 'failed')
            .map(entry => ({
                id: entry.id,
                title: entry.name || 'Food Log Entry',
                type: 'food-log',
                category: entry.tag,
                syncStatus: entry.syncStatus as 'pending' | 'failed',
            }));
    },

    async forceSyncNow(): Promise<void> {
        await FoodLogSyncService.forceSyncNow();
    },

    async retryFailedSyncs(): Promise<void> {
        await FoodLogSyncService.retryFailedSyncs?.();
    },
};

// Auto-register on import
if (browser) {
    UnifiedSyncService.register('food-log', foodLogSyncAdapter);
}

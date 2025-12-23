/**
 * Inventory Sync Adapter
 * Registers Inventory with the unified sync system
 */

import { browser } from '$app/environment';
import { UnifiedSyncService } from '$lib/services/unified-sync.service.svelte';
import type { FeatureSyncService, UnifiedPendingItem } from '$lib/services/unified-sync.service.svelte';
import { InventorySyncService } from './inventory-sync.service.svelte';
import { InventoryStorageService } from './inventory-storage.service';

const inventorySyncAdapter: FeatureSyncService = {
    get syncStatus() {
        return InventorySyncService.syncStatus;
    },

    async getPendingItems(): Promise<UnifiedPendingItem[]> {
        const pending = await InventoryStorageService.getPendingItems();
        const failed = await InventoryStorageService.getFailedItems();
        
        return [
            ...pending.map(item => ({
                id: item.id,
                title: item.name,
                type: 'inventory',
                category: item.category,
                syncStatus: 'pending' as const,
            })),
            ...failed.map(item => ({
                id: item.id,
                title: item.name,
                type: 'inventory',
                category: item.category,
                syncStatus: 'failed' as const,
            })),
        ];
    },

    async forceSyncNow(): Promise<void> {
        await InventorySyncService.forceSyncNow();
    },

    async retryFailedSyncs(): Promise<void> {
        await InventorySyncService.retryFailedSyncs();
    },
};

if (browser) {
    UnifiedSyncService.register('inventory', inventorySyncAdapter);
}


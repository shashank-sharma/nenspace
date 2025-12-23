/**
 * Inventory Sync Service
 * 
 * Manages offline queue and automatic syncing for inventory items.
 */

import { BaseSyncService } from '$lib/services/base-sync.service.svelte';
import { InventoryStorageService } from './inventory-storage.service';
import type { LocalInventoryItem } from '../types';
import { pb } from '$lib/config/pocketbase';

class InventorySyncServiceImpl extends BaseSyncService<LocalInventoryItem> {
    protected storageService = InventoryStorageService;
    protected eventName = 'inventory-synced';

    protected async syncToServer(item: LocalInventoryItem): Promise<LocalInventoryItem> {
        const isLocalId = item.localId || item.id.startsWith('local_');

        if (isLocalId) {
            const { id, localId, syncStatus, lastModified, ...itemData } = item;
            const created = await pb.collection('inventory').create(itemData);
            
            await InventoryStorageService.deleteItem(item.id);
            
            return created as LocalInventoryItem;
        } else {
            const { syncStatus, lastModified, localId, ...itemData } = item;
            const updated = await pb.collection('inventory').update(item.id, itemData);
            return updated as LocalInventoryItem;
        }
    }

    protected getItemDescription(item: LocalInventoryItem): string {
        return `Item "${item.name}"`;
    }
}

export const InventorySyncService = new InventorySyncServiceImpl();


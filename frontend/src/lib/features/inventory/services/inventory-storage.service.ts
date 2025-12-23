/**
 * Inventory Storage Service
 * 
 * Provides IndexedDB-based local storage for inventory items.
 * Enables offline-first functionality by caching data locally.
 */

import { BaseStorageService } from '$lib/services/base-storage.service';
import type { LocalInventoryItem } from '../types';

const STORE_ITEMS = 'items';

class InventoryStorageServiceImpl extends BaseStorageService<LocalInventoryItem> {
    constructor() {
        super({
            name: 'nen_space_inventory',
            version: 1,
            stores: [
                {
                    name: STORE_ITEMS,
                    keyPath: 'id',
                    indexes: [
                        { name: 'syncStatus', keyPath: 'syncStatus' },
                        { name: 'user', keyPath: 'user' },
                        { name: 'category', keyPath: 'category' },
                        { name: 'location', keyPath: 'location' },
                        { name: 'expiration_date', keyPath: 'expiration_date' },
                    ],
                },
            ],
        });
    }

    async saveItem(item: LocalInventoryItem): Promise<void> {
        return this.save(STORE_ITEMS, item);
    }

    async getAllItems(): Promise<LocalInventoryItem[]> {
        return this.getAll(STORE_ITEMS);
    }

    async getItem(id: string): Promise<LocalInventoryItem | undefined> {
        return this.get(STORE_ITEMS, id);
    }

    async deleteItem(id: string): Promise<void> {
        return this.delete(STORE_ITEMS, id);
    }

    async getPendingItems(): Promise<LocalInventoryItem[]> {
        return this.getByIndex(STORE_ITEMS, 'syncStatus', 'pending');
    }

    async getFailedItems(): Promise<LocalInventoryItem[]> {
        return this.getByIndex(STORE_ITEMS, 'syncStatus', 'failed');
    }

    async getItemsByCategory(category: string): Promise<LocalInventoryItem[]> {
        return this.getByIndex(STORE_ITEMS, 'category', category);
    }

    async getItemsByLocation(location: string): Promise<LocalInventoryItem[]> {
        return this.getByIndex(STORE_ITEMS, 'location', location);
    }
}

export const InventoryStorageService = new InventoryStorageServiceImpl();


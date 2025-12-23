import { pb } from '$lib/config/pocketbase';
import type { InventoryItem, LocalInventoryItem, InventoryFilter } from '../types';
import { NetworkService } from '$lib/services/network.service.svelte';
import { InventoryStorageService } from './inventory-storage.service';
import { InventorySyncService } from './inventory-sync.service.svelte';
import { generateLocalId, FilterBuilder } from '$lib/utils';
import { INVENTORY_PAGE_SIZE } from '../constants';

export class InventoryService {
    static async getItems(filter?: InventoryFilter): Promise<InventoryItem[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            return [];
        }

        try {
            if (NetworkService.isOnline) {
                const filterBuilder = FilterBuilder.create()
                    .equals('user', userId);

                if (filter?.searchQuery) {
                    filterBuilder.contains('name', filter.searchQuery);
                }

                if (filter?.category) {
                    filterBuilder.equals('category', filter.category);
                }

                if (filter?.itemType) {
                    filterBuilder.equals('item_type', filter.itemType);
                }

                if (filter?.location) {
                    filterBuilder.equals('location', filter.location);
                }

                const result = await pb.collection('inventory').getList(1, INVENTORY_PAGE_SIZE * 10, {
                    sort: '-created',
                    filter: filterBuilder.build(),
                });

                const items = result.items as InventoryItem[];
                await this.cacheItems(items);
                return items;
            } else {
                const cachedItems = await InventoryStorageService.getAllItems();
                return this.filterLocalItems(cachedItems, filter);
            }
        } catch (error) {
            console.error('Error fetching items:', error);
            const cachedItems = await InventoryStorageService.getAllItems();
            return this.filterLocalItems(cachedItems, filter);
        }
    }

    private static filterLocalItems(items: LocalInventoryItem[], filter?: InventoryFilter): InventoryItem[] {
        let filtered = [...items];

        if (filter?.searchQuery) {
            const query = filter.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query)
            );
        }

        if (filter?.category) {
            filtered = filtered.filter(item => item.category === filter.category);
        }

        if (filter?.itemType) {
            filtered = filtered.filter(item => (item.item_type || 'generic') === filter.itemType);
        }

        if (filter?.location) {
            filtered = filtered.filter(item => item.location === filter.location);
        }

        if (filter?.showExpired) {
            const now = new Date();
            filtered = filtered.filter(item => {
                if (!item.expiration_date) return false;
                return new Date(item.expiration_date) < now;
            });
        }

        if (filter?.showLowQuantity) {
            filtered = filtered.filter(item => item.quantity <= 5);
        }

        return filtered.sort((a, b) => 
            new Date(b.created).getTime() - new Date(a.created).getTime()
        );
    }

    private static async cacheItems(items: InventoryItem[]): Promise<void> {
        for (const item of items) {
            await InventoryStorageService.saveItem({
                ...item,
                syncStatus: 'synced',
                lastModified: Date.now(),
            });
        }
    }

    static async createItem(data: Partial<InventoryItem>): Promise<InventoryItem> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        if (!data.name?.trim()) {
            throw new Error('Item name is required');
        }

        const itemData = {
            name: data.name.trim(),
            description: data.description?.trim() || '',
            category: data.category || 'other',
            item_type: data.item_type || 'generic',
            quantity: data.quantity ?? 1,
            unit: data.unit || '',
            location: data.location || '',
            purchase_date: data.purchase_date || '',
            purchase_price: data.purchase_price || 0,
            warranty_expiry: data.warranty_expiry || '',
            expiration_date: data.expiration_date || '',
            license_key: data.license_key || '',
            platform: data.platform || '',
            url: data.url || '',
            subscription_end: data.subscription_end || '',
            tags: data.tags || [],
            images: data.images || [],
            user: userId,
        };

        if (NetworkService.isOnline) {
            try {
                const created = await pb.collection('inventory').create(itemData);
                await InventoryStorageService.saveItem({
                    ...created,
                    syncStatus: 'synced',
                    lastModified: Date.now(),
                } as LocalInventoryItem);
                return created as InventoryItem;
            } catch (error) {
                throw error;
            }
        } else {
            const localId = generateLocalId('inventory');
            const localItem: LocalInventoryItem = {
                ...itemData,
                id: localId,
                localId,
                syncStatus: 'pending',
                lastModified: Date.now(),
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
            };
            await InventoryStorageService.saveItem(localItem);
            await InventorySyncService.queueItem(localItem);
            return localItem;
        }
    }

    static async updateItem(id: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const updateData: Partial<InventoryItem> = {};
        if (data.name !== undefined) updateData.name = data.name.trim();
        if (data.description !== undefined) updateData.description = data.description?.trim();
        if (data.category !== undefined) updateData.category = data.category;
        if (data.quantity !== undefined) updateData.quantity = data.quantity;
        if (data.unit !== undefined) updateData.unit = data.unit;
        if (data.location !== undefined) updateData.location = data.location;
        if (data.purchase_date !== undefined) updateData.purchase_date = data.purchase_date;
        if (data.purchase_price !== undefined) updateData.purchase_price = data.purchase_price;
        if (data.warranty_expiry !== undefined) updateData.warranty_expiry = data.warranty_expiry;
        if (data.expiration_date !== undefined) updateData.expiration_date = data.expiration_date;
        if (data.license_key !== undefined) updateData.license_key = data.license_key;
        if (data.platform !== undefined) updateData.platform = data.platform;
        if (data.url !== undefined) updateData.url = data.url;
        if (data.subscription_end !== undefined) updateData.subscription_end = data.subscription_end;
        if (data.tags !== undefined) updateData.tags = data.tags;
        if (data.images !== undefined) updateData.images = data.images;

        if (NetworkService.isOnline) {
            try {
                const updated = await pb.collection('inventory').update(id, updateData);
                await InventoryStorageService.saveItem({
                    ...updated,
                    syncStatus: 'synced',
                    lastModified: Date.now(),
                } as LocalInventoryItem);
                return updated as InventoryItem;
            } catch (error) {
                throw error;
            }
        } else {
            const existing = await InventoryStorageService.getItem(id);
            if (!existing) {
                throw new Error('Item not found');
            }

            const updatedItem: LocalInventoryItem = {
                ...existing,
                ...updateData,
                syncStatus: 'pending',
                lastModified: Date.now(),
                updated: new Date().toISOString(),
            };
            await InventoryStorageService.saveItem(updatedItem);
            await InventorySyncService.queueItem(updatedItem);
            return updatedItem;
        }
    }

    static async deleteItem(id: string): Promise<void> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        if (NetworkService.isOnline) {
            try {
                await pb.collection('inventory').delete(id);
                await InventoryStorageService.deleteItem(id);
            } catch (error) {
                throw error;
            }
        } else {
            const existing = await InventoryStorageService.getItem(id);
            if (existing) {
                await InventoryStorageService.deleteItem(id);
            }
        }
    }

    static async getItemsByCategory(category: string): Promise<InventoryItem[]> {
        const items = await this.getItems({ category: category as any });
        return items;
    }

    static async getExpiringItems(days: number = 7): Promise<InventoryItem[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            return [];
        }

        const now = new Date();
        const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const futureDateStr = futureDate.toISOString().split('T')[0];

        try {
            if (NetworkService.isOnline) {
                const filter = FilterBuilder.create()
                    .equals('user', userId)
                    .greaterThanOrEqual('expiration_date', now.toISOString().split('T')[0])
                    .lessThanOrEqual('expiration_date', futureDateStr)
                    .build();

                const result = await pb.collection('inventory').getList(1, 100, {
                    filter,
                    sort: 'expiration_date',
                });

                return result.items as InventoryItem[];
            } else {
                const allItems = await InventoryStorageService.getAllItems();
                return allItems
                    .filter(item => {
                        if (!item.expiration_date) return false;
                        const expDate = new Date(item.expiration_date);
                        return expDate >= now && expDate <= futureDate;
                    })
                    .sort((a, b) => {
                        const dateA = new Date(a.expiration_date || 0);
                        const dateB = new Date(b.expiration_date || 0);
                        return dateA.getTime() - dateB.getTime();
                    }) as InventoryItem[];
            }
        } catch (error) {
            console.error('Error fetching expiring items:', error);
            return [];
        }
    }

    static async getSubscriptions(): Promise<InventoryItem[]> {
        return this.getItems({ itemType: 'subscription' });
    }

    static async getExpiringWarranties(days: number = 30): Promise<InventoryItem[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            return [];
        }

        const now = new Date();
        const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const futureDateStr = futureDate.toISOString().split('T')[0];

        try {
            if (NetworkService.isOnline) {
                const filter = FilterBuilder.create()
                    .equals('user', userId)
                    .equals('item_type', 'warranty_item')
                    .greaterThanOrEqual('warranty_expiry', now.toISOString().split('T')[0])
                    .lessThanOrEqual('warranty_expiry', futureDateStr)
                    .build();

                const result = await pb.collection('inventory').getList(1, 100, {
                    filter,
                    sort: 'warranty_expiry',
                });

                return result.items as InventoryItem[];
            } else {
                const allItems = await InventoryStorageService.getAllItems();
                return allItems
                    .filter(item => {
                        if (item.item_type !== 'warranty_item') return false;
                        if (!item.warranty_expiry) return false;
                        const expDate = new Date(item.warranty_expiry);
                        return expDate >= now && expDate <= futureDate;
                    })
                    .sort((a, b) => {
                        const dateA = new Date(a.warranty_expiry || 0);
                        const dateB = new Date(b.warranty_expiry || 0);
                        return dateA.getTime() - dateB.getTime();
                    }) as InventoryItem[];
            }
        } catch (error) {
            console.error('Error fetching expiring warranties:', error);
            return [];
        }
    }

    static async getExpiringSubscriptions(days: number = 30): Promise<InventoryItem[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            return [];
        }

        const now = new Date();
        const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const futureDateStr = futureDate.toISOString().split('T')[0];

        try {
            if (NetworkService.isOnline) {
                const filter = FilterBuilder.create()
                    .equals('user', userId)
                    .equals('item_type', 'subscription')
                    .greaterThanOrEqual('subscription_end', now.toISOString().split('T')[0])
                    .lessThanOrEqual('subscription_end', futureDateStr)
                    .build();

                const result = await pb.collection('inventory').getList(1, 100, {
                    filter,
                    sort: 'subscription_end',
                });

                return result.items as InventoryItem[];
            } else {
                const allItems = await InventoryStorageService.getAllItems();
                return allItems
                    .filter(item => {
                        if (item.item_type !== 'subscription') return false;
                        if (!item.subscription_end) return false;
                        const endDate = new Date(item.subscription_end);
                        return endDate >= now && endDate <= futureDate;
                    })
                    .sort((a, b) => {
                        const dateA = new Date(a.subscription_end || 0);
                        const dateB = new Date(b.subscription_end || 0);
                        return dateA.getTime() - dateB.getTime();
                    }) as InventoryItem[];
            }
        } catch (error) {
            console.error('Error fetching expiring subscriptions:', error);
            return [];
        }
    }

    static async getDashboardStats(): Promise<{
        totalItems: number;
        totalValue: number;
        expiringSoon: number;
        activeSubscriptions: number;
        itemsByType: Record<string, number>;
        itemsByCategory: Record<string, number>;
    }> {
        const items = await this.getItems();
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const stats = {
            totalItems: items.length,
            totalValue: items.reduce((sum, item) => sum + (item.purchase_price || 0), 0),
            expiringSoon: items.filter(item => {
                if (!item.expiration_date) return false;
                const expDate = new Date(item.expiration_date);
                return expDate >= now && expDate <= sevenDaysFromNow;
            }).length,
            activeSubscriptions: items.filter(item => {
                if (item.item_type !== 'subscription') return false;
                if (!item.subscription_end) return false;
                return new Date(item.subscription_end) >= now;
            }).length,
            itemsByType: {} as Record<string, number>,
            itemsByCategory: {} as Record<string, number>,
        };

        for (const item of items) {
            const type = item.item_type || 'generic';
            stats.itemsByType[type] = (stats.itemsByType[type] || 0) + 1;
            stats.itemsByCategory[item.category] = (stats.itemsByCategory[item.category] || 0) + 1;
        }

        return stats;
    }

    static async getItemsByDateRange(startDate: string, endDate: string, dateField: 'purchase_date' | 'expiration_date' | 'subscription_end' | 'warranty_expiry'): Promise<InventoryItem[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            return [];
        }

        try {
            if (NetworkService.isOnline) {
                const filter = FilterBuilder.create()
                    .equals('user', userId)
                    .greaterThanOrEqual(dateField, startDate)
                    .lessThanOrEqual(dateField, endDate)
                    .build();

                const result = await pb.collection('inventory').getList(1, 1000, {
                    filter,
                    sort: dateField,
                });

                return result.items as InventoryItem[];
            } else {
                const allItems = await InventoryStorageService.getAllItems();
                return allItems
                    .filter(item => {
                        const dateValue = item[dateField];
                        if (!dateValue) return false;
                        const itemDate = new Date(dateValue);
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        return itemDate >= start && itemDate <= end;
                    })
                    .sort((a, b) => {
                        const dateA = new Date(a[dateField] || 0);
                        const dateB = new Date(b[dateField] || 0);
                        return dateA.getTime() - dateB.getTime();
                    }) as InventoryItem[];
            }
        } catch (error) {
            console.error('Error fetching items by date range:', error);
            return [];
        }
    }
}


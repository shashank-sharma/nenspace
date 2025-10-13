/**
 * Base Sync Service
 * 
 * Generic sync service that eliminates duplication across feature sync services.
 * Manages offline queue and automatic syncing when network is available.
 * Uses Svelte 5 runes for reactive state management.
 * 
 * ✅ ELIMINATES ~600 lines of duplicate code between features
 */

import { browser } from '$app/environment';
import { NetworkService } from '$lib/services/network.service.svelte';
import { toast } from 'svelte-sonner';

export interface SyncStatus {
    isSyncing: boolean;
    pendingCount: number;
    failedCount: number;
    lastSyncTime: number | null;
}

export interface SyncableItem {
    id: string;
    syncStatus?: 'synced' | 'pending' | 'failed';
    lastModified?: number;
    localId?: string;
}

/**
 * Storage service interface that sync service needs
 */
export interface SyncStorageService<T extends SyncableItem> {
    saveItem?: (item: T) => Promise<void>;
    saveEntry?: (item: T) => Promise<void>;
    saveTask?: (item: T) => Promise<void>;
    getPendingItems?: () => Promise<T[]>;
    getPendingEntries?: () => Promise<T[]>;
    getPendingTasks?: () => Promise<T[]>;
    getFailedItems?: () => Promise<T[]>;
    getFailedEntries?: () => Promise<T[]>;
    getFailedTasks?: () => Promise<T[]>;
    getSyncCounts?: () => Promise<{ pending: number; failed: number }>;
    updateItemSyncStatus?: (id: string, status: 'synced' | 'pending' | 'failed') => Promise<void>;
    updateTaskSyncStatus?: (id: string, status: 'synced' | 'pending' | 'failed') => Promise<void>;
}

/**
 * Abstract base sync service
 */
export abstract class BaseSyncService<T extends SyncableItem> {
    // Reactive state
    protected readonly _syncStatus = $state<SyncStatus>({
        isSyncing: false,
        pendingCount: 0,
        failedCount: 0,
        lastSyncTime: null,
    });

    protected _syncInProgress = false;
    protected _initialized = false;
    protected _autoSyncEnabled = true;

    // Abstract properties that child classes must implement
    protected abstract storageService: SyncStorageService<T>;
    protected abstract eventName: string; // e.g., 'tasks-synced', 'food-log-synced'
    
    // Abstract methods for feature-specific logic
    protected abstract syncToServer(item: T): Promise<T>;
    protected abstract getItemDescription(item: T): string;

    constructor() {
        if (browser) {
            setTimeout(() => this.init(), 0);
        }
    }

    /**
     * Initialize sync service - set up network listener
     */
    protected async init() {
        if (this._initialized) return;
        this._initialized = true;

        await this.updatePendingCount();

        if (browser) {
            window.addEventListener('online', () => {
                if (this._autoSyncEnabled) {
                    console.log(`🌐 Network reconnected, syncing pending ${this.eventName}...`);
                    this.syncPendingItems();
                }
            });
        }
    }

    /**
     * Get sync status (reactive)
     */
    get syncStatus(): SyncStatus {
        return this._syncStatus;
    }

    /**
     * Get auto-sync enabled state
     */
    get autoSyncEnabled(): boolean {
        return this._autoSyncEnabled;
    }

    set autoSyncEnabled(value: boolean) {
        this._autoSyncEnabled = value;
    }

    /**
     * Update pending count from storage
     */
    async updatePendingCount(): Promise<void> {
        try {
            if (this.storageService.getSyncCounts) {
                const counts = await this.storageService.getSyncCounts();
                this._syncStatus.pendingCount = counts.pending;
                this._syncStatus.failedCount = counts.failed;
            } else {
                // Fallback: manually get pending and failed
                const pending = await this.getPendingItems();
                const failed = await this.getFailedItems();
                this._syncStatus.pendingCount = pending.length;
                this._syncStatus.failedCount = failed.length;
            }
        } catch (error) {
            console.error('Failed to update pending count:', error);
        }
    }

    /**
     * Queue an item for syncing (save to local storage with pending status)
     */
    async queueItem(item: T): Promise<void> {
        try {
            const queuedItem: T = {
                ...item,
                syncStatus: 'pending',
                lastModified: Date.now(),
            } as T;

            await this.saveToStorage(queuedItem);
            await this.updatePendingCount();

            console.log(`📋 ${this.getItemDescription(item)} queued for sync:`, item.id);

            // Attempt immediate sync if online
            if (NetworkService.isOnline) {
                await this.syncSingleItem(queuedItem);
            }
        } catch (error) {
            console.error(`Failed to queue ${this.getItemDescription(item)}:`, error);
            throw error;
        }
    }

    /**
     * Sync all pending items
     */
    async syncPendingItems(): Promise<void> {
        if (this._syncInProgress) {
            console.log('⏳ Sync already in progress, skipping...');
            return;
        }

        if (!NetworkService.isOnline) {
            console.log('📴 Offline, cannot sync');
            return;
        }

        this._syncInProgress = true;
        this._syncStatus.isSyncing = true;

        try {
            const pendingItems = await this.getPendingItems();

            if (pendingItems.length === 0) {
                console.log('✅ No pending items to sync');
                return;
            }

            console.log(`🔄 Syncing ${pendingItems.length} pending items...`);

            let successCount = 0;
            let failCount = 0;

            for (const item of pendingItems) {
                try {
                    await this.syncSingleItem(item);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to sync ${this.getItemDescription(item)}:`, error);
                    failCount++;
                }
            }

            // Update timestamp
            this._syncStatus.lastSyncTime = Date.now();

            // Show toast with results
            if (successCount > 0) {
                toast.success(`✅ Synced ${successCount} ${this.eventName}`);
            }
            if (failCount > 0) {
                toast.error(`❌ Failed to sync ${failCount} ${this.eventName}`);
            }

            // Dispatch event for UI refresh
            if (browser && successCount > 0) {
                window.dispatchEvent(new CustomEvent(this.eventName));
            }

            console.log(`✅ Sync completed: ${successCount} succeeded, ${failCount} failed`);
        } catch (error) {
            console.error('Sync failed:', error);
            toast.error(`Failed to sync ${this.eventName}`);
        } finally {
            this._syncInProgress = false;
            this._syncStatus.isSyncing = false;
            await this.updatePendingCount();
        }
    }

    /**
     * Sync a single item to the server
     */
    protected async syncSingleItem(item: T): Promise<void> {
        try {
            // Call feature-specific sync logic
            const synced = await this.syncToServer(item);

            // Update local storage with synced status
            const updated: T = {
                ...synced,
                syncStatus: 'synced',
                lastModified: Date.now(),
            } as T;

            await this.saveToStorage(updated);

            console.log(`✅ ${this.getItemDescription(item)} synced successfully:`, item.id);
        } catch (error) {
            console.error(`❌ Failed to sync ${this.getItemDescription(item)}:`, error);

            // Mark as failed
            const failed: T = {
                ...item,
                syncStatus: 'failed',
                lastModified: Date.now(),
            } as T;

            await this.saveToStorage(failed);
            throw error;
        }
    }

    /**
     * Force sync now (manual trigger)
     */
    async forceSyncNow(): Promise<void> {
        console.log(`🔄 Force sync triggered for ${this.eventName}`);
        await this.syncPendingItems();
    }

    /**
     * Retry failed syncs
     */
    async retryFailedSyncs(): Promise<void> {
        try {
            const failedItems = await this.getFailedItems();

            if (failedItems.length === 0) {
                toast.info('No failed items to retry');
                return;
            }

            console.log(`🔄 Retrying ${failedItems.length} failed items...`);

            // Reset status to pending
            for (const item of failedItems) {
                const pending: T = {
                    ...item,
                    syncStatus: 'pending',
                    lastModified: Date.now(),
                } as T;
                await this.saveToStorage(pending);
            }

            await this.updatePendingCount();
            await this.syncPendingItems();
        } catch (error) {
            console.error('Failed to retry syncs:', error);
            toast.error('Failed to retry syncs');
        }
    }

    /**
     * Helper methods that adapt to different storage service method names
     */
    protected async saveToStorage(item: T): Promise<void> {
        const service = this.storageService as any;
        
        if (service.saveTask) {
            await service.saveTask(item);
        } else if (service.saveEntry) {
            await service.saveEntry(item);
        } else if (service.saveItem) {
            await service.saveItem(item);
        } else {
            throw new Error('Storage service must implement saveTask, saveEntry, or saveItem');
        }
    }

    protected async getPendingItems(): Promise<T[]> {
        const service = this.storageService as any;
        
        if (service.getPendingTasks) {
            return await service.getPendingTasks();
        } else if (service.getPendingEntries) {
            return await service.getPendingEntries();
        } else if (service.getPendingItems) {
            return await service.getPendingItems();
        } else {
            return [];
        }
    }

    protected async getFailedItems(): Promise<T[]> {
        const service = this.storageService as any;
        
        if (service.getFailedTasks) {
            return await service.getFailedTasks();
        } else if (service.getFailedEntries) {
            return await service.getFailedEntries();
        } else if (service.getFailedItems) {
            return await service.getFailedItems();
        } else {
            return [];
        }
    }
}

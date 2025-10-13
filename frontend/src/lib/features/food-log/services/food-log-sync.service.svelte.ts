/**
 * Food Log Sync Service
 * 
 * Manages offline queue and automatic syncing for food log entries.
 * 
 * ✅ REFACTORED: Extends BaseSyncService to eliminate duplication
 * Reduced from 327 lines → ~90 lines (72% reduction)
 */

import { BaseSyncService } from '$lib/services/base-sync.service.svelte';
import { FoodLogStorageService, type LocalFoodLogEntry } from './food-log-storage.service';
import { pb } from '$lib/config/pocketbase';

class FoodLogSyncServiceImpl extends BaseSyncService<LocalFoodLogEntry> {
    protected storageService = FoodLogStorageService;
    protected eventName = 'food-log-synced';

    /**
     * Feature-specific: Sync entry to server
     */
    protected async syncToServer(entry: LocalFoodLogEntry): Promise<LocalFoodLogEntry> {
        const isLocalId = entry.localId || entry.id.startsWith('local_');

        if (isLocalId) {
            // Create new entry on server (exclude id, localId, syncStatus, lastModified)
            const { id, localId, syncStatus, lastModified, ...entryData } = entry;
            
            // Handle image upload if present
            let formData: any = { ...entryData };
            if (entry.image) {
                // Image is a File object, upload it
                formData = new FormData();
                Object.keys(entryData).forEach(key => {
                    if (key !== 'image') {
                        formData.append(key, (entryData as any)[key]);
                    }
                });
                
                // Get image from local storage
                const imageBlob = await FoodLogStorageService.getImage(entry.id);
                if (imageBlob) {
                    formData.append('image', imageBlob, 'food.jpg');
                }
            }

            const created = await pb.collection('food_log').create(formData);
            
            // Delete local temp entry and image
            await FoodLogStorageService.deleteEntry(entry.id);
            await FoodLogStorageService.deleteImage(entry.id);
            
            return created as unknown as LocalFoodLogEntry;
        } else {
            // Update existing entry on server
            const { syncStatus, lastModified, localId, ...entryData } = entry;
            
            // Handle image update if present
            let formData: any = { ...entryData };
            if (entry.image) {
                formData = new FormData();
                Object.keys(entryData).forEach(key => {
                    if (key !== 'image') {
                        formData.append(key, (entryData as any)[key]);
                    }
                });
                
                const imageBlob = await FoodLogStorageService.getImage(entry.id);
                if (imageBlob) {
                    formData.append('image', imageBlob, 'food.jpg');
                }
            }

            const updated = await pb.collection('food_log').update(entry.id, formData);
            
            // Clean up local image if it was synced
            if (entry.image) {
                await FoodLogStorageService.deleteImage(entry.id);
            }
            
            return updated as unknown as LocalFoodLogEntry;
        }
    }

    /**
     * Feature-specific: Get human-readable description
     */
    protected getItemDescription(entry: LocalFoodLogEntry): string {
        return `Food entry "${entry.name}"`;
    }

    /**
     * Public API: Queue an entry for syncing
     */
    async queueEntry(entry: LocalFoodLogEntry): Promise<void> {
        return this.queueItem(entry);
    }

    /**
     * Override: Get failed items (Food Log doesn't have getFailedEntries)
     */
    protected async getFailedItems(): Promise<LocalFoodLogEntry[]> {
        // Food log doesn't track failed separately, filter from pending
        const pending = await FoodLogStorageService.getPendingEntries();
        return pending.filter(e => e.syncStatus === 'failed');
    }
}

// Export singleton instance
export const FoodLogSyncService = new FoodLogSyncServiceImpl();
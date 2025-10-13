/**
 * Unified Sync Service - Registry Pattern
 * 
 * Features register themselves with their sync services.
 * No manual updates needed when adding new features.
 * 
 * HOW TO ADD A NEW FEATURE:
 * 
 * 1. Create adapter file: features/my-feature/services/my-feature-sync-adapter.ts
 * 2. Implement FeatureSyncService interface
 * 3. Call UnifiedSyncService.register('my-feature', adapter) at bottom
 * 4. Import adapter in +layout.svelte
 * 5. Done! It will automatically show in GlobalSyncIndicator
 */

export interface UnifiedPendingItem {
    id: string;
    title: string;
    type: string; // Dynamic - can be any feature
    category?: string;
    syncStatus: 'pending' | 'failed';
}

export interface FeatureSyncService {
    // Required: Get current sync status
    syncStatus: {
        isSyncing: boolean;
        pendingCount: number;
        failedCount: number;
        lastSyncTime: number | null;
    };
    
    // Required: Get pending items for display
    getPendingItems: () => Promise<UnifiedPendingItem[]>;
    
    // Required: Force sync now
    forceSyncNow: () => Promise<void>;
    
    // Optional: Retry failed syncs
    retryFailedSyncs?: () => Promise<void>;
}

class UnifiedSyncServiceImpl {
    private readonly features = new Map<string, FeatureSyncService>();

    /**
     * Register a feature's sync service
     * Call this from feature initialization
     */
    register(featureName: string, service: FeatureSyncService): void {
        if (this.features.has(featureName)) {
            console.warn(`Feature "${featureName}" already registered, overwriting`);
        }
        this.features.set(featureName, service);
        console.log(`✅ Registered sync service: ${featureName}`);
    }

    /**
     * Unregister a feature (cleanup)
     */
    unregister(featureName: string): void {
        this.features.delete(featureName);
    }

    /**
     * Get aggregated sync status from all registered features
     */
    get syncStatus() {
        let isSyncing = false;
        let pendingCount = 0;
        let failedCount = 0;
        let lastSyncTime: number | null = null;

        for (const service of this.features.values()) {
            const status = service.syncStatus;
            isSyncing = isSyncing || status.isSyncing;
            pendingCount += status.pendingCount;
            failedCount += status.failedCount;
            
            if (status.lastSyncTime) {
                lastSyncTime = Math.max(lastSyncTime || 0, status.lastSyncTime);
            }
        }

        return {
            isSyncing,
            pendingCount,
            failedCount,
            lastSyncTime,
        };
    }

    /**
     * Get all pending items from all registered features
     */
    async getAllPendingItems(): Promise<UnifiedPendingItem[]> {
        const allItems: UnifiedPendingItem[] = [];

        for (const [featureName, service] of this.features) {
            try {
                const items = await service.getPendingItems();
                allItems.push(...items);
            } catch (error) {
                console.error(`Failed to get pending items from ${featureName}:`, error);
            }
        }

        return allItems;
    }

    /**
     * Force sync all registered features
     */
    async syncAll(): Promise<void> {
        const promises = Array.from(this.features.values()).map(service => 
            service.forceSyncNow()
        );

        await Promise.allSettled(promises);
    }

    /**
     * Retry all failed syncs across registered features
     */
    async retryAllFailed(): Promise<void> {
        const promises = Array.from(this.features.values())
            .filter(service => service.retryFailedSyncs)
            .map(service => service.retryFailedSyncs!());

        await Promise.allSettled(promises);
    }

    /**
     * Get list of registered features
     */
    getRegisteredFeatures(): string[] {
        return Array.from(this.features.keys());
    }
}

// Export singleton instance
export const UnifiedSyncService = new UnifiedSyncServiceImpl();
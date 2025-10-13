/**
 * Task Sync Adapter
 * Registers Tasks with the unified sync system
 */

import { browser } from '$app/environment';
import { UnifiedSyncService } from '$lib/services/unified-sync.service.svelte';
import type { FeatureSyncService, UnifiedPendingItem } from '$lib/services/unified-sync.service.svelte';
import { TaskSyncService } from './task-sync.service.svelte';
import { TaskStorageService } from './task-storage.service';

const taskSyncAdapter: FeatureSyncService = {
    get syncStatus() {
        return TaskSyncService.syncStatus;
    },

    async getPendingItems(): Promise<UnifiedPendingItem[]> {
        const pending = await TaskStorageService.getPendingTasks();
        const failed = await TaskStorageService.getFailedTasks();
        
        return [
            ...pending.map(task => ({
                id: task.id,
                title: task.title,
                type: 'task',
                category: task.category,
                syncStatus: 'pending' as const,
            })),
            ...failed.map(task => ({
                id: task.id,
                title: task.title,
                type: 'task',
                category: task.category,
                syncStatus: 'failed' as const,
            })),
        ];
    },

    async forceSyncNow(): Promise<void> {
        await TaskSyncService.forceSyncNow();
    },

    async retryFailedSyncs(): Promise<void> {
        await TaskSyncService.retryFailedSyncs();
    },
};

// Auto-register on import
if (browser) {
    UnifiedSyncService.register('tasks', taskSyncAdapter);
}

/**
 * Task Sync Service
 * 
 * Manages offline queue and automatic syncing for tasks.
 * 
 * ✅ REFACTORED: Extends BaseSyncService to eliminate duplication
 * Reduced from 327 lines → ~80 lines (75% reduction)
 */

import { BaseSyncService } from '$lib/services/base-sync.service.svelte';
import { TaskStorageService } from './task-storage.service';
import type { LocalTask } from '../types';
import { pb } from '$lib/config/pocketbase';

class TaskSyncServiceImpl extends BaseSyncService<LocalTask> {
    protected storageService = TaskStorageService;
    protected eventName = 'tasks-synced';

    /**
     * Feature-specific: Sync task to server
     */
    protected async syncToServer(task: LocalTask): Promise<LocalTask> {
        const isLocalId = task.localId || task.id.startsWith('local_');

        if (isLocalId) {
            // Create new task on server (exclude id, localId, syncStatus, lastModified)
            const { id, localId, syncStatus, lastModified, ...taskData } = task;
            const created = await pb.collection('tasks').create(taskData);
            
            // Delete local temp task
            await TaskStorageService.deleteTask(task.id);
            
            return created as LocalTask;
        } else {
            // Update existing task on server
            const { syncStatus, lastModified, localId, ...taskData } = task;
            const updated = await pb.collection('tasks').update(task.id, taskData);
            return updated as LocalTask;
        }
    }

    /**
     * Feature-specific: Get human-readable description
     */
    protected getItemDescription(task: LocalTask): string {
        return `Task "${task.title}"`;
    }

    /**
     * Public API: Queue a task for syncing
     */
    async queueTask(task: LocalTask): Promise<void> {
        return this.queueItem(task);
    }
}

// Export singleton instance
export const TaskSyncService = new TaskSyncServiceImpl();
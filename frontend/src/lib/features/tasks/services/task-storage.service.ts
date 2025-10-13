/**
 * Task Storage Service
 * 
 * Provides IndexedDB-based local storage for tasks and subtasks.
 * Enables offline-first functionality by caching data locally.
 * 
 * ✅ REFACTORED: Extends BaseStorageService to eliminate duplication
 */

import { BaseStorageService } from '$lib/services/base-storage.service';
import type { LocalTask } from '../types';

const STORE_TASKS = 'tasks';
const STORE_SUBTASKS = 'subtasks';

class TaskStorageServiceImpl extends BaseStorageService<LocalTask> {
    constructor() {
        super({
            name: 'nen_space_tasks',
            version: 1,
            stores: [
                {
                    name: STORE_TASKS,
                    keyPath: 'id',
                    indexes: [
                        { name: 'syncStatus', keyPath: 'syncStatus' },
                        { name: 'user', keyPath: 'user' },
                        { name: 'category', keyPath: 'category' },
                        { name: 'due', keyPath: 'due' },
                        { name: 'completed', keyPath: 'completed' },
                        { name: 'parent_id', keyPath: 'parent_id' },
                    ],
                },
                {
                    name: STORE_SUBTASKS,
                    keyPath: 'id',
                    indexes: [
                        { name: 'parent_id', keyPath: 'parent_id' },
                        { name: 'syncStatus', keyPath: 'syncStatus' },
                    ],
                },
            ],
        });
    }

    // ========================================
    // Task Operations (using base methods)
    // ========================================

    async saveTask(task: LocalTask): Promise<void> {
        return this.save(STORE_TASKS, task);
    }

    async getAllTasks(): Promise<LocalTask[]> {
        return this.getAll(STORE_TASKS);
    }

    async getTask(taskId: string): Promise<LocalTask | null> {
        return this.getById(STORE_TASKS, taskId);
    }

    async deleteTask(taskId: string): Promise<void> {
        return this.delete(STORE_TASKS, taskId);
    }

    // ========================================
    // Task-Specific Query Methods
    // ========================================

    /**
     * Get tasks with null or empty parent_id (main tasks, not subtasks)
     */
    async getMainTasks(): Promise<LocalTask[]> {
        const allTasks = await this.getAllTasks();
        return allTasks.filter(task => !task.parent_id || task.parent_id === '');
    }

    /**
     * Get tasks by category
     */
    async getTasksByCategory(category: string): Promise<LocalTask[]> {
        return this.getByIndex(STORE_TASKS, 'category', category);
    }

    /**
     * Get pending tasks (need to be synced)
     */
    async getPendingTasks(): Promise<LocalTask[]> {
        return this.getByIndex(STORE_TASKS, 'syncStatus', 'pending');
    }

    /**
     * Get failed tasks (sync failed)
     */
    async getFailedTasks(): Promise<LocalTask[]> {
        return this.getByIndex(STORE_TASKS, 'syncStatus', 'failed');
    }

    /**
     * Update task sync status
     */
    async updateTaskSyncStatus(
        taskId: string,
        status: 'synced' | 'pending' | 'failed'
    ): Promise<void> {
        const task = await this.getTask(taskId);
        if (!task) return;

        task.syncStatus = status;
        task.lastModified = Date.now();
        await this.saveTask(task);
    }

    // ========================================
    // Subtask Operations
    // ========================================

    async saveSubtask(subtask: LocalTask): Promise<void> {
        return this.save(STORE_SUBTASKS, subtask);
    }

    async getSubtasks(parentId: string): Promise<LocalTask[]> {
        return this.getByIndex(STORE_SUBTASKS, 'parent_id', parentId);
    }

    async deleteSubtask(subtaskId: string): Promise<void> {
        return this.delete(STORE_SUBTASKS, subtaskId);
    }

    /**
     * Get all subtasks grouped by parent_id
     */
    async getAllSubtasksGrouped(): Promise<Map<string, LocalTask[]>> {
        await this.init();
        if (!this.db) return new Map();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_SUBTASKS], 'readonly');
            const store = transaction.objectStore(STORE_SUBTASKS);
            const request = store.getAll();

            request.onsuccess = () => {
                const subtasks = request.result as LocalTask[];
                const grouped = new Map<string, LocalTask[]>();
                
                subtasks.forEach(subtask => {
                    const parentId = subtask.parent_id || '';
                    if (!grouped.has(parentId)) {
                        grouped.set(parentId, []);
                    }
                    grouped.get(parentId)!.push(subtask);
                });

                resolve(grouped);
            };
            request.onerror = () => reject(new Error(request.error?.message || 'Get all subtasks operation failed'));
        });
    }

    // ========================================
    // Utility Methods
    // ========================================

    /**
     * Clear all tasks (for testing or reset)
     */
    async clearAllTasks(): Promise<void> {
        await this.init();
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_TASKS, STORE_SUBTASKS], 'readwrite');
            
            const tasksStore = transaction.objectStore(STORE_TASKS);
            const subtasksStore = transaction.objectStore(STORE_SUBTASKS);
            
            tasksStore.clear();
            subtasksStore.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(new Error(transaction.error?.message || 'Clear tasks operation failed'));
        });
    }

    /**
     * Get count of pending and failed tasks
     */
    async getSyncCounts(): Promise<{ pending: number; failed: number }> {
        const pending = await this.getPendingTasks();
        const failed = await this.getFailedTasks();
        
        return {
            pending: pending.length,
            failed: failed.length,
        };
    }
}

// Export singleton instance
export const TaskStorageService = new TaskStorageServiceImpl();
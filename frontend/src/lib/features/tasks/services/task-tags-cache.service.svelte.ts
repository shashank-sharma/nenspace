/**
 * Task Tags Cache Service
 * 
 * Caches task tags to avoid expensive queries.
 * Invalidates on task create/update/delete.
 */

import { TaskStorageService } from './task-storage.service';
import { NetworkService } from '$lib/services/network.service.svelte';

class TaskTagsCacheServiceImpl {
    private cache: string[] | null = null;
    private cacheTimestamp: number | null = null;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    /**
     * Get all tags (with caching)
     */
    async getTags(forceRefresh = false): Promise<string[]> {
        // Check if cache is valid
        if (!forceRefresh && this.cache && this.cacheTimestamp) {
            const age = Date.now() - this.cacheTimestamp;
            if (age < this.CACHE_DURATION) {
                return this.cache;
            }
        }

        // Refresh cache
        const tags = await this.loadTags();
        this.cache = tags;
        this.cacheTimestamp = Date.now();
        return tags;
    }

    /**
     * Load tags from storage/server
     */
    private async loadTags(): Promise<string[]> {
        // Use local cache when offline, server when online
        const tasks = NetworkService.isOnline 
            ? await this.fetchTagsFromServer()
            : await this.fetchTagsFromCache();

        const allTags = new Set<string>();
        tasks.forEach(task => {
            if (task.tags && Array.isArray(task.tags)) {
                task.tags.forEach(tag => allTags.add(tag));
            }
        });

        return Array.from(allTags).sort((a, b) => a.localeCompare(b));
    }

    /**
     * Fetch tags from server (online)
     */
    private async fetchTagsFromServer(): Promise<Array<{ tags?: string[] }>> {
        // This could be optimized with a server-side distinct query
        // For now, we use the existing pattern but at least cache it
        const tasks = await TaskStorageService.getAllTasks();
        return tasks;
    }

    /**
     * Fetch tags from cache (offline)
     */
    private async fetchTagsFromCache(): Promise<Array<{ tags?: string[] }>> {
        return await TaskStorageService.getAllTasks();
    }

    /**
     * Invalidate cache (call when tasks change)
     */
    invalidate(): void {
        this.cache = null;
        this.cacheTimestamp = null;
    }

    /**
     * Add tag to cache without full refresh
     */
    addTag(tag: string): void {
        if (this.cache && !this.cache.includes(tag)) {
            this.cache = [...this.cache, tag].sort((a, b) => a.localeCompare(b));
        }
    }

    /**
     * Remove tag from cache
     */
    removeTag(tag: string): void {
        if (this.cache) {
            this.cache = this.cache.filter(t => t !== tag);
        }
    }
}

// Export singleton
export const TaskTagsCacheService = new TaskTagsCacheServiceImpl();

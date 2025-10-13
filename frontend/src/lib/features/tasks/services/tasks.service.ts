import { pb } from '$lib/config/pocketbase';
import type { Task, LocalTask } from '../types';
import { NetworkService } from '$lib/services/network.service.svelte';
import { toast } from 'svelte-sonner';
import { PAGINATION } from '../constants';
import { TaskStorageService } from './task-storage.service';
import { TaskSyncService } from './task-sync.service.svelte';
import { TaskTagsCacheService } from './task-tags-cache.service.svelte';
import { generateLocalId, FilterBuilder } from '$lib/utils';

export class TasksService {
    /**
     * Fetch tasks with optional search query
     * ✅ OFFLINE-FIRST: Returns local data when offline, syncs from server when online
     */
    static async fetchTasks(searchQuery?: string, category?: string): Promise<Task[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            return [];
        }

        try {
            // OFFLINE-FIRST: Try server first, fallback to local
            if (NetworkService.isOnline) {
                // Build filter using FilterBuilder for type safety and SQL injection prevention
                const filterBuilder = FilterBuilder.create()
                    .equals('user', userId)
                    .raw('(parent_id = null || parent_id = "")');

                // Add search query filter (searches both title and description)
                if (searchQuery?.trim()) {
                    const titleFilter = `title ~ "${filterBuilder['escape'](searchQuery)}"`;
                    const descFilter = `description ~ "${filterBuilder['escape'](searchQuery)}"`;
                    filterBuilder.or(titleFilter, descFilter);
                }

                // Add category filter
                if (category?.trim()) {
                    filterBuilder.equals('category', category);
                }

                const filter = filterBuilder.build();
                const resultList = await pb.collection("tasks").getList(1, PAGINATION.TASKS_DEFAULT, {
                    sort: "-created",
                    filter,
                });

                // Cache tasks locally for offline access
                const tasks = resultList.items as Task[];
                await this.cacheTasks(tasks);

                return tasks;
            } else {
                // Offline: Return cached data
                console.log('📱 Offline mode: loading tasks from cache');
                let cachedTasks = await TaskStorageService.getMainTasks();

                // Apply client-side filtering if needed
                if (searchQuery?.trim()) {
                    const query = searchQuery.toLowerCase();
                    cachedTasks = cachedTasks.filter(task => 
                        task.title.toLowerCase().includes(query) || 
                        task.description?.toLowerCase().includes(query)
                    );
                }

                if (category?.trim()) {
                    cachedTasks = cachedTasks.filter(task => task.category === category);
                }

                return cachedTasks as Task[];
            }
        } catch (error) {
            console.error('Failed to fetch tasks from server, using cache:', error);
            // Fallback to cache on error
            const cachedTasks = await TaskStorageService.getMainTasks();
            return cachedTasks as Task[];
        }
    }

    /**
     * Cache tasks locally for offline access
     */
    private static async cacheTasks(tasks: Task[]): Promise<void> {
        try {
            for (const task of tasks) {
                await TaskStorageService.saveTask({
                    ...task,
                    syncStatus: 'synced',
                    lastModified: Date.now(),
                });
            }
        } catch (error) {
            console.error('Failed to cache tasks:', error);
        }
    }

    /**
     * Create a new task
     * ✅ OFFLINE-FIRST: Creates locally with temp ID if offline, syncs when online
     */
    static async createTask(data: Partial<Task>): Promise<Task> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        try {
            const taskData = {
                title: data.title?.trim() || '',
                description: data.description?.trim() || '',
                category: data.category || 'focus',
                completed: data.completed || false,
                priority: data.priority || 1,
                reminder: data.reminder || false,
                due: data.due || '',
                parent_id: data.parent_id || null,
                tags: data.tags || [],
                recurrence_frequency: data.recurrence_frequency || 'none',
                recurrence_interval: data.recurrence_interval || 1,
                recurrence_until: data.recurrence_until || null,
                user: userId,
            };

            if (NetworkService.isOnline) {
                // Online: Create on server and cache
                const created = await pb.collection("tasks").create(taskData);
                
                // Cache locally
                await TaskStorageService.saveTask({
                    ...(created as any),
                    syncStatus: 'synced',
                    lastModified: Date.now(),
                });

                // Invalidate tags cache
                if (taskData.tags && taskData.tags.length > 0) {
                    TaskTagsCacheService.invalidate();
                }

                toast.success('Task created successfully');
                return created as Task;
            } else {
                // Offline: Create with temp ID and queue for sync
                const localId = generateLocalId();
                const localTask: LocalTask = {
                    ...taskData,
                    id: localId,
                    localId,
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    collectionId: '',
                    collectionName: 'tasks',
                    syncStatus: 'pending',
                    lastModified: Date.now(),
                };

                await TaskSyncService.queueTask(localTask);
                // Invalidate tags cache
                if (localTask.tags && localTask.tags.length > 0) {
                    TaskTagsCacheService.invalidate();
                }

                toast.info('Task saved offline. Will sync when online.');
                return localTask as Task;
            }
        } catch (error) {
            console.error('Failed to create task:', error);
            toast.error('Failed to create task');
            throw error;
        }
    }

    /**
     * Update an existing task
     * ✅ OFFLINE-FIRST: Updates locally first, syncs when online
     */
    static async updateTask(taskId: string, data: Partial<Task>): Promise<Task> {
        try {
            // Get existing task from cache
            const existingTask = await TaskStorageService.getTask(taskId);
            if (!existingTask) {
                throw new Error('Task not found');
            }

            // Merge updates
            const updatedTask: LocalTask = {
                ...existingTask,
                ...data,
                syncStatus: NetworkService.isOnline ? 'synced' : 'pending',
                lastModified: Date.now(),
            };

            if (NetworkService.isOnline) {
                // Online: Update on server and cache
                const serverUpdated = await pb.collection("tasks").update(taskId, data);
                
                await TaskStorageService.saveTask({
                    ...(serverUpdated as any),
                    syncStatus: 'synced',
                    lastModified: Date.now(),
                });

                // Invalidate tags cache if tags changed
                if (data.tags) {
                    TaskTagsCacheService.invalidate();
                }

                toast.success('Task updated successfully');
                return serverUpdated as Task;
            } else {
                // Offline: Update locally and queue for sync
                await TaskSyncService.queueTask(updatedTask);
                toast.info('Task updated offline. Will sync when online.');
                return updatedTask as Task;
            }
        } catch (error) {
            console.error('Failed to update task:', error);
            toast.error('Failed to update task');
            throw error;
        }
    }

    /**
     * Delete a task
     * ✅ OFFLINE-FIRST: Deletes locally, syncs deletion when online
     */
    static async deleteTask(taskId: string): Promise<void> {
        try {
            await TaskSyncService.queueTaskDeletion(taskId);
            toast.success('Task deleted successfully');
        } catch (error) {
            console.error('Failed to delete task:', error);
            toast.error('Failed to delete task');
            throw error;
        }
    }

    /**
     * Fetch subtasks for a parent task
     * ✅ OFFLINE-FIRST: Returns cached subtasks when offline
     */
    static async fetchSubtasks(parentId: string): Promise<Task[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            return [];
        }

        try {
            if (NetworkService.isOnline) {
                const filter = `user = "${userId}" && parent_id = "${parentId}"`;
                const resultList = await pb.collection("tasks").getList(1, PAGINATION.SUBTASKS_PER_PARENT, {
                    sort: "created",
                    filter,
                });

                // Cache subtasks
                const subtasks = resultList.items as Task[];
                for (const subtask of subtasks) {
                    await TaskStorageService.saveSubtask({
                        ...subtask,
                        syncStatus: 'synced',
                        lastModified: Date.now(),
                    });
                }

                return subtasks;
            } else {
                // Offline: Return cached subtasks
                const cachedSubtasks = await TaskStorageService.getSubtasks(parentId);
                return cachedSubtasks as Task[];
            }
        } catch (error) {
            console.error('Failed to fetch subtasks:', error);
            // Fallback to cache
            const cachedSubtasks = await TaskStorageService.getSubtasks(parentId);
            return cachedSubtasks as Task[];
        }
    }

    /**
     * Fetch ALL subtasks for user (efficient single query)
     * Returns a map of parent_id -> subtasks[]
     * ✅ OFFLINE-FIRST: Returns cached subtasks when offline
     */
    static async fetchAllSubtasksGrouped(): Promise<Map<string, Task[]>> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            return new Map();
        }

        try {
            if (NetworkService.isOnline) {
                // Single query: get ALL tasks that have a parent (are subtasks)
                const filter = `user = "${userId}" && parent_id != null && parent_id != ""`;
                const resultList = await pb.collection("tasks").getList(1, PAGINATION.SUBTASKS_MAX, {
                    sort: "created",
                    filter,
                });

                // Group by parent_id
                const grouped = new Map<string, Task[]>();
                for (const subtask of resultList.items) {
                    const task = subtask as any;
                    const parentId = task.parent_id;
                    if (!grouped.has(parentId)) {
                        grouped.set(parentId, []);
                    }
                    grouped.get(parentId)!.push(task as Task);

                    // Cache subtask
                    await TaskStorageService.saveSubtask({
                        ...task,
                        syncStatus: 'synced',
                        lastModified: Date.now(),
                    });
                }

                return grouped;
            } else {
                // Offline: Return cached subtasks
                const cachedGrouped = await TaskStorageService.getAllSubtasksGrouped();
                return cachedGrouped as Map<string, Task[]>;
            }
        } catch (error) {
            console.error('Failed to fetch subtasks:', error);
            // Fallback to cache
            const cachedGrouped = await TaskStorageService.getAllSubtasksGrouped();
            return cachedGrouped as Map<string, Task[]>;
        }
    }

    /**
     * Create a subtask
     * ✅ OFFLINE-FIRST: Creates locally with temp ID if offline
     */
    static async createSubtask(parentId: string, title: string): Promise<Task> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        try {
            if (NetworkService.isOnline) {
                // Get parent task to inherit category
                const parent = await pb.collection("tasks").getOne(parentId);

                const subtaskData = {
                    title: title.trim(),
                    description: '',
                    category: parent.category,
                    completed: false,
                    priority: 1,
                    reminder: false,
                    parent_id: parentId,
                    user: userId,
                };

                const created = await pb.collection("tasks").create(subtaskData);
                
                // Cache subtask
                await TaskStorageService.saveSubtask({
                    ...(created as any),
                    syncStatus: 'synced',
                    lastModified: Date.now(),
                });

                return created as Task;
            } else {
                // Offline: Get parent from cache
                const parent = await TaskStorageService.getTask(parentId);
                if (!parent) {
                    throw new Error('Parent task not found');
                }

                const localId = generateLocalId();
                const localSubtask: LocalTask = {
                    id: localId,
                    localId,
                    title: title.trim(),
                    description: '',
                    category: parent.category,
                    completed: false,
                    priority: 1,
                    reminder: false,
                    due: '',
                    parent_id: parentId,
                    tags: [],
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    user: userId,
                    collectionId: '',
                    collectionName: 'tasks',
                    syncStatus: 'pending',
                    lastModified: Date.now(),
                };

                await TaskStorageService.saveSubtask(localSubtask);
                await TaskSyncService.queueTask(localSubtask);
                
                toast.info('Subtask saved offline. Will sync when online.');
                return localSubtask as Task;
            }
        } catch (error) {
            console.error('Failed to create subtask:', error);
            toast.error('Failed to create subtask');
            throw error;
        }
    }

    /**
     * Complete a task (and handle recurring logic)
     * ✅ OFFLINE-FIRST: Marks complete locally, syncs when online
     */
    static async completeTask(task: Task): Promise<Task> {
        try {
            // Mark current task as completed
            const updated = await this.updateTask(task.id, { completed: true });

            // If task has recurrence (not 'none'), create next instance
            if (task.recurrence_frequency && task.recurrence_frequency !== 'none') {
                await this.createRecurringInstance(task);
            }

            return updated;
        } catch (error) {
            console.error('Failed to complete task:', error);
            toast.error('Failed to complete task');
            throw error;
        }
    }

    /**
     * Create next instance of a recurring task
     */
    private static async createRecurringInstance(completedTask: Task): Promise<void> {
        if (!completedTask.recurrence_frequency || completedTask.recurrence_frequency === 'none') {
            return;
        }

        const nextDueDate = this.calculateNextDueDate(
            completedTask.due || new Date().toISOString(),
            completedTask.recurrence_frequency,
            completedTask.recurrence_interval || 1
        );

        // Check if we've passed the "until" date
        if (completedTask.recurrence_until) {
            const untilDate = new Date(completedTask.recurrence_until);
            if (nextDueDate > untilDate) {
                return; // Don't create more instances
            }
        }

        try {
            const userId = pb.authStore.model?.id;
            if (!userId) return;

            const newTaskData = {
                title: completedTask.title,
                description: completedTask.description,
                category: completedTask.category,
                completed: false,
                priority: completedTask.priority,
                reminder: completedTask.reminder,
                due: nextDueDate.toISOString(),
                recurrence_frequency: completedTask.recurrence_frequency,
                recurrence_interval: completedTask.recurrence_interval || 1,
                recurrence_until: completedTask.recurrence_until || null,
                // Preserve original recurrence parent through the chain
                recurrence_parent: completedTask.recurrence_parent || completedTask.id,
                tags: completedTask.tags || [],
            };

            await this.createTask(newTaskData);
            toast.success('Next recurring task created');
        } catch (error) {
            console.error('Failed to create recurring instance:', error);
        }
    }

    /**
     * Calculate next due date for recurring task
     */
    private static calculateNextDueDate(
        currentDue: string,
        frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
        interval: number
    ): Date {
        const current = new Date(currentDue);
        const next = new Date(current);

        switch (frequency) {
            case 'daily':
                next.setDate(next.getDate() + interval);
                break;
            case 'weekly':
                next.setDate(next.getDate() + (interval * 7));
                break;
            case 'monthly':
                next.setMonth(next.getMonth() + interval);
                break;
            case 'yearly':
                next.setFullYear(next.getFullYear() + interval);
                break;
        }

        return next;
    }

    /**
     * Get all unique tags from user's tasks
     * ✅ CACHED: Uses TaskTagsCacheService for performance
     */
    static async getAllTags(forceRefresh = false): Promise<string[]> {
        return await TaskTagsCacheService.getTags(forceRefresh);
    }

    /**
     * Batch create tasks (optimization for bulk operations)
     */
    static async createTasks(tasksData: Partial<Task>[]): Promise<Task[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const createdTasks: Task[] = [];

        if (NetworkService.isOnline) {
            // Online: Create all on server
            for (const data of tasksData) {
                const task = await this.createTask(data);
                createdTasks.push(task);
            }
        } else {
            // Offline: Create all locally with temp IDs
            const localTasks: LocalTask[] = tasksData.map(data => {
                const localId = generateLocalId();
                return {
                    ...data,
                    id: localId,
                    localId,
                    title: data.title?.trim() || '',
                    description: data.description?.trim() || '',
                    category: data.category || 'focus',
                    completed: data.completed || false,
                    priority: data.priority || 1,
                    reminder: data.reminder || false,
                    due: data.due || '',
                    parent_id: data.parent_id || null,
                    tags: data.tags || [],
                    recurrence_frequency: data.recurrence_frequency || 'none',
                    recurrence_interval: data.recurrence_interval || 1,
                    recurrence_until: data.recurrence_until || null,
                    user: userId,
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    collectionId: '',
                    collectionName: 'tasks',
                    syncStatus: 'pending',
                    lastModified: Date.now(),
                } as LocalTask;
            });

            // Queue all for sync
            for (const task of localTasks) {
                await TaskSyncService.queueTask(task);
                createdTasks.push(task as Task);
            }

            toast.info(`${createdTasks.length} tasks saved offline`);
        }

        // Invalidate tags cache
        TaskTagsCacheService.invalidate();

        return createdTasks;
    }
}
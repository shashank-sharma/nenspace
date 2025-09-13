import { writable } from 'svelte/store';
import type { Task, TaskState } from '../types';
import { pb } from '$lib/config/pocketbase';
import { toast } from 'svelte-sonner';

const createTasksStore = () => {
    const { subscribe, set, update } = writable<TaskState>({
        tasks: [],
        isLoading: false,
        error: null,
        selectedTask: null,
        searchQuery: ''
    });

    return {
        subscribe,
        setSelectedTask: (task: Task | null) => update(state => ({ ...state, selectedTask: task })),
        
        setTasks: (tasks: Task[]) => update(state => ({ ...state, tasks })),
        
        async fetchTasks(query?: string) {
            update(state => ({ ...state, isLoading: true }));
            try {
                const filterConditions = [`user = "${pb.authStore.model?.id}"`];
                if (query) {
                    filterConditions.push(`(title ~ "${query}" || description ~ "${query}")`);
                }
                const resultList = await pb.collection('tasks').getList(1, 50, {
                    filter: filterConditions.join(" && "),
                    sort: '-created'
                });
                update(state => ({ ...state, tasks: resultList.items }));
            } catch (error) {
                toast.error("Failed to fetch tasks");
            } finally {
                update(state => ({ ...state, isLoading: false }));
            }
        },

        async updateTask(task: Task) {
            try {
                await pb.collection('tasks').update(task.id, task);
                this.fetchTasks();
                toast.success("Task updated");
            } catch (error) {
                toast.error("Failed to update task");
            }
        },

        async deleteTask(taskId: string) {
            try {
                await pb.collection('tasks').delete(taskId);
                this.fetchTasks();
                toast.success("Task deleted");
            } catch (error) {
                toast.error("Failed to delete task");
            }
        },

        async createTask(taskData: Partial<Task>) {
            try {
                await pb.collection('tasks').create({
                    ...taskData,
                    user: pb.authStore.model?.id
                });
                this.fetchTasks();
                toast.success("Task created");
            } catch (error) {
                toast.error("Failed to create task");
            }
        }
    };
};

export const tasksStore = createTasksStore();
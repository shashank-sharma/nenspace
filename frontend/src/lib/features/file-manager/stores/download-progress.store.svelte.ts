import { pb } from '$lib/config/pocketbase';

export interface DownloadTask {
    id: string;
    filename: string;
    progress: number;
    status: 'preparing' | 'downloading' | 'completed' | 'error';
    bytesDownloaded: number;
    totalBytes?: number;
    errorMessage?: string;
}

class DownloadProgressStore {
    tasks = $state<DownloadTask[]>([]);

    addTask(task: DownloadTask) {
        this.tasks = [...this.tasks, task];
    }

    updateTask(id: string, updates: Partial<DownloadTask>) {
        this.tasks = this.tasks.map(t => t.id === id ? { ...t, ...updates } : t);
    }

    removeTask(id: string) {
        this.tasks = this.tasks.filter(t => t.id !== id);
    }

    clearCompleted() {
        this.tasks = this.tasks.filter(t => t.status !== 'completed' && t.status !== 'error');
    }
}

export const downloadProgressStore = new DownloadProgressStore();


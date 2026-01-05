export interface UploadTask {
    id: string;
    filename: string;
    progress: number;
    status: 'preparing' | 'uploading' | 'completed' | 'error';
    bytesUploaded: number;
    totalBytes: number;
    errorMessage?: string;
}

class UploadProgressStore {
    tasks = $state<UploadTask[]>([]);

    addTask(task: UploadTask) {
        this.tasks = [...this.tasks, task];
    }

    updateTask(id: string, updates: Partial<UploadTask>) {
        this.tasks = this.tasks.map(t => t.id === id ? { ...t, ...updates } : t);
    }

    removeTask(id: string) {
        this.tasks = this.tasks.filter(t => t.id !== id);
    }

    clearCompleted() {
        this.tasks = this.tasks.filter(t => t.status !== 'completed' && t.status !== 'error');
    }
}

export const uploadProgressStore = new UploadProgressStore();


export interface Task {
    id: string;
    title: string;
    description: string;
    category: string;
    completed: boolean;
    priority: number; // 1=Low, 2=Medium, 3=High
    due?: string;
    reminder: boolean;
    created: string;
    updated: string;
    user: string;
    collectionId: string;
    collectionName: string;
    // New fields
    parent_id?: string | null;
    tags?: string[];
    // Recurrence fields (separate columns for queryability)
    recurrence_frequency?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    recurrence_interval?: number;
    recurrence_until?: string | null;
    recurrence_parent?: string | null;
}

/**
 * Extended Task interface with offline metadata
 */
export interface LocalTask extends Task {
    localId?: string; // Temporary ID for tasks created offline (before server sync)
    syncStatus?: 'synced' | 'pending' | 'failed';
    lastModified?: number; // Timestamp for conflict resolution
}

export interface Category {
    value: string;
    label: string;
    color: string;
}

export interface TaskState {
    tasks: Task[];
    isLoading: boolean;
    error: string | null;
    selectedTask: Task | null;
    searchQuery: string;
}

export interface TaskFilter {
    searchQuery?: string;
    priority?: number | null;
    dueDate?: 'today' | 'week' | 'overdue' | null;
    status?: 'active' | 'completed' | null;
    category?: string | null;
    sortBy?: 'title' | 'priority' | 'due' | 'category' | null;
    sortOrder?: 'asc' | 'desc';
}

export interface TaskStats {
    total: number;
    completed: number;
    dueToday: number;
    overdue: number;
    highPriority: number;
    completionRate: number;
}

/**
 * Sync status for reactive state management
 */
export interface SyncStatus {
    isSyncing: boolean;
    pendingCount: number;
    failedCount: number;
    lastSyncTime: number | null;
}
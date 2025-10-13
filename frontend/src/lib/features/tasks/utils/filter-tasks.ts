import type { Task, TaskFilter } from '../types';

/**
 * Check if task matches search query
 */
function matchesSearchQuery(task: Task, searchQuery?: string): boolean {
    if (!searchQuery?.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const matchesTitle = task.title.toLowerCase().includes(query);
    const matchesDescription = task.description?.toLowerCase().includes(query);
    return matchesTitle || matchesDescription;
}

/**
 * Check if task matches priority filter
 */
function matchesPriority(task: Task, priority?: number | null): boolean {
    if (priority === null || priority === undefined) return true;
    // Treat undefined/null task priority as 1 (Low)
    const taskPriority = task.priority ?? 1;
    return taskPriority === priority;
}

/**
 * Check if task matches status filter
 */
function matchesStatus(task: Task, status?: 'active' | 'completed' | null): boolean {
    if (!status) return true;
    if (status === 'active') return !task.completed;
    if (status === 'completed') return task.completed;
    return true;
}

/**
 * Get date without time component
 */
function getDateOnly(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Check if task matches due date filter
 */
function matchesDueDate(task: Task, dueDateFilter?: 'today' | 'week' | 'overdue' | null): boolean {
    if (!dueDateFilter || !task.due) return true;
    
    const now = new Date();
    const today = getDateOnly(now);
    const dueDate = new Date(task.due);
    const dueDateOnly = getDateOnly(dueDate);
    
    if (dueDateFilter === 'overdue') {
        return !task.completed && dueDate < now;
    }
    
    if (dueDateFilter === 'today') {
        return dueDateOnly.getTime() === today.getTime();
    }
    
    if (dueDateFilter === 'week') {
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return dueDate <= weekFromNow && dueDate >= today;
    }
    
    return true;
}

/**
 * Check if task matches category filter
 */
function matchesCategory(task: Task, category?: string | null): boolean {
    if (!category) return true;
    return task.category === category;
}

/**
 * Filter tasks based on criteria
 */
export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
    return tasks.filter(task => {
        return matchesSearchQuery(task, filter.searchQuery)
            && matchesPriority(task, filter.priority)
            && matchesStatus(task, filter.status)
            && matchesDueDate(task, filter.dueDate)
            && matchesCategory(task, filter.category);
    });
}

/**
 * Calculate task statistics
 */
export function calculateStats(tasks: Task[]) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const completed = tasks.filter(t => t.completed).length;
    const total = tasks.length;

    const dueToday = tasks.filter(task => {
        if (!task.due || task.completed) return false;
        const dueDate = new Date(task.due);
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        return dueDateOnly.getTime() === today.getTime();
    }).length;

    const overdue = tasks.filter(task => {
        if (!task.due || task.completed) return false;
        return new Date(task.due) < now;
    }).length;

    const highPriority = tasks.filter(task => 
        !task.completed && task.priority === 3
    ).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
        total,
        completed,
        dueToday,
        overdue,
        highPriority,
        completionRate
    };
}


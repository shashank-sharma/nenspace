import type { Task } from '../types';

/**
 * Sort tasks by the specified column and order
 */
export function sortTasks(
    tasks: Task[],
    sortBy: 'title' | 'priority' | 'due' | 'category' | null,
    sortOrder: 'asc' | 'desc' = 'asc'
): Task[] {
    if (!sortBy) return tasks;

    const sorted = [...tasks].sort((a, b) => {
        let compareResult = 0;

        switch (sortBy) {
            case 'title':
                compareResult = a.title.localeCompare(b.title);
                break;
            
            case 'priority':
                compareResult = (b.priority || 0) - (a.priority || 0); // Higher priority first by default
                break;
            
            case 'category':
                compareResult = a.category.localeCompare(b.category);
                break;
            
            case 'due':
                // Handle null/undefined dates - push to end
                if (!a.due && !b.due) {
                    compareResult = 0;
                } else if (!a.due) {
                    compareResult = 1;
                } else if (!b.due) {
                    compareResult = -1;
                } else {
                    const dateA = new Date(a.due).getTime();
                    const dateB = new Date(b.due).getTime();
                    compareResult = dateA - dateB;
                }
                break;
        }

        return sortOrder === 'asc' ? compareResult : -compareResult;
    });

    return sorted;
}

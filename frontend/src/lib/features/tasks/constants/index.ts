import type { Category } from "../types";

export const categories: Category[] = [
    {
        value: "backend",
        label: "Backend",
        color: "bg-primary/10",
    },
    {
        value: "frontend",
        label: "Frontend",
        color: "bg-secondary/10",
    },
    {
        value: "general",
        label: "General",
        color: "bg-accent/10",
    },
    {
        value: "archive",
        label: "Archive",
        color: "bg-muted/10",
    },
];

export const categoryTextColors: Record<string, string> = {
    backend: "text-primary",
    frontend: "text-secondary",
    general: "text-accent",
    archive: "text-muted-foreground",
};

export const categoryBorderColors: Record<string, string> = {
    backend: "border-l-primary",
    frontend: "border-l-secondary",
    general: "border-l-accent",
    archive: "border-l-muted",
};

export const categoryAccentColors: Record<string, string> = {
    backend: "from-primary to-primary/70",
    frontend: "from-secondary to-secondary/70",
    general: "from-accent to-accent/70",
    archive: "from-muted to-muted/70",
};

export const KEYBOARD_SHORTCUTS = {
    NEW_TASK: 'n',
    SEARCH: '/',
    COMPLETE: 'c',
    EDIT: 'e',
    DELETE: 'Backspace',
    HELP: '?',
} as const;

export const PRIORITY_LABELS = {
    1: 'Low',
    2: 'Medium',
    3: 'High',
} as const;

// Priority badge configurations (shared across components)
export const PRIORITY_CONFIG: Record<number, { label: string; color: string }> = {
    1: {
        label: "Low",
        color: "bg-muted text-muted-foreground",
    },
    2: {
        label: "Medium",
        color: "bg-secondary/20 text-secondary-foreground dark:text-secondary",
    },
    3: {
        label: "High",
        color: "bg-primary/20 text-primary",
    },
};

// Status/Category badge colors (shared across components)
export const STATUS_COLORS: Record<string, string> = {
    backend: "bg-primary/20 text-primary",
    frontend: "bg-secondary/20 text-secondary-foreground dark:text-secondary",
    general: "bg-accent/20 text-accent",
    archive: "bg-muted text-muted-foreground",
};

// API Pagination constants
export const PAGINATION = {
    TASKS_DEFAULT: 100,
    SUBTASKS_MAX: 500,
    SUBTASKS_PER_PARENT: 50,
} as const;

// Recurrence display helper
export function getRecurrenceLabel(frequency?: string, interval?: number): string {
    if (!frequency || frequency === 'none') return "";
    
    const freq = frequency as 'daily' | 'weekly' | 'monthly' | 'yearly';
    const int = interval || 1;
    
    if (int === 1) {
        return `Repeats ${freq}`;
    }
    
    const unit = {
        daily: "days",
        weekly: "weeks",
        monthly: "months",
        yearly: "years"
    }[freq];
    
    return `Every ${int} ${unit}`;
}

// Priority badge helper with fallback
export function getPriorityConfig(priority?: number): { label: string; color: string } {
    return PRIORITY_CONFIG[priority || 1] || PRIORITY_CONFIG[1];
}
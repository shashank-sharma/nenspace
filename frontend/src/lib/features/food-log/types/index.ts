export interface FoodLogEntry {
    id: string;
    user: string;
    name: string;
    image: string;
    tag: string;
    date: string;
    created: string;
    updated: string;
}

export interface LocalFoodLogEntry extends FoodLogEntry {
    // Offline metadata
    localId?: string; // For entries created offline (before server sync)
    syncStatus?: 'synced' | 'pending' | 'failed';
    lastModified?: number; // Timestamp for conflict resolution
}

export interface FoodLogState {
    entries: FoodLogEntry[];
    isLoading: boolean;
    hasMore: boolean;
    page: number;
    totalItems: number;
    filter: FoodLogFilter;
}

export interface FoodLogFilter {
    date?: string;
    tag?: string;
    searchTerm?: string;
}

export interface FoodLogFormData {
    name: string;
    tag: string;
    image?: File;
    date: string;
}

export const DEFAULT_FOOD_LOG_FORM: FoodLogFormData = {
    name: '',
    tag: 'breakfast',
    image: undefined,
    date: new Date().toISOString()
};

export const FOOD_TAGS = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'dinner', label: 'Dinner' },
    { value: 'snack', label: 'Snack' },
    { value: 'dessert', label: 'Dessert' },
    { value: 'drink', label: 'Drink' }
] as const; 

export function formatTag(tag: string): string {
    if (!tag) return 'Unknown';
    return tag
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

export function formatDateGroup(dateString: string): string {
    if (!dateString || dateString === 'unknown') return 'Unknown Date';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        const now = new Date();
        const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        if (isSameDay(date, now)) return 'Today';
        if (isSameDay(date, yesterday)) return 'Yesterday';
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return 'Unknown Date';
    }
}

export function formatTime(dateString: string): string {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Time';
        return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch {
        return 'Invalid Time';
    }
}

export function groupEntriesByDate(entries: FoodLogEntry[]): Record<string, FoodLogEntry[]> {
    const groups: Record<string, FoodLogEntry[]> = {};
    for (const entry of entries) {
        const key = (() => {
            const source = entry.date || entry.created;
            try {
                const d = new Date(source);
                if (isNaN(d.getTime())) return 'unknown';
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            } catch {
                return 'unknown';
            }
        })();
        if (!groups[key]) groups[key] = [];
        groups[key].push(entry);
    }
    return groups;
}
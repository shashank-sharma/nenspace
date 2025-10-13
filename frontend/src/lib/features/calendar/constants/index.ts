/**
 * Calendar Feature Constants
 * Centralized configuration and magic numbers
 */

export const CALENDAR_PAGE_SIZE = 100;
export const CALENDAR_REFRESH_INTERVAL = 60000; // 60 seconds
export const MAX_CALENDAR_NAME_LENGTH = 100;

export const CALENDAR_VIEWS = {
    MONTH: 'month',
    WEEK: 'week',
    DAY: 'day',
} as const;

export const CALENDAR_TYPES = [
    { value: 'primary', label: 'Primary' },
    { value: 'secondary', label: 'Secondary' },
] as const;

export const SYNC_STATUS = {
    IDLE: 'idle',
    IN_PROGRESS: 'in_progress',
    SUCCESS: 'success',
    ERROR: 'error',
} as const;

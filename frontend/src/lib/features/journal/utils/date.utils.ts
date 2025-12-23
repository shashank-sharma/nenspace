/**
 * Date utility functions for Stream journaling
 */

import type { LocalStreamEntry } from '../types';

/**
 * Get default timezone (browser timezone)
 * Callers should pass timezone from SettingsService.account.timezone when available
 */
function getDefaultTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get current date in user's timezone as YYYY-MM-DD string
 */
export function getCurrentDateInTimezone(timezone?: string): string {
    const tz = timezone || getDefaultTimezone();
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(now);
}

/**
 * Get current datetime in user's timezone as ISO string
 */
export function getCurrentDateTimeInTimezone(timezone?: string): string {
    const tz = timezone || getDefaultTimezone();
    const now = new Date();
    // Format as ISO but in user's timezone
    const year = new Intl.DateTimeFormat('en', { timeZone: tz, year: 'numeric' }).format(now);
    const month = new Intl.DateTimeFormat('en', { timeZone: tz, month: '2-digit' }).format(now);
    const day = new Intl.DateTimeFormat('en', { timeZone: tz, day: '2-digit' }).format(now);
    const hour = new Intl.DateTimeFormat('en', { timeZone: tz, hour: '2-digit', hour12: false }).format(now);
    const minute = new Intl.DateTimeFormat('en', { timeZone: tz, minute: '2-digit' }).format(now);
    const second = new Intl.DateTimeFormat('en', { timeZone: tz, second: '2-digit' }).format(now);
    
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

/**
 * Convert a date to user's timezone and return as YYYY-MM-DD string
 */
export function toDateStringInTimezone(date: Date | string, timezone?: string): string {
    const tz = timezone || getDefaultTimezone();
    const d = typeof date === 'string' ? new Date(date) : date;
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(d);
}

/**
 * Format date as "Friday, October 20, 2023"
 */
export function formatEntryDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Get relative time string (e.g., "10 days ago", "2 hours ago")
 */
export function getRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
}

/**
 * Get month/year string (e.g., "Oct 2023")
 */
export function getMonthYear(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
    });
}

/**
 * Get day of week letter (W, T, S, etc.)
 */
export function getDayLetter(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = d.getDay();
    const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return letters[day];
}

/**
 * Get day number (1-31)
 */
export function getDayNumber(date: Date | string): number {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.getDate();
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
    );
}

/**
 * Check if date is weekend
 */
export function isWeekend(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = d.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Get start of day in user's timezone as YYYY-MM-DD string
 */
export function getStartOfDay(date: Date | string, timezone?: string): string {
    const tz = timezone || getDefaultTimezone();
    const d = typeof date === 'string' ? new Date(date) : date;
    // Create date in user's timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(d);
}

/**
 * Get end of day in user's timezone as YYYY-MM-DD string
 * (Same as start of day since we're only dealing with dates, not times)
 */
export function getEndOfDay(date: Date | string, timezone?: string): string {
    // For date-only operations, end of day is same as start of day
    return getStartOfDay(date, timezone);
}

/**
 * Group entries by date
 */
export function groupEntriesByDate(entries: LocalStreamEntry[]): Map<string, LocalStreamEntry[]> {
    const grouped = new Map<string, LocalStreamEntry[]>();
    
    entries.forEach(entry => {
        const dateKey = getStartOfDay(entry.entry_date);
        if (!grouped.has(dateKey)) {
            grouped.set(dateKey, []);
        }
        grouped.get(dateKey)!.push(entry);
    });
    
    return grouped;
}

/**
 * Get all dates in a month
 */
export function getDatesInMonth(year: number, month: number): Date[] {
    const dates: Date[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const current = new Date(firstDay);
    while (current <= lastDay) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    
    return dates;
}

/**
 * Extract title from first line of content
 */
export function extractTitle(content: string): string | undefined {
    if (!content) return undefined;
    const firstLine = content.split('\n')[0].trim();
    return firstLine.length > 0 ? firstLine : undefined;
}

/**
 * Get week number of the year (ISO 8601 week numbering)
 */
export function getWeekNumber(date: Date | string): number {
    const d = typeof date === 'string' ? new Date(date) : date;
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * Check if a date is the first day of a week (Monday)
 */
export function isFirstDayOfWeek(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.getDay() === 1; // Monday
}


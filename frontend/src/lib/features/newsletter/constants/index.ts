import type { FrequencyType } from "../types";

export const NEWSLETTER_PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;

export const FREQUENCY_THRESHOLDS = {
    daily: 1.5,      // < 1.5 days
    weekly: 10,      // 1.5-10 days
    biweekly: 20,    // 10-20 days
    monthly: 45,     // 20-45 days
} as const;

export function getFrequencyLabel(days: number): FrequencyType {
    if (days <= 0) return 'irregular';
    if (days < FREQUENCY_THRESHOLDS.daily) return 'daily';
    if (days < FREQUENCY_THRESHOLDS.weekly) return 'weekly';
    if (days < FREQUENCY_THRESHOLDS.biweekly) return 'biweekly';
    if (days < FREQUENCY_THRESHOLDS.monthly) return 'monthly';
    return 'irregular';
}


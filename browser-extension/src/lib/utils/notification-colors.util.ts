/**
 * Notification Color Utility
 * 
 * Centralized color management for notifications in the browser extension.
 * Matches the frontend color scheme exactly for consistency.
 * 
 * Usage:
 * ```typescript
 * import { getNotificationColors, NOTIFICATION_VARIANTS } from './notification-colors.util';
 * 
 * const colors = getNotificationColors('success');
 * // { bg: '#22c55e', text: '#dcfce7', iconColor: '#bbf7d0' }
 * ```
 */

export type NotificationVariant = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'default';

/**
 * Color configuration for a notification variant
 */
export interface NotificationColors {
    /** Background color (hex) */
    bg: string;
    /** Text color (hex) */
    text: string;
    /** Icon color (hex) */
    iconColor: string;
}

/**
 * Centralized notification color constants
 * Ensures consistency with the frontend notification system
 */
export const NOTIFICATION_VARIANTS: Record<NotificationVariant, NotificationColors> = {
    success: {
        bg: '#22c55e',           // green-600
        text: '#dcfce7',         // green-100
        iconColor: '#bbf7d0',    // green-200
    },
    error: {
        bg: '#ef4444',           // red-500
        text: '#fecaca',         // red-200
        iconColor: '#fecaca',    // red-200
    },
    warning: {
        bg: '#eab308',           // yellow-500
        text: '#fef9c3',         // yellow-100
        iconColor: '#fef08a',    // yellow-200
    },
    info: {
        bg: '#3b82f6',           // blue-500
        text: '#bfdbfe',         // blue-200
        iconColor: '#bfdbfe',    // blue-200
    },
    loading: {
        bg: '#6b7280',           // gray-500
        text: '#e5e7eb',         // gray-200
        iconColor: '#9ca3af',    // gray-400
    },
    default: {
        bg: '#1f2937',           // gray-800
        text: '#ffffff',         // white
        iconColor: '#ffffff',    // white
    },
} as const;

/**
 * Get all color values for a notification variant
 * 
 * @param variant - The notification variant
 * @returns Complete color configuration
 */
export function getNotificationColors(variant: NotificationVariant): NotificationColors {
    return NOTIFICATION_VARIANTS[variant] || NOTIFICATION_VARIANTS.default;
}

/**
 * Get background color for a notification variant
 * 
 * @param variant - The notification variant
 * @returns Background color (hex)
 */
export function getNotificationBg(variant: NotificationVariant): string {
    return getNotificationColors(variant).bg;
}

/**
 * Get text color for a notification variant
 * 
 * @param variant - The notification variant
 * @returns Text color (hex)
 */
export function getNotificationText(variant: NotificationVariant): string {
    return getNotificationColors(variant).text;
}

/**
 * Get icon color for a notification variant
 * 
 * @param variant - The notification variant
 * @returns Icon color (hex)
 */
export function getNotificationIcon(variant: NotificationVariant): string {
    return getNotificationColors(variant).iconColor;
}

/**
 * Check if a variant is valid
 * 
 * @param variant - The variant to check
 * @returns True if valid
 */
export function isValidVariant(variant: string): variant is NotificationVariant {
    return variant in NOTIFICATION_VARIANTS;
}

/**
 * Get all available variants
 * 
 * @returns Array of all variant names
 */
export function getAllVariants(): NotificationVariant[] {
    return Object.keys(NOTIFICATION_VARIANTS) as NotificationVariant[];
}

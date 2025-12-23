/**
 * Notification Color Utility
 * 
 * Centralized color management for notifications across all components.
 * Provides both Tailwind classes (for browser) and RGB values (for Tauri).
 * 
 * Usage:
 * ```typescript
 * import { getNotificationColors, NOTIFICATION_VARIANTS } from '$lib/features/status-indicator';
 * 
 * const colors = getNotificationColors('success');
 * // { bgRgb: 'rgb(34 197 94)', textRgb: 'rgb(220 252 231)', bgTailwind: 'bg-green-600 dark:bg-green-700', ... }
 * ```
 */

export type NotificationVariant = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'default';

/**
 * Color configuration for a notification variant
 */
export interface NotificationColors {
    /** RGB background color for Tauri/Canvas */
    bgRgb: string;
    /** RGB text color for Tauri/Canvas */
    textRgb: string;
    /** Tailwind background classes for browser */
    bgTailwind: string;
    /** Tailwind text classes for browser */
    textTailwind: string;
    /** Tailwind icon color classes for browser */
    iconTailwind: string;
}

/**
 * Centralized notification color constants
 * Ensures consistency between FloatingStatusWidget (Tauri) and StatusIndicator (Browser)
 */
export const NOTIFICATION_VARIANTS: Record<NotificationVariant, NotificationColors> = {
    success: {
        bgRgb: 'rgb(34 197 94)',           // green-600
        textRgb: 'rgb(220 252 231)',       // green-100
        bgTailwind: 'bg-green-600 dark:bg-green-700',
        textTailwind: 'text-white',
        iconTailwind: 'text-green-200',
    },
    error: {
        bgRgb: 'rgb(239 68 68)',           // red-500
        textRgb: 'rgb(254 202 202)',       // red-200
        bgTailwind: 'bg-red-600 dark:bg-red-700',
        textTailwind: 'text-white',
        iconTailwind: 'text-red-200',
    },
    warning: {
        bgRgb: 'rgb(234 179 8)',           // yellow-500
        textRgb: 'rgb(254 249 195)',       // yellow-100
        bgTailwind: 'bg-yellow-600 dark:bg-yellow-700',
        textTailwind: 'text-white',
        iconTailwind: 'text-yellow-200',
    },
    info: {
        bgRgb: 'rgb(59 130 246)',          // blue-500
        textRgb: 'rgb(191 219 254)',       // blue-200
        bgTailwind: 'bg-blue-600 dark:bg-blue-700',
        textTailwind: 'text-white',
        iconTailwind: 'text-blue-200',
    },
    loading: {
        bgRgb: 'rgb(107 114 128)',         // gray-500
        textRgb: 'rgb(229 231 235)',       // gray-200
        bgTailwind: 'bg-gray-900 dark:bg-gray-800',
        textTailwind: 'text-white',
        iconTailwind: 'text-gray-400',
    },
    default: {
        bgRgb: 'rgb(31 41 55)',            // gray-800
        textRgb: 'rgb(255 255 255)',       // white
        bgTailwind: 'bg-black dark:bg-gray-900',
        textTailwind: 'text-white',
        iconTailwind: 'text-white',
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
 * Get RGB background color for a notification variant
 * Primarily used in Tauri FloatingStatusWidget
 * 
 * @param variant - The notification variant
 * @returns RGB color string
 */
export function getNotificationBgRgb(variant: NotificationVariant | string): string {
    const colors = NOTIFICATION_VARIANTS[variant as NotificationVariant];
    return colors?.bgRgb || NOTIFICATION_VARIANTS.default.bgRgb;
}

/**
 * Get RGB text color for a notification variant
 * Primarily used in Tauri FloatingStatusWidget
 * 
 * @param variant - The notification variant
 * @returns RGB color string
 */
export function getNotificationTextRgb(variant: NotificationVariant | string): string {
    const colors = NOTIFICATION_VARIANTS[variant as NotificationVariant];
    return colors?.textRgb || NOTIFICATION_VARIANTS.default.textRgb;
}

/**
 * Get Tailwind background classes for a notification variant
 * Primarily used in browser StatusIndicator
 * 
 * @param variant - The notification variant
 * @returns Tailwind class string
 */
export function getNotificationBgTailwind(variant: NotificationVariant): string {
    return NOTIFICATION_VARIANTS[variant]?.bgTailwind || NOTIFICATION_VARIANTS.default.bgTailwind;
}

/**
 * Get Tailwind text classes for a notification variant
 * Primarily used in browser StatusIndicator
 * 
 * @param variant - The notification variant
 * @returns Tailwind class string
 */
export function getNotificationTextTailwind(variant: NotificationVariant): string {
    return NOTIFICATION_VARIANTS[variant]?.textTailwind || NOTIFICATION_VARIANTS.default.textTailwind;
}

/**
 * Get Tailwind icon classes for a notification variant
 * Primarily used in browser StatusIndicator
 * 
 * @param variant - The notification variant
 * @returns Tailwind class string
 */
export function getNotificationIconTailwind(variant: NotificationVariant): string {
    return NOTIFICATION_VARIANTS[variant]?.iconTailwind || NOTIFICATION_VARIANTS.default.iconTailwind;
}


import type { ComponentType } from 'svelte';
import type { NotificationColors } from '../utils/notification-colors.util';

/**
 * Notification Severity Levels
 * 
 * Determines visual appearance, priority, duration, and animation style
 */
export enum NotificationSeverity {
    CRITICAL = 100,  // Red, highest priority, no auto-dismiss
    HIGH = 80,       // Orange, high priority, 8s duration
    MEDIUM = 60,     // Yellow/Blue, normal priority, 5s duration
    LOW = 40,        // Gray, low priority, 3s duration
    INFO = 20,       // Neutral, lowest priority, 3s duration
}

/**
 * Severity configuration
 */
export interface SeverityConfig {
    /** Severity level */
    level: NotificationSeverity;
    /** Display name */
    name: string;
    /** Default auto-dismiss duration in ms (0 = no auto-dismiss) */
    defaultDuration: number;
    /** Color configuration */
    colors: NotificationColors;
    /** Default icon component */
    defaultIcon: ComponentType;
    /** Animation preset name */
    animationPreset: 'gentle' | 'snappy' | 'bouncy' | 'critical';
    /** Priority multiplier (affects IslandPriority) */
    priorityMultiplier: number;
}

/**
 * Severity configurations
 */
export const SEVERITY_CONFIGS: Record<NotificationSeverity, SeverityConfig> = {
    [NotificationSeverity.CRITICAL]: {
        level: NotificationSeverity.CRITICAL,
        name: 'Critical',
        defaultDuration: 0, // No auto-dismiss
        colors: {
            bgRgb: 'rgb(220 38 38)',      // red-600
            textRgb: 'rgb(254 202 202)',  // red-200
            bgTailwind: 'bg-red-600 dark:bg-red-700',
            textTailwind: 'text-white',
            iconTailwind: 'text-red-200',
        },
        defaultIcon: null as any, // Will be set dynamically
        animationPreset: 'critical',
        priorityMultiplier: 1.5,
    },
    [NotificationSeverity.HIGH]: {
        level: NotificationSeverity.HIGH,
        name: 'High',
        defaultDuration: 8000,
        colors: {
            bgRgb: 'rgb(249 115 22)',    // orange-500
            textRgb: 'rgb(254 215 170)',  // orange-200
            bgTailwind: 'bg-orange-600 dark:bg-orange-700',
            textTailwind: 'text-white',
            iconTailwind: 'text-orange-200',
        },
        defaultIcon: null as any,
        animationPreset: 'snappy',
        priorityMultiplier: 1.2,
    },
    [NotificationSeverity.MEDIUM]: {
        level: NotificationSeverity.MEDIUM,
        name: 'Medium',
        defaultDuration: 5000,
        colors: {
            bgRgb: 'rgb(234 179 8)',      // yellow-500
            textRgb: 'rgb(254 249 195)',  // yellow-100
            bgTailwind: 'bg-yellow-600 dark:bg-yellow-700',
            textTailwind: 'text-white',
            iconTailwind: 'text-yellow-200',
        },
        defaultIcon: null as any,
        animationPreset: 'snappy',
        priorityMultiplier: 1.0,
    },
    [NotificationSeverity.LOW]: {
        level: NotificationSeverity.LOW,
        name: 'Low',
        defaultDuration: 3000,
        colors: {
            bgRgb: 'rgb(107 114 128)',    // gray-500
            textRgb: 'rgb(229 231 235)',  // gray-200
            bgTailwind: 'bg-gray-700 dark:bg-gray-800',
            textTailwind: 'text-white',
            iconTailwind: 'text-gray-300',
        },
        defaultIcon: null as any,
        animationPreset: 'gentle',
        priorityMultiplier: 0.8,
    },
    [NotificationSeverity.INFO]: {
        level: NotificationSeverity.INFO,
        name: 'Info',
        defaultDuration: 3000,
        colors: {
            bgRgb: 'rgb(59 130 246)',     // blue-500
            textRgb: 'rgb(191 219 254)',  // blue-200
            bgTailwind: 'bg-blue-600 dark:bg-blue-700',
            textTailwind: 'text-white',
            iconTailwind: 'text-blue-200',
        },
        defaultIcon: null as any,
        animationPreset: 'gentle',
        priorityMultiplier: 0.6,
    },
};

/**
 * Get severity configuration
 */
export function getSeverityConfig(severity: NotificationSeverity): SeverityConfig {
    return SEVERITY_CONFIGS[severity] || SEVERITY_CONFIGS[NotificationSeverity.INFO];
}

/**
 * Get default duration for severity
 */
export function getSeverityDuration(severity: NotificationSeverity): number {
    return getSeverityConfig(severity).defaultDuration;
}

/**
 * Get animation preset for severity
 */
export function getSeverityAnimationPreset(severity: NotificationSeverity): string {
    return getSeverityConfig(severity).animationPreset;
}

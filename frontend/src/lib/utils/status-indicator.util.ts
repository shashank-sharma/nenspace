/**
 * Status Indicator Utilities
 * 
 * Centralized configuration and logic for the Dynamic Island status indicator.
 * Provides type-safe status management, colors, and messages.
 */

import type { ComponentType } from 'svelte';
import {
    Clock,
    WifiOff,
    AlertCircle,
    Loader2,
    ServerOff,
} from 'lucide-svelte';
import type { RealtimeConnectionStatus } from '$lib/services/realtime.service.svelte';

/**
 * Status indicator configuration constants
 */
export const STATUS_INDICATOR_CONFIG = {
    /** Island dimensions */
    DIMENSIONS: {
        COMPACT_WIDTH: 120,
        EXPANDED_WIDTH: 280,
        HEIGHT: 40,
        MARGIN_TOP: 8,
    },
    
    /** Animation configuration */
    ANIMATION: {
        SPRING_STIFFNESS: 0.15,
        SPRING_DAMPING: 0.4,
    },
    
    /** Drag configuration */
    DRAG: {
        THRESHOLD: 5, // pixels
    },
    
    /** Storage key */
    STORAGE_KEY: 'dynamicIslandPosition',
    
    /** Notification duration for click events */
    NOTIFICATION_DURATION: 5000,
} as const;

/**
 * Status priority levels (higher = more critical)
 */
export enum StatusPriority {
    NORMAL = 0,
    LOADING = 1,
    CONNECTING = 2,
    REALTIME_ERROR = 3,
    NETWORK_OFFLINE = 4,
    BACKEND_DOWN = 5,
}

/**
 * System status interface
 */
export interface SystemStatus {
    isBackendDown: boolean;
    isOffline: boolean;
    realtimeStatus: RealtimeConnectionStatus;
    isApiLoading: boolean;
    realtimeConnected: boolean;
    backendError?: string | null;
    realtimeError?: string | null;
}

/**
 * Status indicator state
 */
export interface StatusIndicatorState {
    priority: StatusPriority;
    icon: ComponentType | null;
    iconColor: string;
    backgroundColor: string;
    message: string;
}

/**
 * Get current system status priority
 */
export function getStatusPriority(status: SystemStatus): StatusPriority {
    if (status.isBackendDown) return StatusPriority.BACKEND_DOWN;
    if (status.isOffline) return StatusPriority.NETWORK_OFFLINE;
    if (status.realtimeStatus === 'error') return StatusPriority.REALTIME_ERROR;
    if (status.realtimeStatus === 'connecting') return StatusPriority.CONNECTING;
    if (status.isApiLoading) return StatusPriority.LOADING;
    return StatusPriority.NORMAL;
}

/**
 * Get status icon based on system status
 */
export function getStatusIcon(status: SystemStatus): ComponentType | null {
    if (status.isBackendDown) return ServerOff;
    if (status.isOffline) return WifiOff;
    if (status.realtimeStatus === 'error') return AlertCircle;
    if (status.realtimeStatus === 'connecting') return Loader2;
    if (status.isApiLoading) return Loader2;
    return Clock;
}

/**
 * Get icon color based on system status
 */
export function getStatusIconColor(status: SystemStatus): string {
    if (status.isBackendDown) return 'text-red-200';
    if (status.isOffline) return 'text-red-300';
    if (status.realtimeStatus === 'error') return 'text-orange-300';
    if (status.realtimeStatus === 'connecting') return 'text-yellow-300';
    if (status.isApiLoading) return 'text-blue-300';
    return 'text-white';
}

/**
 * Get background color based on system status
 */
export function getStatusBackgroundColor(status: SystemStatus): string {
    if (status.isBackendDown) return 'bg-red-700 dark:bg-red-800';
    if (status.isOffline) return 'bg-red-600 dark:bg-red-700';
    if (status.realtimeStatus === 'error') return 'bg-orange-600 dark:bg-orange-700';
    if (status.realtimeStatus === 'connecting') return 'bg-gray-800 dark:bg-gray-900';
    return 'bg-black dark:bg-gray-950';
}

/**
 * Get detailed status message
 */
export function getStatusMessage(status: SystemStatus): string {
    if (status.isBackendDown) {
        return `Backend unavailable${status.backendError ? ': ' + status.backendError : ''}`;
    }
    if (status.isOffline) {
        return 'Network offline - Check internet connection';
    }
    if (status.realtimeStatus === 'error') {
        return `Realtime connection error${status.realtimeError ? ': ' + status.realtimeError : ''}`;
    }
    if (status.realtimeStatus === 'connecting') {
        return 'Connecting to realtime...';
    }
    if (status.isApiLoading) {
        return 'Loading...';
    }
    if (status.realtimeConnected) {
        return 'All systems operational';
    }
    return 'Ready';
}

/**
 * Get complete status indicator state
 */
export function getStatusIndicatorState(status: SystemStatus): StatusIndicatorState {
    return {
        priority: getStatusPriority(status),
        icon: getStatusIcon(status),
        iconColor: getStatusIconColor(status),
        backgroundColor: getStatusBackgroundColor(status),
        message: getStatusMessage(status),
    };
}

/**
 * Check if icon should animate (spin)
 */
export function shouldIconAnimate(status: SystemStatus): boolean {
    return false;
}

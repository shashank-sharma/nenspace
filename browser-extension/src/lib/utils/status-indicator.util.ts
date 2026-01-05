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
import type { RealtimeConnectionStatus } from '../services/realtime.service';

/**
 * Status indicator configuration constants
 */
export const STATUS_INDICATOR_CONFIG = {
    /** Island dimensions */
    DIMENSIONS: {
        CIRCLE_SIZE: 40, // Circle diameter when idle (icon only)
        COMPACT_WIDTH: 120,
        EXPANDED_WIDTH: 100,
        HEIGHT: 40,
        MARGIN_TOP: 16, // Top-left positioning
        MARGIN_LEFT: 16,
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
 * Tailwind color constants (using RGB values for inline styles)
 * Maps to Tailwind: red-200, red-300, orange-300, yellow-300, blue-300, white
 */
const ICON_COLORS = {
    ERROR: 'rgb(254, 202, 202)', // red-200
    OFFLINE: 'rgb(252, 165, 165)', // red-300
    WARNING: 'rgb(253, 186, 116)', // orange-300
    CONNECTING: 'rgb(252, 211, 77)', // yellow-300
    LOADING: 'rgb(147, 197, 253)', // blue-300
    NORMAL: 'rgb(255, 255, 255)', // white
} as const;

/**
 * Tailwind background color constants
 * Maps to Tailwind: red-600, red-500, orange-600, gray-800, black
 */
const BACKGROUND_COLORS = {
    CRITICAL: 'rgb(220, 38, 38)', // red-600
    ERROR: 'rgb(239, 68, 68)', // red-500
    WARNING: 'rgb(234, 88, 12)', // orange-600
    CONNECTING: 'rgb(31, 41, 55)', // gray-800
    NORMAL: 'rgb(0, 0, 0)', // black
} as const;

/**
 * Get icon color based on system status
 * Returns RGB values compatible with Tailwind color palette
 */
export function getStatusIconColor(status: SystemStatus): string {
    if (status.isBackendDown) return ICON_COLORS.ERROR;
    if (status.isOffline) return ICON_COLORS.OFFLINE;
    if (status.realtimeStatus === 'error') return ICON_COLORS.WARNING;
    if (status.realtimeStatus === 'connecting') return ICON_COLORS.CONNECTING;
    if (status.isApiLoading) return ICON_COLORS.LOADING;
    return ICON_COLORS.NORMAL;
}

/**
 * Get background color based on system status
 * Returns RGB values compatible with Tailwind color palette
 */
export function getStatusBackgroundColor(status: SystemStatus): string {
    if (status.isBackendDown) return BACKGROUND_COLORS.CRITICAL;
    if (status.isOffline) return BACKGROUND_COLORS.ERROR;
    if (status.realtimeStatus === 'error') return BACKGROUND_COLORS.WARNING;
    if (status.realtimeStatus === 'connecting') return BACKGROUND_COLORS.CONNECTING;
    return BACKGROUND_COLORS.NORMAL;
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
    return status.realtimeStatus === 'connecting' || status.isApiLoading;
}


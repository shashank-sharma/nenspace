import type { ComponentType } from 'svelte';

/**
 * View priority levels
 */
export enum IslandPriority {
    SYSTEM = 100,      // Critical system alerts
    NOTIFICATION = 80, // User notifications
    MUSIC = 60,        // Active media
    COMMUNICATION = 40, // Emails, messages
    IDLE = 20,         // Default state (time)
}

/**
 * Dimensions for different island states
 */
export interface IslandDimensions {
    width: number;
    height: number;
    borderRadius?: number;
}

/**
 * Contract for a pluggable island view
 */
export interface IslandView {
    id: string;
    priority: IslandPriority;
    dimensions: IslandDimensions;
    component: ComponentType<any>;
    props?: Record<string, any>;
    
    // Auto-dismiss settings
    duration?: number; // 0 = no auto-dismiss
    
    // View lifecycle hooks
    onActivate?: () => void;
    onDeactivate?: () => void;
    onDestroy?: () => void;
}

/**
 * Transition configuration
 */
export interface ViewTransition {
    fromId?: string;
    toId: string;
    duration?: number;
    easing?: string;
    delay?: number;
}

/**
 * Current island state
 */
export interface IslandState {
    activeView: IslandView | null;
    isLocked: boolean; // Prevents view switching during critical interactions
    isExpanded: boolean;
}

/**
 * Email specific data
 */
export interface EmailPayload {
    id: string;
    sender: string;
    subject: string;
    summary: string;
    timestamp: Date;
    avatar?: string;
}

/**
 * Big text payload
 */
export interface BigTextPayload {
    text: string;
    subtext?: string;
    icon?: ComponentType;
    colors?: {
        bg: string;
        text: string;
    };
}

/**
 * Message Types
 * 
 * Type definitions for browser extension messaging.
 */

export interface BackgroundMessage {
    type: string;
    payload?: any;
    tabId?: number;
    windowId?: number;
}

export interface NotificationPayload {
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
}

export interface MessageResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}


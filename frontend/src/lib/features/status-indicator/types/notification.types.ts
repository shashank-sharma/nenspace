import type { ComponentType } from 'svelte';
import { IslandPriority } from './island.types';
import { NotificationSeverity } from './severity.types';
import type { NotificationColors } from '../utils/notification-colors.util';

/**
 * Notification Type Identifier
 */
export type NotificationTypeId = 
    | 'standard'      // success, error, info, warning, loading
    | 'system'        // system updates, maintenance
    | 'calendar'      // calendar events, reminders
    | 'task'          // task completion, due dates
    | 'email'          // email notifications
    | 'music'          // music playback
    | 'big-text';      // big text announcements

/**
 * Base notification payload
 */
export interface BaseNotificationPayload {
    id?: string;
    message: string;
    timestamp?: Date;
    [key: string]: any;
}

/**
 * System notification payload
 */
export interface SystemNotificationPayload extends BaseNotificationPayload {
    type: 'update' | 'maintenance' | 'alert' | 'info';
    version?: string;
    actionUrl?: string;
}

/**
 * Calendar notification payload
 */
export interface CalendarNotificationPayload extends BaseNotificationPayload {
    eventId: string;
    title: string;
    startTime: Date;
    endTime?: Date;
    location?: string;
    description?: string;
}

/**
 * Task notification payload
 */
export interface TaskNotificationPayload extends BaseNotificationPayload {
    taskId: string;
    title: string;
    type: 'completed' | 'due' | 'overdue' | 'progress';
    dueDate?: Date;
    progress?: number;
}

/**
 * Email notification payload (extends existing EmailPayload)
 */
export interface EmailNotificationPayload extends BaseNotificationPayload {
    sender: string;
    subject: string;
    summary: string;
    avatar?: string;
}

/**
 * Big text notification payload
 */
export interface BigTextNotificationPayload extends BaseNotificationPayload {
    text: string;
    subtext?: string;
    icon?: ComponentType;
}

/**
 * Union of all notification payloads
 */
export type NotificationPayload = 
    | BaseNotificationPayload
    | SystemNotificationPayload
    | CalendarNotificationPayload
    | TaskNotificationPayload
    | EmailNotificationPayload
    | BigTextNotificationPayload;

/**
 * Notification type configuration
 * Defines how a notification type behaves
 */
export interface NotificationType {
    /** Unique identifier */
    id: NotificationTypeId;
    /** Base priority level */
    priority: IslandPriority;
    /** Default severity */
    defaultSeverity: NotificationSeverity;
    /** Default duration (0 = no auto-dismiss) */
    defaultDuration: number;
    /** View component to render */
    viewComponent: ComponentType<any>;
    /** Default icon component */
    defaultIcon: ComponentType;
    /** Default color configuration */
    colors: NotificationColors;
    /** Whether this type can be batched */
    canBatch: boolean;
    /** Function to generate batch key (for grouping similar notifications) */
    batchKey?: (payload: NotificationPayload) => string;
    /** Whether this type supports expansion */
    canExpand: boolean;
    /** Maximum batch size before showing count */
    maxBatchSize?: number;
}

/**
 * Notification instance
 */
export interface NotificationInstance {
    /** Unique notification ID */
    id: string;
    /** Notification type */
    type: NotificationTypeId;
    /** Severity level */
    severity: NotificationSeverity;
    /** Payload data */
    payload: NotificationPayload;
    /** Duration in ms (0 = no auto-dismiss) */
    duration: number;
    /** Timestamp when notification was created */
    timestamp: Date;
    /** Batch count (if batched) */
    batchCount?: number;
    /** Batch key (for grouping) */
    batchKey?: string;
}

/**
 * Batched notification group
 */
export interface BatchedNotification {
    /** Batch key */
    key: string;
    /** Notification type */
    type: NotificationTypeId;
    /** Notifications in batch */
    notifications: NotificationInstance[];
    /** Total count */
    count: number;
    /** Most recent notification */
    latest: NotificationInstance;
    /** Priority (highest severity in batch) */
    priority: IslandPriority;
}

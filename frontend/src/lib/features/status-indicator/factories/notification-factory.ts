import { nanoid } from 'nanoid';
import { notificationRegistry } from '../registry/notification-registry';
import { NotificationSeverity, getSeverityDuration } from '../types/severity.types';
import type { 
    NotificationInstance, 
    NotificationTypeId, 
    NotificationPayload 
} from '../types/notification.types';

/**
 * Notification Factory
 * 
 * Creates notification instances with proper configuration
 */
class NotificationFactory {
    /**
     * Create a notification instance
     */
    create(
        type: NotificationTypeId,
        payload: NotificationPayload,
        options?: {
            severity?: NotificationSeverity;
            duration?: number;
            id?: string;
        }
    ): NotificationInstance {
        const typeConfig = notificationRegistry.get(type);
        if (!typeConfig) {
            throw new Error(`Unknown notification type: ${type}`);
        }

        const severity = options?.severity ?? typeConfig.defaultSeverity;
        const duration = options?.duration ?? getSeverityDuration(severity);
        const id = options?.id ?? nanoid();

        // Generate batch key if batching is enabled
        let batchKey: string | undefined;
        if (typeConfig.canBatch && typeConfig.batchKey) {
            batchKey = typeConfig.batchKey(payload);
        }

        return {
            id,
            type,
            severity,
            payload: {
                ...payload,
                id,
                timestamp: payload.timestamp ?? new Date(),
            },
            duration,
            timestamp: new Date(),
            batchKey,
        };
    }

    /**
     * Create standard notification (success, error, info, warning, loading)
     */
    createStandard(
        variant: 'success' | 'error' | 'info' | 'warning' | 'loading',
        message: string,
        options?: {
            severity?: NotificationSeverity;
            duration?: number;
            id?: string;
        }
    ): NotificationInstance {
        // Map variant to severity
        const severityMap: Record<string, NotificationSeverity> = {
            success: NotificationSeverity.MEDIUM,
            error: NotificationSeverity.HIGH,
            info: NotificationSeverity.INFO,
            warning: NotificationSeverity.MEDIUM,
            loading: NotificationSeverity.INFO,
        };

        const severity = options?.severity ?? severityMap[variant] ?? NotificationSeverity.INFO;

        return this.create(
            'standard',
            {
                message,
                variant,
            },
            {
                ...options,
                severity,
            }
        );
    }

    /**
     * Create system notification
     */
    createSystem(
        message: string,
        systemType: 'update' | 'maintenance' | 'alert' | 'info' = 'info',
        options?: {
            severity?: NotificationSeverity;
            duration?: number;
            id?: string;
            version?: string;
            actionUrl?: string;
        }
    ): NotificationInstance {
        return this.create(
            'system',
            {
                message,
                type: systemType,
                version: options?.version,
                actionUrl: options?.actionUrl,
            },
            options
        );
    }

    /**
     * Create calendar notification
     */
    createCalendar(
        eventId: string,
        title: string,
        startTime: Date,
        options?: {
            severity?: NotificationSeverity;
            duration?: number;
            id?: string;
            endTime?: Date;
            location?: string;
            description?: string;
        }
    ): NotificationInstance {
        return this.create(
            'calendar',
            {
                eventId,
                title,
                message: title,
                startTime,
                endTime: options?.endTime,
                location: options?.location,
                description: options?.description,
            },
            options
        );
    }

    /**
     * Create task notification
     */
    createTask(
        taskId: string,
        title: string,
        taskType: 'completed' | 'due' | 'overdue' | 'progress',
        options?: {
            severity?: NotificationSeverity;
            duration?: number;
            id?: string;
            dueDate?: Date;
            progress?: number;
        }
    ): NotificationInstance {
        return this.create(
            'task',
            {
                taskId,
                title,
                message: title,
                type: taskType,
                dueDate: options?.dueDate,
                progress: options?.progress,
            },
            options
        );
    }

    /**
     * Create email notification
     */
    createEmail(
        sender: string,
        subject: string,
        summary: string,
        options?: {
            severity?: NotificationSeverity;
            duration?: number;
            id?: string;
            avatar?: string;
        }
    ): NotificationInstance {
        return this.create(
            'email',
            {
                sender,
                subject,
                summary,
                message: `${sender}: ${subject}`,
                avatar: options?.avatar,
            },
            options
        );
    }

    /**
     * Create big text notification
     */
    createBigText(
        text: string,
        options?: {
            severity?: NotificationSeverity;
            duration?: number;
            id?: string;
            subtext?: string;
            icon?: any;
        }
    ): NotificationInstance {
        return this.create(
            'big-text',
            {
                text,
                message: text,
                subtext: options?.subtext,
                icon: options?.icon,
            },
            options
        );
    }
}

export const notificationFactory = new NotificationFactory();

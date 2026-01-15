/**
 * Status Indicator Feature
 * 
 * Dynamic Island-style status indicator system for displaying:
 * - Real-time system status (online/offline, loading, errors)
 * - Island notifications (success, error, info, warning)
 * - Cross-platform support (Browser StatusIndicator + Tauri FloatingWidget)
 * 
 * This feature is distinct from the backend notification system (bell icon).
 * 
 * Usage:
 * ```typescript
 * import { NotificationBroadcaster, NotificationSyncService } from '$lib/features/status-indicator';
 * 
 * // Initialize sync service (in root layout)
 * await NotificationSyncService.initialize();
 * 
 * // Broadcast notifications
 * NotificationBroadcaster.success('Task completed!');
 * NotificationBroadcaster.error('Failed to save');
 * 
 * // New notification types
 * NotificationBroadcaster.system('System update available', 'update');
 * NotificationBroadcaster.calendar('event_1', 'Meeting', new Date());
 * NotificationBroadcaster.task('task_1', 'Complete project', 'due');
 * ```
 */

// Services
export * from './services';

// Utils
export * from './utils';

// Types
export * from './types';

// Registry
export * from './registry';

// Factories
export * from './factories';

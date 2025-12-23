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
 * ```
 */

// Services
export * from './services';

// Utils
export * from './utils';


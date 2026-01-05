/**
 * Shared Types
 * 
 * Barrel export for all extension type definitions.
 * Organized by domain for better maintainability.
 */

// Branded types for type-safe IDs
export * from './branded';

// Domain-specific types
export * from './auth.types';
export * from './storage.types';
export * from './activity.types';
export * from './settings.types';
export * from './pocketbase.types';
export * from './message.types';
export * from './result.types';

// Export types from utility files
export type { Position } from '../utils/draggable.util';
export type { SystemStatus, StatusIndicatorState } from '../utils/status-indicator.util';
export type { IslandNotification, NotificationVariant, NotificationOptions } from '../services/island-notification.service';


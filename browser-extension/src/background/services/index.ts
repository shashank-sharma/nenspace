/**
 * Background Services Singleton Exports
 * 
 * Centralized exports for Plasmo message handlers to access background services.
 * This replaces the manual dependency injection pattern.
 */

import type { HealthMonitor } from './health-monitor'
import type { RealtimeManager } from './realtime-manager'
import type { ActivityTracker } from './activity-tracker'
import type { HistorySyncService } from './history-sync.service'

// Service instances - initialized by background/index.ts
let _healthMonitor: HealthMonitor
let _realtimeManager: RealtimeManager
let _activityTracker: ActivityTracker
let _historySyncService: HistorySyncService
let _initialized = false

export function getHealthMonitor(): HealthMonitor {
  if (!_healthMonitor) throw new Error('HealthMonitor not initialized')
  return _healthMonitor
}

export function getRealtimeManager(): RealtimeManager {
  if (!_realtimeManager) throw new Error('RealtimeManager not initialized')
  return _realtimeManager
}

export function getActivityTracker(): ActivityTracker {
  if (!_activityTracker) throw new Error('ActivityTracker not initialized')
  return _activityTracker
}

export function getHistorySyncService(): HistorySyncService {
  if (!_historySyncService) throw new Error('HistorySyncService not initialized')
  return _historySyncService
}

export function isServicesInitialized(): boolean {
  return _initialized
}

/**
 * Initialize service singletons
 * Called by background/index.ts after service creation
 */
export function initializeServices(services: {
  healthMonitor: HealthMonitor
  realtimeManager: RealtimeManager
  activityTracker: ActivityTracker
  historySyncService: HistorySyncService
}): void {
  _healthMonitor = services.healthMonitor
  _realtimeManager = services.realtimeManager
  _activityTracker = services.activityTracker
  _historySyncService = services.historySyncService
  _initialized = true
}

/**
 * Get all services as an object
 * Useful for handlers that need multiple services
 */
export function getServices() {
  return {
    healthMonitor: getHealthMonitor(),
    realtimeManager: getRealtimeManager(),
    activityTracker: getActivityTracker(),
    historySyncService: getHistorySyncService()
  }
}

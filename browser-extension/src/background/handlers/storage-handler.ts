/**
 * Storage Change Handler
 * Handles storage changes and triggers necessary updates
 */

import { STORAGE_KEYS } from '../../lib/config/constants'
import type { RealtimeManager } from '../services/realtime-manager'
import type { HealthMonitor } from '../services/health-monitor'
import type { ActivityTracker } from '../services/activity-tracker'
import type { HistorySyncService } from '../services/history-sync.service'
import { createLogger } from '../utils/logger'
import { BackgroundConfig } from '../config'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.BACKGROUND)

export interface StorageHandlerDependencies {
  realtimeManager: RealtimeManager
  healthMonitor: HealthMonitor
  activityTracker: ActivityTracker
  historySyncService: HistorySyncService
}

/**
 * Create storage change handler with dependencies injected
 */
export function createStorageHandler(deps: StorageHandlerDependencies) {
  return async (changes: Record<string, any>, areaName: string): Promise<void> => {
    if (areaName !== 'local') {
      return
    }

    const authChanged = !!changes[STORAGE_KEYS.AUTH]
    const profileChanged = !!changes[STORAGE_KEYS.PROFILE_ID]
    const activitySettingsChanged = !!changes[STORAGE_KEYS.ACTIVITY_SETTINGS]
    
    if (!authChanged && !profileChanged && !activitySettingsChanged) {
      return
    }

    logger.info('Storage changed, reinitializing services', {
      authChanged,
      profileChanged,
      activitySettingsChanged
    })
    
    // Reinitialize realtime manager
    try {
      await deps.realtimeManager.forceReinitialize()
    } catch (error) {
      logger.error('Failed to reinitialize realtime manager', error)
    }
    
    // Reinitialize health monitor
    try {
      await deps.healthMonitor.initialize()
    } catch (error) {
      logger.error('Failed to reinitialize health monitor', error)
    }

          // Reinitialize activity tracker
          try {
            await deps.activityTracker.initialize()
          } catch (error) {
            logger.error('Failed to reinitialize activity tracker', error)
          }

          // Reinitialize history sync service
          try {
            await deps.historySyncService.initialize()
          } catch (error) {
            logger.error('Failed to reinitialize history sync service', error)
          }
  }
}


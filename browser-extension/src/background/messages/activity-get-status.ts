import type { PlasmoMessaging } from "@plasmohq/messaging"
import { createLogger } from "~background/utils/logger"
import type { ActivityGetStatusRequest, ActivityGetStatusResponse } from "~lib/types/messages"
import { getActivityTracker } from "~background/services"
import { settingsStorage } from "~lib/services/plasmo-storage.service"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:ActivityGetStatus]')

const handler: PlasmoMessaging.MessageHandler<ActivityGetStatusRequest, ActivityGetStatusResponse> = async (req, res) => {
  logger.debug('Handling ACTIVITY_GET_STATUS message')
  
  try {
    // Always get settings from storage first (source of truth)
    const storedSettingsResult = await settingsStorage.getActivitySettings()
    const storedSettings = storedSettingsResult.success ? storedSettingsResult.data : null
    
    // Default settings as fallback
    const defaultSettings = {
      enabled: true,
      syncEnabled: false,
      incognitoMode: 'mark' as const,
      heartbeatInterval: 30,
      syncInterval: 30,
      minimumDuration: 5,
      domainBlacklist: [],
      autoCleanupDays: 30,
      sleepThreshold: 60
    }
    
    // Use stored settings or defaults
    const settings = storedSettings || defaultSettings
    
    // Ensure syncEnabled is always a boolean
    if (typeof settings.syncEnabled !== 'boolean') {
      logger.warn('syncEnabled is not a boolean, fixing it', { 
        originalValue: settings.syncEnabled,
        type: typeof settings.syncEnabled 
      })
      settings.syncEnabled = false
    }
    
    logger.info('Retrieved settings', { 
      settings,
      syncEnabled: settings.syncEnabled,
      settingsKeys: Object.keys(settings),
      fromStorage: !!storedSettings
    })
    
    // Try to get additional status from activityTracker if available
    let currentActivity = null
    let sessionInfo = null
    let batchQueueStatus = { count: 0, items: [] }
    let syncStatus = { running: false, lastSync: null, totalSynced: 0, isTracking: false }
    
    try {
      const tracker = getActivityTracker()
      logger.info('ActivityTracker is available, getting additional status...')
      
      currentActivity = tracker.getCurrentActivity()
      // @ts-ignore - Added in background/services/activity-tracker.ts but not in interface yet
      if (typeof tracker.getSessionInfo === 'function') {
        // @ts-ignore
        sessionInfo = tracker.getSessionInfo()
      }
      
      // @ts-ignore
      if (typeof tracker.getBatchQueueStatus === 'function') {
        // @ts-ignore
        batchQueueStatus = tracker.getBatchQueueStatus()
      }
      
      syncStatus = tracker.getSyncStatus()
    } catch (trackerError) {
      logger.warn('ActivityTracker not available or not initialized', trackerError)
    }
    
    const status = {
      settings,
      currentActivity,
      sessionInfo,
      syncStatus: {
        enabled: settings.syncEnabled,
        running: syncStatus.running || syncStatus.isTracking, // Show as running if tracking is active OR sync is in progress
        interval: settings.syncInterval,
        lastSync: syncStatus.lastSync,
        itemsQueued: batchQueueStatus.count,
        totalSynced: syncStatus.totalSynced,
        isTracking: syncStatus.isTracking
      }
    }
    
    logger.debug('Activity status retrieved successfully', { status })
    res.send({ success: true, status })
  } catch (error) {
    logger.error('Failed to get activity status', error)
    res.send({ 
      success: false, 
      error: getErrorMessage(error)
    })
  }
}

export default handler

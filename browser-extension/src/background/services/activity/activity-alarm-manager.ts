/**
 * Activity Alarm Manager
 * Handles all alarm setup and event handling for activity tracking
 */

import type { ActivitySettings } from '../../types'
import { BackgroundConfig } from '../../config'
import { createLogger } from '../../utils/logger'
import { BrowserAPI } from '../../utils/browser-api'
import { CLEANUP_ALARM_INTERVAL_MINUTES } from './constants'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.ACTIVITY)

export interface AlarmCallbacks {
  onHeartbeat: () => Promise<void>
  onSync: () => Promise<void>
  onCleanup: () => Promise<void>
}

/**
 * Manages alarms for activity tracking
 */
export class ActivityAlarmManager {
  private heartbeatAlarmName: string = 'activity-heartbeat'
  private syncAlarmName: string = 'activity-sync'
  private cleanupAlarmName: string = 'activity-cleanup'
  private callbacks: AlarmCallbacks | null = null

  constructor(callbacks: AlarmCallbacks) {
    this.callbacks = callbacks
  }

  /**
   * Sets up heartbeat alarm
   */
  async setupHeartbeatAlarm(settings: ActivitySettings): Promise<void> {
    try {
      // Clear existing alarm
      await BrowserAPI.alarms.clear(this.heartbeatAlarmName)
      
      // Create new alarm
      await BrowserAPI.alarms.create(this.heartbeatAlarmName, {
        periodInMinutes: Math.floor(settings.heartbeatInterval / 60) || 1
      })

      // Setup alarm listener
      BrowserAPI.alarms.onAlarm.addListener(this.handleHeartbeatAlarm.bind(this))
      
      logger.info('Heartbeat alarm setup successfully', { interval: settings.heartbeatInterval })
    } catch (error) {
      logger.warn('Failed to setup heartbeat alarm (alarms API may not be available)', error)
      // Continue without alarm-based heartbeat - manual heartbeats will still work
    }
  }

  /**
   * Sets up sync alarm
   */
  async setupSyncAlarm(settings: ActivitySettings): Promise<void> {
    try {
      // Always clear existing alarm first
      await BrowserAPI.alarms.clear(this.syncAlarmName)
      
      // Only create if sync is enabled
      if (!settings.syncEnabled) {
        logger.info('Sync is disabled, not setting up sync alarm')
        return
      }
      
      // Create sync alarm based on settings
      const intervalMinutes = Math.max(1, Math.floor(settings.syncInterval / 60)) || 1
      await BrowserAPI.alarms.create(this.syncAlarmName, {
        periodInMinutes: intervalMinutes
      })

      // Setup alarm listener
      BrowserAPI.alarms.onAlarm.addListener(this.handleSyncAlarm.bind(this))
      
      logger.info('Sync alarm setup successfully', { 
        intervalSeconds: settings.syncInterval,
        intervalMinutes 
      })
    } catch (error) {
      logger.warn('Failed to setup sync alarm (alarms API may not be available)', error)
    }
  }

  /**
   * Sets up cleanup alarm
   */
  async setupCleanupAlarm(): Promise<void> {
    try {
      // Clear existing alarm
      await BrowserAPI.alarms.clear(this.cleanupAlarmName)
      
      // Create cleanup alarm to run every 24 hours
      await BrowserAPI.alarms.create(this.cleanupAlarmName, {
        periodInMinutes: CLEANUP_ALARM_INTERVAL_MINUTES
      })

      // Setup alarm listener
      BrowserAPI.alarms.onAlarm.addListener(this.handleCleanupAlarm.bind(this))
      
      logger.info('Cleanup alarm setup successfully', { intervalMinutes: CLEANUP_ALARM_INTERVAL_MINUTES })
    } catch (error) {
      logger.warn('Failed to setup cleanup alarm (alarms API may not be available)', error)
    }
  }

  /**
   * Handles heartbeat alarm
   */
  private async handleHeartbeatAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    if (alarm.name !== this.heartbeatAlarmName) return
    
    try {
      if (this.callbacks?.onHeartbeat) {
        await this.callbacks.onHeartbeat()
      }
    } catch (error) {
      logger.error('Error handling heartbeat alarm', error)
    }
  }

  /**
   * Handles sync alarm
   */
  private async handleSyncAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    if (alarm.name !== this.syncAlarmName) return
    
    try {
      if (this.callbacks?.onSync) {
        await this.callbacks.onSync()
      }
    } catch (error) {
      logger.error('Error handling sync alarm', error)
    }
  }

  /**
   * Handles cleanup alarm
   */
  private async handleCleanupAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    if (alarm.name !== this.cleanupAlarmName) return
    
    try {
      if (this.callbacks?.onCleanup) {
        await this.callbacks.onCleanup()
      }
    } catch (error) {
      logger.error('Auto cleanup failed', error)
    }
  }
}


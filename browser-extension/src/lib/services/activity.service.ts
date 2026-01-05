/**
 * Activity Service
 * 
 * Frontend service for managing browsing activity tracking.
 */

import type { ActivitySettings, ActivityRecord, SessionInfo } from '../../background/types'
import { createLogger } from '../utils/logger.util'
import { isBackground } from '../utils/environment.util'
import { settingsStorage } from './plasmo-storage.service'

const logger = createLogger('[ActivityService]')

export interface ActivityStatus {
  settings: ActivitySettings
  currentActivity: ActivityRecord | null
  sessionInfo: SessionInfo | null
  syncStatus: {
    enabled: boolean
    running: boolean
    interval: number
    lastSync?: Date | string | null
    itemsQueued: number
    totalSynced?: number
    isTracking?: boolean
  }
}

class ActivityServiceImpl {
  #isInitialized = false

  async initialize(): Promise<void> {
    if (this.#isInitialized) return;
    this.#isInitialized = true
  }

  async startTracking(): Promise<void> {
    try {
      // Use Plasmo messaging for cross-browser compatibility
      const { sendToBackground } = await import('@plasmohq/messaging')
      
      const response = await sendToBackground({
        name: 'activity-start-tracking'
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to start tracking')
      }
    } catch (error) {
      logger.error('Failed to start tracking', error)
      throw error
    }
  }

  async stopTracking(): Promise<void> {
    try {
      // Use Plasmo messaging for cross-browser compatibility
      const { sendToBackground } = await import('@plasmohq/messaging')
      
      const response = await sendToBackground({
        name: 'activity-stop-tracking'
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to stop tracking')
      }
    } catch (error) {
      logger.error('Failed to stop tracking', error)
      throw error
    }
  }

  /**
   * Get current activity status
   */
  async getStatus(): Promise<ActivityStatus> {
    try {
      // Check if we're in the right context for activity tracking
      if (isBackground()) {
        logger.debug('Activity tracking not needed in background context')
        return {
          settings: this.getDefaultSettings(),
          currentActivity: null,
          sessionInfo: null,
          syncStatus: { enabled: false, running: false, interval: 0, itemsQueued: 0 }
        }
      }

      // Use Plasmo messaging for cross-browser compatibility
      const { sendToBackground } = await import('@plasmohq/messaging')
      
      const response = await sendToBackground({
        name: 'activity-get-status'
      })
      
      if (!response) {
        throw new Error('No response from background script')
      }

      if (response.success) {
        const status = response.status
        logger.debug('Received status from background', { 
          status, 
          syncEnabled: status.settings?.syncEnabled 
        })
        
        // Ensure syncStatus exists
        if (!status.syncStatus) {
          status.syncStatus = {
            enabled: status.settings?.syncEnabled || false,
            running: false,
            interval: status.settings?.syncInterval || 30,
            lastSync: null,
            itemsQueued: 0,
            totalSynced: 0
          }
        }
        return status
      } else {
        throw new Error(response.error || 'Failed to get status')
      }
    } catch (error) {
      logger.error('Failed to get status', error)
      logger.warn('Returning default status as fallback')
      
      return {
        settings: this.getDefaultSettings(),
        currentActivity: null,
        sessionInfo: null,
        syncStatus: {
          enabled: false,
          running: false,
          interval: 30,
          lastSync: null,
          itemsQueued: 0,
          totalSynced: 0
        }
      }
    }
  }

  /**
   * Update activity settings
   */
  async updateSettings(settings: Partial<ActivitySettings>): Promise<boolean> {
    try {
      logger.info('[ActivityService] Updating settings', { settings })
      
      // Check if we're in the right context for activity tracking
      if (isBackground()) {
        logger.debug('Activity tracking not needed in background context')
        return false
      }

      // Use Plasmo messaging for cross-browser compatibility
      const { sendToBackground } = await import('@plasmohq/messaging')
      
      logger.debug('[ActivityService] Sending settings update to background', { settings })
      
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Background request timed out after 5 seconds')), 5000)
        })
        
        const messagePromise = sendToBackground({
          name: 'activity-update-settings',
          body: {
            payload: {
              settings: settings
            }
          }
        })
        
        const response = await Promise.race([messagePromise, timeoutPromise]) as any
        
        logger.info('[ActivityService] Received response from background', { 
          response,
          responseType: typeof response,
          responseKeys: response ? Object.keys(response) : 'null'
        })

        if (!response) {
          logger.error('[ActivityService] No response from background script')
          throw new Error('No response from background script')
        }

        if (typeof response !== 'object') {
          logger.error('[ActivityService] Invalid response type from background', { 
            response, 
            type: typeof response 
          })
          throw new Error(`Invalid response type from background: ${typeof response}`)
        }

        if (!response.success) {
          logger.error('[ActivityService] Background service returned error', { 
            response,
            error: response.error 
          })
          throw new Error(response.error || 'Failed to update settings')
        }
        
        logger.info('[ActivityService] Settings updated successfully')
        return true
      } catch (error) {
        logger.error('[ActivityService] Failed to update settings via background', {
          error: error.message,
          settings
        })
        throw error
      }
    } catch (error) {
      logger.error('Failed to update settings', error)
      throw error
    }
  }

  private async storeSettingsLocally(settings: Partial<ActivitySettings>): Promise<void> {
    try {
      logger.info('[ActivityService] Storing settings locally', { settings })
      
      const currentSettings = await this.getStoredSettings()
      logger.debug('[ActivityService] Current stored settings:', currentSettings)
      
      const updatedSettings = { ...currentSettings, ...settings }
      logger.info('[ActivityService] Merged settings to save:', updatedSettings)
      
      // Use the unified storage system instead of localStorage
      const saveResult = await settingsStorage.saveActivitySettings(updatedSettings)
      if (!saveResult.success) {
        throw saveResult.error || new Error('Failed to save activity settings')
      }
      
      logger.info('[ActivityService] Activity settings saved to Plasmo storage successfully', { 
        settings: updatedSettings,
        syncEnabled: updatedSettings.syncEnabled 
      })
      
      // Verify the save
      const verificationResult = await settingsStorage.getActivitySettings()
      const verification = verificationResult.success ? verificationResult.data : null
      logger.info('[ActivityService] Verification after save:', {
        savedSettings: verification,
        syncEnabled: verification?.syncEnabled
      })
    } catch (error) {
      logger.error('Failed to store settings locally', error)
      throw error
    }
  }

  private async getStoredSettings(): Promise<ActivitySettings> {
    try {
      // Use the unified storage system instead of localStorage
      const storedResult = await settingsStorage.getActivitySettings()
      if (storedResult.success && storedResult.data) {
        logger.debug('Retrieved activity settings from unified storage', { settings: storedResult.data })
        return storedResult.data
      }
    } catch (error) {
      logger.error('Failed to get stored settings', error)
    }
    
    logger.debug('No stored settings found, using defaults')
    return this.getDefaultSettings()
  }

  /**
   * Get default activity settings
   */
  getDefaultSettings(): ActivitySettings {
    return {
      enabled: true,
      syncEnabled: false, // Disabled by default
      incognitoMode: 'mark',
      heartbeatInterval: 30,
      syncInterval: 30, // 30 seconds - sync every 30 seconds
      minimumDuration: 5,
      domainBlacklist: [],
      autoCleanupDays: 30,
      sleepThreshold: 60
    }
  }

  /**
   * Validate activity settings
   */
  validateSettings(settings: Partial<ActivitySettings>): string[] {
    const errors: string[] = []

    if (settings.heartbeatInterval !== undefined) {
      if (settings.heartbeatInterval < 10) {
        errors.push('Heartbeat interval must be at least 10 seconds')
      }
      if (settings.heartbeatInterval > 300) {
        errors.push('Heartbeat interval must be at most 300 seconds')
      }
    }

    if (settings.syncInterval !== undefined) {
      if (settings.syncInterval < 10) {
        errors.push('Sync interval must be at least 10 seconds')
      }
      if (settings.syncInterval > 3600) {
        errors.push('Sync interval must be at most 3600 seconds (1 hour)')
      }
    }

    if (settings.minimumDuration !== undefined) {
      if (settings.minimumDuration < 0) {
        errors.push('Minimum duration must be at least 0 seconds')
      }
      if (settings.minimumDuration > 300) {
        errors.push('Minimum duration must be at most 300 seconds (5 minutes)')
      }
    }

    if (settings.autoCleanupDays !== undefined) {
      if (settings.autoCleanupDays < 1) {
        errors.push('Auto cleanup days must be at least 1')
      }
      if (settings.autoCleanupDays > 365) {
        errors.push('Auto cleanup days must be at most 365')
      }
    }

    if (settings.sleepThreshold !== undefined) {
      if (settings.sleepThreshold < 10) {
        errors.push('Sleep threshold must be at least 10 seconds')
      }
      if (settings.sleepThreshold > 3600) {
        errors.push('Sleep threshold must be at most 3600 seconds (1 hour)')
      }
    }

    if (settings.incognitoMode !== undefined) {
      if (!['track', 'skip', 'mark'].includes(settings.incognitoMode)) {
        errors.push('Invalid incognito mode')
      }
    }

    if (settings.domainBlacklist !== undefined) {
      if (!Array.isArray(settings.domainBlacklist)) {
        errors.push('Domain blacklist must be an array')
      } else {
        settings.domainBlacklist.forEach((pattern, index) => {
          if (typeof pattern !== 'string') {
            errors.push(`Domain blacklist item ${index} must be a string`)
          }
        })
      }
    }

    return errors
  }

  cleanup(): void {
    this.#isInitialized = false
  }
}

// Export singleton instance
export const ActivityService = new ActivityServiceImpl()


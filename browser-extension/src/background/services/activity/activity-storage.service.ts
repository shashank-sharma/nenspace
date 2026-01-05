/**
 * Activity Storage Service
 * Handles all storage operations for activity tracking
 */

import type { ActivityRecord, QueuedActivity } from '../../types'
import { STORAGE_KEYS } from '../../../lib/constants'
import { BackgroundConfig } from '../../config'
import { createLogger } from '../../utils/logger'
import { BrowserAPI } from '../../utils/browser-api'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.ACTIVITY)

export interface QueueData {
  batchQueue: ActivityRecord[]
  batchQueueMap: Map<string, ActivityRecord>
  offlineQueue: QueuedActivity[]
}

/**
 * Service for managing activity data persistence
 */
export class ActivityStorageService {
  /**
   * Save batch queue to storage
   */
  async saveBatchQueue(batchQueue: ActivityRecord[]): Promise<void> {
    try {
      await BrowserAPI.storage.set({ [STORAGE_KEYS.ACTIVITY_BATCH_QUEUE]: batchQueue })
      // Map is kept in sync with array, no need to save separately
      logger.debug('Batch queue saved successfully', { 
        count: batchQueue.length,
        items: batchQueue.map(item => ({ id: item.id, url: item.url, start_time: item.start_time }))
      })
    } catch (error) {
      logger.error('Failed to save batch queue', error)
      throw error
    }
  }

  /**
   * Synchronous save for critical moments (service worker termination)
   * This is a fallback for when async operations might not complete
   */
  saveBatchQueueSync(batchQueue: ActivityRecord[]): void {
    try {
      // Use chrome.storage.local.set with callback for synchronous-like behavior
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ [STORAGE_KEYS.ACTIVITY_BATCH_QUEUE]: batchQueue }, () => {
          if (chrome.runtime.lastError) {
            logger.error('Sync batch queue save failed', chrome.runtime.lastError)
          } else {
            logger.debug('Batch queue saved synchronously', { count: batchQueue.length })
          }
        })
        // Map is kept in sync with array, no need to save separately
      }
    } catch (error) {
      logger.error('Failed to save batch queue synchronously', error)
    }
  }

  /**
   * Validates an activity record to ensure it has required fields
   */
  private validateActivityRecord(activity: any): activity is ActivityRecord {
    if (!activity || typeof activity !== 'object') return false
    
    const hasRequiredFields = 
      typeof activity.url === 'string' &&
      typeof activity.title === 'string' &&
      typeof activity.domain === 'string' &&
      activity.start_time !== undefined &&
      typeof activity.tab_id === 'number' &&
      typeof activity.window_id === 'number' &&
      typeof activity.session_id === 'string'
    
    if (!hasRequiredFields) return false
    
    if (activity.start_time && !(activity.start_time instanceof Date)) {
      activity.start_time = new Date(activity.start_time)
    }
    
    if (activity.end_time && !(activity.end_time instanceof Date)) {
      activity.end_time = new Date(activity.end_time)
    }
    
    return true
  }

  /**
   * Validates a queued activity to ensure it has required fields
   */
  private validateQueuedActivity(activity: any): activity is QueuedActivity {
    if (!activity || typeof activity !== 'object') return false
    
    return (
      typeof activity.id === 'string' &&
      typeof activity.type === 'string' &&
      typeof activity.timestamp === 'string' &&
      typeof activity.retries === 'number' &&
      activity.data !== undefined
    )
  }

  /**
   * Load batch queue from storage with validation
   */
  async loadBatchQueue(): Promise<ActivityRecord[]> {
    try {
      const result = await BrowserAPI.storage.get<ActivityRecord[]>(STORAGE_KEYS.ACTIVITY_BATCH_QUEUE)
      const rawBatchQueue = result[STORAGE_KEYS.ACTIVITY_BATCH_QUEUE] || []
      
      const validatedQueue = rawBatchQueue.filter((activity, index) => {
        const isValid = this.validateActivityRecord(activity)
        if (!isValid) {
          logger.warn('Invalid activity record found in batch queue, skipping', { 
            index, 
            activityId: activity?.id,
            url: activity?.url 
          })
        }
        return isValid
      })
      
      if (validatedQueue.length < rawBatchQueue.length) {
        logger.warn('Filtered out invalid activities from batch queue', {
          originalCount: rawBatchQueue.length,
          validCount: validatedQueue.length,
          invalidCount: rawBatchQueue.length - validatedQueue.length
        })
      }
      
      logger.debug('Batch queue loaded successfully', { 
        count: validatedQueue.length,
        items: validatedQueue.map(item => ({ id: item.id, url: item.url, start_time: item.start_time }))
      })
      
      return validatedQueue
    } catch (error) {
      logger.error('Failed to load batch queue', error)
      return []
    }
  }

  /**
   * Save offline queue to storage
   */
  async saveOfflineQueue(offlineQueue: QueuedActivity[]): Promise<void> {
    try {
      await BrowserAPI.storage.set({ [STORAGE_KEYS.ACTIVITY_QUEUE]: offlineQueue })
      logger.debug('Offline queue saved successfully', { count: offlineQueue.length })
    } catch (error) {
      logger.error('Failed to save offline queue', error)
      throw error
    }
  }

  /**
   * Synchronous save for offline queue (service worker termination)
   * This is a fallback for when async operations might not complete
   */
  saveOfflineQueueSync(offlineQueue: QueuedActivity[]): void {
    try {
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ [STORAGE_KEYS.ACTIVITY_QUEUE]: offlineQueue }, () => {
          if (chrome.runtime.lastError) {
            logger.error('Sync offline queue save failed', chrome.runtime.lastError)
          } else {
            logger.debug('Offline queue saved synchronously', { count: offlineQueue.length })
          }
        })
      }
    } catch (error) {
      logger.error('Failed to save offline queue synchronously', error)
    }
  }

  /**
   * Load offline queue from storage with validation
   */
  async loadOfflineQueue(): Promise<QueuedActivity[]> {
    try {
      const result = await BrowserAPI.storage.get<QueuedActivity[]>(STORAGE_KEYS.ACTIVITY_QUEUE)
      const rawOfflineQueue = result[STORAGE_KEYS.ACTIVITY_QUEUE] || []
      
      const validatedQueue = rawOfflineQueue.filter((activity, index) => {
        const isValid = this.validateQueuedActivity(activity)
        if (!isValid) {
          logger.warn('Invalid queued activity found in offline queue, skipping', { 
            index, 
            activityId: activity?.id 
          })
        }
        return isValid
      })
      
      if (validatedQueue.length < rawOfflineQueue.length) {
        logger.warn('Filtered out invalid activities from offline queue', {
          originalCount: rawOfflineQueue.length,
          validCount: validatedQueue.length,
          invalidCount: rawOfflineQueue.length - validatedQueue.length
        })
      }
      
      logger.debug('Loaded offline queue', { count: validatedQueue.length })
      return validatedQueue
    } catch (error) {
      logger.error('Failed to load offline queue', error)
      return []
    }
  }

  /**
   * Save checkpoint to storage
   */
  async saveCheckpoint(checkpoint: string): Promise<void> {
    try {
      await BrowserAPI.storage.set({ [STORAGE_KEYS.ACTIVITY_CHECKPOINT]: checkpoint })
      logger.debug('Checkpoint saved successfully', { checkpoint })
    } catch (error) {
      logger.error('Failed to save checkpoint', error)
      throw error
    }
  }

  /**
   * Load checkpoint from storage
   */
  async loadCheckpoint(): Promise<string | null> {
    try {
      const result = await BrowserAPI.storage.get<string>(STORAGE_KEYS.ACTIVITY_CHECKPOINT)
      const checkpoint = result[STORAGE_KEYS.ACTIVITY_CHECKPOINT] || null
      return checkpoint
    } catch (error) {
      logger.error('Failed to load checkpoint', error)
      return null
    }
  }

  /**
   * Save last sync time to storage
   */
  async saveLastSyncTime(lastSyncTime: Date): Promise<void> {
    try {
      // Store as ISO string for serialization
      await BrowserAPI.storage.set({ 
        [STORAGE_KEYS.ACTIVITY_LAST_SYNC_TIME]: lastSyncTime.toISOString() 
      })
      logger.debug('Saved last sync time to storage', {
        lastSyncTime: lastSyncTime.toISOString()
      })
    } catch (error) {
      logger.error('Failed to save last sync time', error)
      throw error
    }
  }

  /**
   * Load last sync time from storage
   */
  async loadLastSyncTime(): Promise<Date | null> {
    try {
      const result = await BrowserAPI.storage.get<string>(STORAGE_KEYS.ACTIVITY_LAST_SYNC_TIME)
      const storedValue = result[STORAGE_KEYS.ACTIVITY_LAST_SYNC_TIME]
      
      if (storedValue) {
        const lastSyncTime = new Date(storedValue)
        logger.debug('Loaded last sync time from storage', {
          lastSyncTime: lastSyncTime.toISOString()
        })
        return lastSyncTime
      }
      
      return null
    } catch (error) {
      logger.error('Failed to load last sync time', error)
      return null
    }
  }

  async saveLastHeartbeatTime(lastHeartbeatTime: number): Promise<void> {
    try {
      await BrowserAPI.storage.set({ 
        [STORAGE_KEYS.ACTIVITY_LAST_HEARTBEAT_TIME]: lastHeartbeatTime 
      })
    } catch (error) {
      logger.error('Failed to save last heartbeat time', error)
      throw error
    }
  }

  async loadLastHeartbeatTime(): Promise<number | null> {
    try {
      const result = await BrowserAPI.storage.get<number>(STORAGE_KEYS.ACTIVITY_LAST_HEARTBEAT_TIME)
      return result[STORAGE_KEYS.ACTIVITY_LAST_HEARTBEAT_TIME] || null
    } catch (error) {
      logger.error('Failed to load last heartbeat time', error)
      return null
    }
  }

  /**
   * Monitor storage quota and return usage information
   */
  async getStorageQuotaInfo(): Promise<{
    usedBytes: number
    totalBytes: number
    percentUsed: number
    isNearLimit: boolean
  }> {
    try {
      if (chrome?.storage?.local?.getBytesInUse) {
        const usedBytes = await new Promise<number>((resolve) => {
          chrome.storage.local.getBytesInUse(null, (bytes) => {
            resolve(bytes || 0)
          })
        })
        
        const totalBytes = chrome.storage.local.QUOTA_BYTES || 10485760
        const percentUsed = (usedBytes / totalBytes) * 100
        const isNearLimit = percentUsed > 80
        
        if (isNearLimit) {
          logger.warn('Storage quota approaching limit', {
            usedBytes,
            totalBytes,
            percentUsed: percentUsed.toFixed(2),
            usedMB: (usedBytes / 1024 / 1024).toFixed(2),
            totalMB: (totalBytes / 1024 / 1024).toFixed(2)
          })
        }
        
        return { usedBytes, totalBytes, percentUsed, isNearLimit }
      }
      
      return { usedBytes: 0, totalBytes: 0, percentUsed: 0, isNearLimit: false }
    } catch (error) {
      logger.error('Failed to get storage quota info', error)
      return { usedBytes: 0, totalBytes: 0, percentUsed: 0, isNearLimit: false }
    }
  }
}


import type { ActivityRecord, ActivitySettings } from '../../types'
import { DEFAULT_BACKEND_URL } from '../../../lib/constants'
import { BackgroundConfig } from '../../config'
import { createLogger } from '../../utils/logger'
import { ActivityStorageService } from './activity-storage.service'
import { ActivityQueueManager } from './activity-queue-manager'
import type { SyncResponse, FailedSyncItem } from './types'
import { MAX_SYNC_RETRIES, INITIAL_RETRY_DELAY_MS, RETRY_BACKOFF_MULTIPLIER } from './constants'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.ACTIVITY)

export interface SyncServiceDependencies {
  devToken: string | null
  backendUrl: string
  browserProfileId: string | null
  settings: ActivitySettings
  storageService: ActivityStorageService
  queueManager: ActivityQueueManager
  calculateDuration: (start: Date, end: Date) => number
  ensureBrowserProfileId: () => Promise<void>
}

export class ActivitySyncService {
  private devToken: string | null = null
  private backendUrl: string = DEFAULT_BACKEND_URL
  private browserProfileId: string | null = null
  private settings: ActivitySettings
  private storageService: ActivityStorageService
  private queueManager: ActivityQueueManager
  private calculateDuration: (start: Date, end: Date) => number
  private ensureBrowserProfileId: () => Promise<void>
  
  private lastCheckpoint: string | null = null
  private isSyncRunning: boolean = false
  private lastSyncTime: Date | null = null
  private totalSyncedCount: number = 0

  constructor(dependencies: SyncServiceDependencies) {
    this.devToken = dependencies.devToken
    this.backendUrl = dependencies.backendUrl
    this.browserProfileId = dependencies.browserProfileId
    this.settings = dependencies.settings
    this.storageService = dependencies.storageService
    this.queueManager = dependencies.queueManager
    this.calculateDuration = dependencies.calculateDuration
    this.ensureBrowserProfileId = dependencies.ensureBrowserProfileId
  }

  updateDependencies(dependencies: Partial<SyncServiceDependencies>): void {
    if (dependencies.devToken !== undefined) this.devToken = dependencies.devToken
    if (dependencies.backendUrl !== undefined) this.backendUrl = dependencies.backendUrl
    if (dependencies.browserProfileId !== undefined) this.browserProfileId = dependencies.browserProfileId
    if (dependencies.settings !== undefined) this.settings = dependencies.settings
  }

  getLastCheckpoint(): string | null {
    return this.lastCheckpoint
  }

  setLastCheckpoint(checkpoint: string | null): void {
    this.lastCheckpoint = checkpoint
  }

  isSyncInProgress(): boolean {
    return this.isSyncRunning
  }

  getLastSyncTime(): Date | null {
    return this.lastSyncTime
  }

  setLastSyncTime(syncTime: Date | null): void {
    this.lastSyncTime = syncTime
  }

  getTotalSyncedCount(): number {
    return this.totalSyncedCount
  }

  async loadCheckpoint(): Promise<void> {
    this.lastCheckpoint = await this.storageService.loadCheckpoint()
  }

  async validateSyncPrerequisites(): Promise<boolean> {
    const batchQueue = this.queueManager.getBatchQueue()
    
    logger.debug('Sync batch check', { 
      batchSize: batchQueue.length, 
      hasDevToken: !!this.devToken, 
      syncEnabled: this.settings.syncEnabled,
      settings: this.settings
    })
    
    if (!this.devToken || !this.settings.syncEnabled) {
      logger.info('Batch sync skipped', { 
        batchSize: batchQueue.length, 
        hasDevToken: !!this.devToken, 
        syncEnabled: this.settings.syncEnabled,
        reason: !this.devToken ? 'no_dev_token' : !this.settings.syncEnabled ? 'sync_disabled' : 'empty_queue'
      })
      return false
    }

    if (!this.browserProfileId) {
      await this.ensureBrowserProfileId()
      if (!this.browserProfileId) {
        logger.warn('No browser profile ID found, syncing with null browser_profile_id', {
          batchSize: batchQueue.length
        })
      }
    }

    return true
  }

  async prepareSyncBatch(): Promise<ActivityRecord[]> {
    const batchQueue = this.queueManager.getBatchQueue()
    const currentActivity = this.queueManager.getCurrentActivity()
    
    logger.info('Starting batch sync preparation', { 
      batchSize: batchQueue.length,
      currentActivityId: currentActivity?.id
    })

    const now = new Date()
    const lastHeartbeat = await this.storageService.loadLastHeartbeatTime()
    const threshold = Math.max(this.settings.heartbeatInterval * 2000, (this.settings.sleepThreshold || 60) * 1000)
    
    logger.info('Before sync preparation', {
      batchSize: batchQueue.length,
      currentActivityId: currentActivity?.id,
      queueActivities: batchQueue.map(a => ({
        id: a.id,
        hasEndTime: !!a.end_time,
        url: a.url.substring(0, 50)
      }))
    })
    
    const batchToSync: ActivityRecord[] = []
    const seenKeys = new Set<string>()
    
    for (const activity of batchQueue) {
      if (this.queueManager.isStuckActivity(activity, now)) {
        continue
      }
      
      let activityForSync = activity
      
      if (currentActivity?.id === activity.id && !activity.end_time) {
        let endTime = now
        if (lastHeartbeat) {
          const gap = now.getTime() - lastHeartbeat
          if (gap > threshold) {
            endTime = new Date(lastHeartbeat)
          }
        }

        activityForSync = {
          ...activity,
          end_time: endTime,
          duration: this.calculateDuration(activity.start_time, endTime)
        }
        
        logger.debug('Created sync copy with temporary end_time for current activity', {
          id: activity.id,
          url: activity.url.substring(0, 50),
          startTime: activity.start_time.toISOString(),
          tempEndTime: endTime.toISOString(),
          duration: activityForSync.duration
        })
      }
      
      const endTime = activityForSync.end_time || now
      const duration = this.calculateDuration(activityForSync.start_time, endTime)
      const meetsMinimumDuration = duration >= this.settings.minimumDuration
      
      if (!meetsMinimumDuration) {
        logger.debug('Filtering out short duration activity during sync', {
          id: activityForSync.id,
          url: activityForSync.url,
          duration,
          minimumDuration: this.settings.minimumDuration
        })
        continue
      }
      
      const timeWindow = Math.floor(activityForSync.start_time.getTime() / 5000) * 5000
      const duplicateKey = `${activityForSync.tab_id}_${activityForSync.url}_${activityForSync.session_id}_${timeWindow}`
      
      if (seenKeys.has(duplicateKey)) {
        const existingIndex = batchToSync.findIndex(existing => {
          const existingTimeWindow = Math.floor(existing.start_time.getTime() / 5000) * 5000
          const existingKey = `${existing.tab_id}_${existing.url}_${existing.session_id}_${existingTimeWindow}`
          return existingKey === duplicateKey
        })
        
        if (existingIndex !== -1) {
          const existing = batchToSync[existingIndex]
          const existingEndTime = existing.end_time || now
          const existingDuration = this.calculateDuration(existing.start_time, existingEndTime)
          
          if (duration > existingDuration || 
              (duration === existingDuration && activityForSync.start_time < existing.start_time)) {
            logger.debug('Replacing duplicate activity with longer duration', {
              replacingId: existing.id,
              replacingDuration: existingDuration,
              withId: activityForSync.id,
              withDuration: duration,
              url: activityForSync.url.substring(0, 50),
              tabId: activityForSync.tab_id
            })
            batchToSync[existingIndex] = activityForSync
          } else {
            logger.debug('Skipping duplicate activity (shorter duration)', {
              keepingId: existing.id,
              keepingDuration: existingDuration,
              skippingId: activityForSync.id,
              skippingDuration: duration,
              url: activityForSync.url.substring(0, 50),
              tabId: activityForSync.tab_id
            })
          }
        }
      } else {
        seenKeys.add(duplicateKey)
        batchToSync.push(activityForSync)
      }
    }
    
    logger.info('Batch prepared for sync', {
      batchSize: batchToSync.length,
      originalQueueSize: batchQueue.length,
      duplicatesRemoved: batchQueue.length - batchToSync.length
    })
    
    return batchToSync
  }

  async sendSyncRequestWithRetry(batchToSync: ActivityRecord[]): Promise<void> {
    let retryCount = 0
    
    while (retryCount <= MAX_SYNC_RETRIES) {
      try {
        if (!this.devToken || !this.devToken.includes('.')) {
          logger.error('Invalid dev token format', {
            hasToken: !!this.devToken,
            tokenLength: this.devToken?.length || 0
          })
          throw new Error('Invalid dev token format')
        }

        const tokenParts = this.devToken.split('.')
        if (tokenParts.length !== 2 || !tokenParts[0] || !tokenParts[1]) {
          logger.error('Invalid dev token format', {
            partsCount: tokenParts.length
          })
          throw new Error('Invalid dev token format')
        }

        logger.debug('Sending batch sync request', {
          batchSize: batchToSync.length,
          tokenFormat: 'valid',
          userId: tokenParts[0]
        })

        const response = await fetch(`${this.backendUrl}/api/sync/browsing-activity/batch`, {
          method: 'POST',
          headers: {
            'AuthSyncToken': this.devToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            browser_profile_id: this.browserProfileId,
            checkpoint: this.lastCheckpoint || new Date().toISOString(),
            activities: batchToSync.map(this.formatActivityForSync)
          })
        })

        if (!response.ok) {
          throw new Error(`Batch sync failed: ${response.status}`)
        }

        const result = await response.json() as SyncResponse
        
        if (result.success) {
          if (result.checkpoint) {
            this.lastCheckpoint = result.checkpoint
            await this.storageService.saveCheckpoint(result.checkpoint)
          }
          
          this.isSyncRunning = false
          this.lastSyncTime = new Date()
          this.totalSyncedCount += batchToSync.length
          
          await this.storageService.saveLastSyncTime(this.lastSyncTime)
          
          logger.info('Batch sync successful', { 
            processed: result.processed, 
            created: result.created,
            updated: result.updated || 0,
            duplicates: result.duplicates,
            checkpoint: result.checkpoint,
            currentActivityId: this.queueManager.getCurrentActivity()?.id
          })
          return
        } else {
          logger.error('Batch sync partial failure', { 
            result,
            failedCount: result.failed_items?.length || 0,
            totalItems: batchToSync.length
          })
          
          this.isSyncRunning = false
          
          if (result.failed_items) {
            result.failed_items.forEach((failed: FailedSyncItem) => {
              if (batchToSync[failed.index]?.id) {
                const failedActivity = batchToSync[failed.index]
                this.queueManager.addActivityToQueue(failedActivity)
                logger.debug('Requeued failed item', { 
                  index: failed.index, 
                  url: failedActivity.url,
                  error: failed.error 
                })
              }
            })
            
            await this.storageService.saveBatchQueue(this.queueManager.getBatchQueue())
          }
          return
        }
      } catch (error) {
        retryCount++
        logger.error(`Batch sync failed (attempt ${retryCount}/${MAX_SYNC_RETRIES + 1})`, error)
        
        if (retryCount <= MAX_SYNC_RETRIES) {
          const delay = Math.pow(RETRY_BACKOFF_MULTIPLIER, retryCount - 1) * INITIAL_RETRY_DELAY_MS
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          logger.error('Batch sync failed after all retries, requeuing all items', { 
            itemCount: batchToSync.length,
            retryAttempts: MAX_SYNC_RETRIES + 1
          })
          
          for (const activity of batchToSync) {
            this.queueManager.addActivityToQueue(activity)
          }
          
          await this.storageService.saveBatchQueue(this.queueManager.getBatchQueue())
          
          this.isSyncRunning = false
        }
      }
    }
  }

  async cleanupSyncedActivities(batchToSync: ActivityRecord[]): Promise<void> {
    const now = new Date()
    const syncedActivityIds = new Set(batchToSync.map(a => a.id))
    const currentActivity = this.queueManager.getCurrentActivity()
    const lastHeartbeatData = this.queueManager.getLastHeartbeatData()
    const batchQueue = this.queueManager.getBatchQueue()
    
    logger.info('Cleaning up synced activities', {
      beforeCleanupCount: batchQueue.length,
      currentActivityId: currentActivity?.id,
      batchToSyncCount: batchToSync.length
    })
    
    const filterResults = {
      kept: [] as string[],
      removed: [] as string[],
      keptCurrent: false,
      removedSynced: [] as string[],
      removedStuck: [] as string[]
    }
    
    this.queueManager.filterQueue(activity => {
      const isCurrentActivityById = currentActivity && activity.id === currentActivity.id
      const isCurrentActivityByHeartbeat = lastHeartbeatData && 
        activity.url === lastHeartbeatData.url &&
        activity.tab_id === lastHeartbeatData.tabId
      
      if (isCurrentActivityById || isCurrentActivityByHeartbeat) {
        if (!currentActivity && isCurrentActivityByHeartbeat) {
          this.queueManager.setCurrentActivity(activity)
        }
        filterResults.keptCurrent = true
        filterResults.kept.push(activity.id || 'unknown')
        return true
      }
      
      if (activity.end_time && syncedActivityIds.has(activity.id)) {
        filterResults.removedSynced.push(activity.id || 'unknown')
        filterResults.removed.push(activity.id || 'unknown')
        return false
      }
      
      if (this.queueManager.isStuckActivity(activity, now)) {
        filterResults.removedStuck.push(activity.id || 'unknown')
        filterResults.removed.push(activity.id || 'unknown')
        return false
      }
      
      filterResults.kept.push(activity.id || 'unknown')
      return true
    })
    
    if (!this.queueManager.validateQueueConsistency()) {
      logger.error('Queue inconsistency detected after cleanup - attempting to repair')
      this.queueManager.rebuildMap()
    }
    
    this.queueManager.ensureCurrentActivityValid()
    
    if (!this.queueManager.getCurrentActivity() && lastHeartbeatData) {
      const matchingActivity = this.queueManager.getBatchQueue().find(a => 
        a.url === lastHeartbeatData.url &&
        a.tab_id === lastHeartbeatData.tabId
      )
      if (matchingActivity) {
        logger.info('Restored current activity after cleanup by matching heartbeat', {
          id: matchingActivity.id,
          url: matchingActivity.url
        })
        this.queueManager.setCurrentActivity(matchingActivity)
      }
    }
    
    await this.storageService.saveBatchQueue(this.queueManager.getBatchQueue())
    
    logger.info('Batch queue cleaned up after sync', {
      kept: filterResults.kept.length,
      removed: filterResults.removed.length,
      keptCurrent: filterResults.keptCurrent,
      removedSynced: filterResults.removedSynced.length,
      removedStuck: filterResults.removedStuck.length,
      remainingCount: this.queueManager.getBatchQueue().length
    })
  }

  private formatActivityForSync(activity: ActivityRecord): Record<string, any> {
    return {
      url: activity.url,
      title: activity.title,
      domain: activity.domain,
      start_time: activity.start_time.toISOString(),
      end_time: activity.end_time ? activity.end_time.toISOString() : null,
      duration: activity.duration || null,
      tab_id: activity.tab_id,
      window_id: activity.window_id,
      session_id: activity.session_id,
      audible: activity.audible ?? null,
      incognito: activity.incognito ?? null,
      metadata: activity.metadata || null
    }
  }

  async syncBatch(): Promise<void> {
    if (this.isSyncRunning) {
      logger.debug('Sync already in progress, skipping concurrent call')
      return
    }
    
    if (!await this.validateSyncPrerequisites()) {
      return
    }

    this.isSyncRunning = true
    
    const batchToSync = await this.prepareSyncBatch()
    if (batchToSync.length === 0) {
      this.isSyncRunning = false
      return
    }

    await this.sendSyncRequestWithRetry(batchToSync)
    
    await this.cleanupSyncedActivities(batchToSync)
  }
}

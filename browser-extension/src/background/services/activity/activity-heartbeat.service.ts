import type { 
  HeartbeatData, 
  ActivitySettings,
  ActivityRecord
} from '../../types'
import { createLogger } from '../../utils/logger'
import { BackgroundConfig } from '../../config'
import type { ActivityQueueManager } from './activity-queue-manager'
import type { ActivityStorageService } from './activity-storage.service'
import type { ActivitySessionService } from './activity-session.service'
import { deepEqual } from './utils'
import { RESUME_THRESHOLD_MS, SESSION_URL_RESUME_THRESHOLD_MS } from './constants'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.ACTIVITY + ':Heartbeat')

export interface HeartbeatServiceOptions {
  queueManager: ActivityQueueManager
  storageService: ActivityStorageService
  sessionService: ActivitySessionService
  getSettings: () => ActivitySettings
  isBackendHealthy: () => boolean
  createActivity: (heartbeatData: HeartbeatData) => Promise<ActivityRecord | null>
  finalizeActivity: (activityId: string) => Promise<void>
  queueHeartbeat: (tab: chrome.tabs.Tab) => Promise<void>
  getTabCount: () => Promise<number>
}

export class ActivityHeartbeatService {
  private lastHeartbeatTime: number | null = null
  private isPausedDueToSleep: boolean = false

  constructor(private options: HeartbeatServiceOptions) {}

  async sendHeartbeat(tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.url || !tab.title || !tab.active || this.isPausedDueToSleep) return

    const now = Date.now()
    const settings = this.options.getSettings()
    
    if (this.lastHeartbeatTime) {
      const gap = now - this.lastHeartbeatTime
      const threshold = Math.max(settings.heartbeatInterval * 2000, (settings.sleepThreshold || 60) * 1000)
      
      if (gap > threshold) {
        const currentActivity = this.options.sessionService.getCurrentActivity()
        if (currentActivity?.id && !currentActivity.end_time) {
          await this.options.finalizeActivity(currentActivity.id)
        }
        this.options.queueManager.setLastHeartbeatData(null)
        this.isPausedDueToSleep = false
      }
    }
    
    this.lastHeartbeatTime = now
    this.options.storageService.saveLastHeartbeatTime(now).catch(() => {})

    if (!settings.enabled) return
    if (tab.incognito && settings.incognitoMode === 'ignore') return

    if (!this.options.isBackendHealthy()) {
      await this.options.queueHeartbeat(tab)
      return
    }

    try {
      const heartbeatData: HeartbeatData = {
        url: tab.url,
        title: tab.title,
        audible: tab.audible || false,
        incognito: tab.incognito || false,
        tabCount: await this.options.getTabCount(),
        tabId: tab.id!,
        windowId: tab.windowId!
      }

      const lastHeartbeatData = this.options.queueManager.getLastHeartbeatData()
      const currentActivity = this.options.sessionService.getCurrentActivity()

      if (lastHeartbeatData && deepEqual(lastHeartbeatData, heartbeatData)) {
        if (currentActivity && !currentActivity.end_time) {
          const activityAge = now - currentActivity.start_time.getTime()
          if (activityAge > 4 * 60 * 60 * 1000) {
            await this.options.finalizeActivity(currentActivity.id!)
            this.options.queueManager.setLastHeartbeatData(null)
            return
          }
        }
        
        if (!currentActivity) {
          const matchingActivity = this.findExistingActiveActivity(heartbeatData)
          if (matchingActivity) {
            this.options.sessionService.setCurrentActivity(matchingActivity)
          } else {
            await this.options.createActivity(heartbeatData)
            this.options.queueManager.setLastHeartbeatData(heartbeatData)
            return
          }
        }
        return
      }
      
      const existingActiveActivity = this.findExistingActiveActivity(heartbeatData)
      
      if (existingActiveActivity) {
        if (existingActiveActivity.url !== heartbeatData.url) {
          if (existingActiveActivity.id && !existingActiveActivity.end_time) {
            await this.options.finalizeActivity(existingActiveActivity.id)
          }
        } else {
          if (existingActiveActivity.end_time) {
            const activityWithoutEnd: Partial<ActivityRecord> = { ...existingActiveActivity }
            delete activityWithoutEnd.end_time
            delete activityWithoutEnd.duration
            
            if (existingActiveActivity.id) {
              this.options.queueManager.updateActivity(existingActiveActivity.id, activityWithoutEnd)
              await this.options.storageService.saveBatchQueue(this.options.queueManager.getBatchQueue())
            }
          }
          
          this.options.sessionService.setCurrentActivity(existingActiveActivity)
          this.options.queueManager.setLastHeartbeatData(heartbeatData)
          this.options.sessionService.updateSessionLastActivity()
          return
        }
      }

      if (currentActivity?.id) {
        await this.options.finalizeActivity(currentActivity.id)
      }

      await this.options.createActivity(heartbeatData)
      this.options.queueManager.setLastHeartbeatData(heartbeatData)
      this.options.sessionService.updateSessionLastActivity()
    } catch (error) {
      logger.error('Failed to send heartbeat', error)
      await this.options.queueHeartbeat(tab)
    }
  }

  private findExistingActiveActivity(heartbeatData: HeartbeatData): ActivityRecord | null {
    const now = new Date()
    const batchQueue = this.options.queueManager.getBatchQueue()
    const sessionInfo = this.options.sessionService.getSessionInfo()
    const currentSessionId = sessionInfo?.id || 'unknown'
    
    for (const activity of batchQueue) {
      if (activity.tab_id === heartbeatData.tabId && activity.url === heartbeatData.url) {
        const isRecent = !activity.end_time || (now.getTime() - activity.end_time.getTime() < RESUME_THRESHOLD_MS)
        if (isRecent) return activity
      }
    }
    
    const matchingByWindowSession = batchQueue.find(activity => {
      if (activity.window_id !== heartbeatData.windowId || activity.session_id !== currentSessionId || activity.url !== heartbeatData.url) return false
      return !activity.end_time || (now.getTime() - activity.end_time.getTime() < RESUME_THRESHOLD_MS)
    })
    
    if (matchingByWindowSession) return matchingByWindowSession
    
    return batchQueue.find(activity => {
      if (activity.session_id !== currentSessionId || activity.url !== heartbeatData.url) return false
      return !activity.end_time || (now.getTime() - activity.end_time.getTime() < SESSION_URL_RESUME_THRESHOLD_MS)
    }) || null
  }

  setPausedDueToSleep(paused: boolean): void {
    this.isPausedDueToSleep = paused
  }

  setLastHeartbeatTime(time: number | null): void {
    this.lastHeartbeatTime = time
  }

  getLastHeartbeatTime(): number | null {
    return this.lastHeartbeatTime
  }
}


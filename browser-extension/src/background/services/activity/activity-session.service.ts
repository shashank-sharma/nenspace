import type { 
  ActivityRecord, 
  HeartbeatData, 
  ActivitySettings,
  SessionInfo
} from '../../types'
import type { StoredAuth } from '../../../lib/types'
import { createLogger } from '../../utils/logger'
import { BackgroundConfig } from '../../config'
import type { ActivityQueueManager } from './activity-queue-manager'
import type { ActivityStorageService } from './activity-storage.service'
import { AUTO_FINALIZE_MIN_TIMEOUT_MS, STUCK_ACTIVITY_THRESHOLD_MS } from './constants'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.ACTIVITY + ':Session')

export interface SessionServiceOptions {
  queueManager: ActivityQueueManager
  storageService: ActivityStorageService
  getSettings: () => ActivitySettings
  getAuth: () => StoredAuth | null
  getDevToken: () => string | null
  getBrowserProfileId: () => string | null
  calculateDuration: (startTime: Date, endTime: Date) => number
  onSyncNeeded: () => Promise<void>
}

export class ActivitySessionService {
  private sessionInfo: SessionInfo | null = null
  private currentActivity: ActivityRecord | null = null

  constructor(private options: SessionServiceOptions) {}

  async initializeSession(profileId: string): Promise<SessionInfo> {
    const sessionId = `${profileId}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    this.sessionInfo = {
      id: sessionId,
      startTime: new Date(),
      lastActivity: new Date(),
      profileId: profileId
    }
    return this.sessionInfo
  }

  getSessionInfo(): SessionInfo | null {
    return this.sessionInfo
  }

  updateSessionLastActivity(): void {
    if (this.sessionInfo) {
      this.sessionInfo.lastActivity = new Date()
    }
  }

  getCurrentActivity(): ActivityRecord | null {
    return this.currentActivity
  }

  setCurrentActivity(activity: ActivityRecord | null): void {
    this.currentActivity = activity
  }

  async createActivity(heartbeatData: HeartbeatData): Promise<ActivityRecord | null> {
    const now = new Date()
    const settings = this.options.getSettings()
    const auth = this.options.getAuth()
    const devToken = this.options.getDevToken()
    const browserProfileId = this.options.getBrowserProfileId()

    if (this.currentActivity && !this.currentActivity.end_time && (now.getTime() - this.currentActivity.start_time.getTime()) > STUCK_ACTIVITY_THRESHOLD_MS) {
      if (this.currentActivity.id) {
        this.options.queueManager.clearActivityTimeout(this.currentActivity.id)
        this.options.queueManager.removeActivity(this.currentActivity.id)
      }
      this.currentActivity = null
    }
    
    if (!auth?.primaryToken && !auth?.userId && !devToken) return null

    const activityData: ActivityRecord = {
      id: Math.random().toString(36).slice(2, 11),
      user: auth?.userId || 'anonymous',
      browser_profile: browserProfileId || 'unknown',
      url: heartbeatData.url,
      title: heartbeatData.title,
      domain: this.extractDomain(heartbeatData.url),
      start_time: now,
      tab_id: heartbeatData.tabId,
      window_id: heartbeatData.windowId,
      audible: heartbeatData.audible,
      incognito: heartbeatData.incognito,
      metadata: { tabCount: heartbeatData.tabCount },
      session_id: this.sessionInfo?.id || 'unknown'
    }

    this.options.queueManager.addActivityToQueue(activityData)
    this.currentActivity = activityData
    await this.options.storageService.saveBatchQueue(this.options.queueManager.getBatchQueue())
    
    const activityId = activityData.id
    if (activityId) {
      const timeoutId = setTimeout(async () => {
        this.options.queueManager.clearActivityTimeout(activityId)
        if (this.currentActivity?.id === activityId) {
          await this.finalizeActivity(activityId)
        }
      }, Math.max(settings.minimumDuration * 1000, AUTO_FINALIZE_MIN_TIMEOUT_MS))
      this.options.queueManager.setActivityTimeout(activityId, timeoutId)
    }
    
    await this.options.onSyncNeeded()
    return activityData
  }

  async finalizeActivity(activityId: string): Promise<void> {
    this.options.queueManager.clearActivityTimeout(activityId)
    
    const now = new Date()
    const duration = this.currentActivity ? this.options.calculateDuration(this.currentActivity.start_time, now) : 0
    const settings = this.options.getSettings()

    if (duration < settings.minimumDuration) {
      if (this.options.queueManager.removeActivity(activityId)) {
        await this.options.storageService.saveBatchQueue(this.options.queueManager.getBatchQueue())
      }
      this.currentActivity = null
      return
    }

    if (this.currentActivity?.id === activityId) {
      if (this.options.queueManager.updateActivity(activityId, { end_time: now, duration })) {
        await this.options.storageService.saveBatchQueue(this.options.queueManager.getBatchQueue())
        await this.options.onSyncNeeded()
        this.currentActivity = null
      }
    }
  }

  private extractDomain(url: string): string {
    try { return new URL(url).hostname } catch { return '' }
  }
}


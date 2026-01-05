import { createLogger } from '../../utils/logger'
import { BackgroundConfig } from '../../config'
import type { ActivityHeartbeatService } from './activity-heartbeat.service'
import type { ActivitySessionService } from './activity-session.service'
import type { ActivityQueueManager } from './activity-queue-manager'
import type { ActivityStorageService } from './activity-storage.service'
import type { ActivityRecord } from '../../types'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.ACTIVITY + ':Idle')

export interface IdleDetectionOptions {
  heartbeatService: ActivityHeartbeatService
  sessionService: ActivitySessionService
  queueManager: ActivityQueueManager
  storageService: ActivityStorageService
  finalizeActivity: (activityId: string) => Promise<void>
  calculateDuration: (startTime: Date, endTime: Date) => number
}

export class ActivityIdleDetectionService {
  constructor(private options: IdleDetectionOptions) {}

  setupIdleDetection(): void {
    try {
      const idleAPI = (globalThis as any).browser?.idle || chrome.idle
      if (idleAPI?.onStateChanged) {
        idleAPI.onStateChanged.addListener((newState: chrome.idle.IdleState) => {
          this.handleIdleStateChange(newState)
        })
        idleAPI.queryState(60, (state: chrome.idle.IdleState) => {
          this.handleIdleStateChange(state)
        })
      }
    } catch (error) {
      logger.warn('Failed to setup idle detection', error)
    }
  }

  private handleIdleStateChange(newState: chrome.idle.IdleState): void {
    if (newState === 'locked' || newState === 'idle') {
      this.options.heartbeatService.setPausedDueToSleep(true)
      const currentActivity = this.options.sessionService.getCurrentActivity()
      if (currentActivity?.id) {
        this.options.finalizeActivity(currentActivity.id).catch(() => {})
      }
    } else if (newState === 'active') {
      this.options.heartbeatService.setPausedDueToSleep(false)
      this.options.heartbeatService.setLastHeartbeatTime(null)
      this.options.queueManager.setLastHeartbeatData(null)
    }
  }

  setupBrowserLifecycleHooks(): void {
    try {
      const runtimeAPI = (globalThis as any).browser?.runtime || chrome.runtime
      if (runtimeAPI?.onSuspend) {
        runtimeAPI.onSuspend.addListener(() => {
          const currentActivity = this.options.sessionService.getCurrentActivity()
          if (currentActivity?.id && !currentActivity.end_time) {
            const now = new Date()
            this.options.queueManager.updateActivity(currentActivity.id, {
              ...currentActivity,
              end_time: now,
              duration: this.options.calculateDuration(currentActivity.start_time, now)
            })
          }
          this.options.heartbeatService.setPausedDueToSleep(true)
          this.options.heartbeatService.setLastHeartbeatTime(null)
          
          const batchQueue = this.options.queueManager.getBatchQueue()
          if (batchQueue.length > 0) this.options.storageService.saveBatchQueueSync(batchQueue)
          // offlineQueue handling moved to orchestrator
        })
      }
      if (runtimeAPI?.onSuspendCanceled) {
        runtimeAPI.onSuspendCanceled.addListener(() => { 
          this.options.heartbeatService.setPausedDueToSleep(false) 
        })
      }
    } catch (error) {
      logger.error('Failed to setup browser lifecycle hooks', error)
    }
  }
}


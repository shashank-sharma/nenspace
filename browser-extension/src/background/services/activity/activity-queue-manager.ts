/**
 * Activity Queue Manager
 * Manages batch queue operations, consistency validation, and current activity tracking
 */

import type { ActivityRecord, HeartbeatData } from '../../types'
import { BackgroundConfig } from '../../config'
import { createLogger } from '../../utils/logger'
import { STUCK_ACTIVITY_THRESHOLD_MS, MAX_QUEUE_SIZE } from './constants'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.ACTIVITY)

/**
 * Manages activity queues and ensures consistency
 */
export class ActivityQueueManager {
  private batchQueue: ActivityRecord[] = []
  private batchQueueMap: Map<string, ActivityRecord> = new Map()
  private currentActivity: ActivityRecord | null = null
  private activityTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private lastHeartbeatData: HeartbeatData | null = null

  /**
   * Gets the current batch queue
   */
  getBatchQueue(): ActivityRecord[] {
    return this.batchQueue
  }

  /**
   * Gets the batch queue Map for O(1) lookups
   */
  getBatchQueueMap(): Map<string, ActivityRecord> {
    return this.batchQueueMap
  }

  /**
   * Gets the current activity
   */
  getCurrentActivity(): ActivityRecord | null {
    return this.currentActivity
  }

  /**
   * Sets the current activity
   */
  setCurrentActivity(activity: ActivityRecord | null): void {
    this.currentActivity = activity
  }

  /**
   * Gets the last heartbeat data
   */
  getLastHeartbeatData(): HeartbeatData | null {
    return this.lastHeartbeatData
  }

  /**
   * Sets the last heartbeat data
   */
  setLastHeartbeatData(data: HeartbeatData | null): void {
    this.lastHeartbeatData = data
  }

  /**
   * Initializes queues from loaded data
   */
  initializeQueues(batchQueue: ActivityRecord[]): void {
    this.batchQueue = batchQueue
    this.rebuildMap()
  }

  /**
   * Rebuilds the Map from the array
   */
  rebuildMap(): void {
    this.batchQueueMap.clear()
    for (const activity of this.batchQueue) {
      if (activity.id) {
        this.batchQueueMap.set(activity.id, activity)
      }
    }
  }

  /**
   * Validates queue consistency between array and Map
   */
  validateQueueConsistency(): boolean {
    const arrayIds = new Set(this.batchQueue.map(a => a.id).filter(Boolean))
    const mapIds = new Set(this.batchQueueMap.keys())
    
    if (arrayIds.size !== mapIds.size) {
      logger.error('Queue inconsistency detected', {
        arraySize: arrayIds.size,
        mapSize: mapIds.size,
        arrayIds: Array.from(arrayIds),
        mapIds: Array.from(mapIds)
      })
      return false
    }
    
    // Check all IDs match
    for (const id of arrayIds) {
      if (!id) continue // Skip undefined IDs
      if (!mapIds.has(id)) {
        logger.error('Activity in array but not in Map', { id })
        return false
      }
      const mapActivity = this.batchQueueMap.get(id)
      const arrayActivity = this.batchQueue.find(a => a.id === id)
      if (mapActivity !== arrayActivity) {
        logger.error('Activity reference mismatch between array and Map', { id })
        return false
      }
    }
    
    return true
  }

  /**
   * Ensures currentActivity reference is valid and points to an activity in the queue
   * Clears reference if activity was removed
   */
  ensureCurrentActivityValid(): void {
    if (!this.currentActivity?.id) return
    
    // Refresh reference from Map to ensure it's current
    const freshActivity = this.batchQueueMap.get(this.currentActivity.id)
    if (freshActivity) {
      this.currentActivity = freshActivity
    } else {
      // Activity was removed, clear reference
      logger.warn('Current activity removed from queue, clearing reference', {
        previousId: this.currentActivity.id
      })
      this.currentActivity = null
    }
  }

  /**
   * Helper to check if an activity is stuck (old and without end_time)
   */
  isStuckActivity(activity: ActivityRecord, now: Date): boolean {
    if (activity.end_time) return false // Finalized activities aren't stuck
    
    const ageMs = now.getTime() - activity.start_time.getTime()
    const isOld = ageMs > STUCK_ACTIVITY_THRESHOLD_MS
    const isNotCurrent = !this.currentActivity || activity.id !== this.currentActivity.id
    
    return isOld && isNotCurrent
  }

  /**
   * Adds activity to batch queue with size limit enforcement
   * Evicts oldest activities if queue exceeds MAX_QUEUE_SIZE
   * Prevents duplicates by checking for same tab_id + url + overlapping time range
   */
  addActivityToQueue(activity: ActivityRecord): void {
    // Check for duplicate: same tab_id, url, and overlapping time range
    const duplicate = this.batchQueue.find(existing => {
      const sameTabAndUrl = existing.tab_id === activity.tab_id && 
                           existing.url === activity.url &&
                           existing.session_id === activity.session_id
      
      if (!sameTabAndUrl) return false
      
      // Check if time ranges overlap (within 5 seconds of start_time)
      const timeDiff = Math.abs(
        existing.start_time.getTime() - activity.start_time.getTime()
      )
      const isOverlapping = timeDiff < 5000 // 5 seconds threshold
      
      return isOverlapping
    })
    
    if (duplicate) {
      logger.warn('Duplicate activity detected, skipping addition', {
        existingId: duplicate.id,
        existingStartTime: duplicate.start_time.toISOString(),
        newId: activity.id,
        newStartTime: activity.start_time.toISOString(),
        url: activity.url.substring(0, 50),
        tabId: activity.tab_id,
        timeDiffMs: Math.abs(duplicate.start_time.getTime() - activity.start_time.getTime())
      })
      return // Skip adding duplicate
    }
    
    this.batchQueue.push(activity)
    if (activity.id) {
      this.batchQueueMap.set(activity.id, activity)
    }
    
    // Evict oldest if queue too large
    if (this.batchQueue.length > MAX_QUEUE_SIZE) {
      const removed = this.batchQueue.shift()
      if (removed?.id) {
        this.batchQueueMap.delete(removed.id)
        logger.warn('Queue size limit reached, evicted oldest activity', {
          evictedId: removed.id,
          queueSize: this.batchQueue.length
        })
      }
    }
  }

  /**
   * Updates an activity in the queue
   */
  updateActivity(activityId: string, data: Partial<ActivityRecord>): boolean {
    const existingActivity = this.batchQueueMap.get(activityId)
    if (!existingActivity) {
      return false
    }

    const updated = { ...existingActivity, ...data }
    this.batchQueueMap.set(activityId, updated)
    
    const index = this.batchQueue.findIndex(a => a.id === activityId)
    if (index !== -1) {
      this.batchQueue[index] = updated
      
      // Update currentActivity reference if it's the same activity
      if (this.currentActivity?.id === activityId) {
        this.currentActivity = updated
      }
      
      return true
    }
    
    return false
  }

  /**
   * Removes an activity from the queue
   */
  removeActivity(activityId: string): boolean {
    const index = this.batchQueue.findIndex(a => a.id === activityId)
    if (index === -1) {
      return false
    }

    const removed = this.batchQueue.splice(index, 1)[0]
    if (removed.id) {
      this.batchQueueMap.delete(removed.id)
      
      // Clear currentActivity if it was removed
      if (this.currentActivity?.id === activityId) {
        this.currentActivity = null
      }
    }
    
    return true
  }

  /**
   * Filters the batch queue and rebuilds the Map
   */
  filterQueue(
    filterFn: (activity: ActivityRecord) => boolean,
    onFilter?: (removed: ActivityRecord[]) => void
  ): ActivityRecord[] {
    const beforeCount = this.batchQueue.length
    const removed: ActivityRecord[] = []
    
    this.batchQueue = this.batchQueue.filter(activity => {
      const keep = filterFn(activity)
      if (!keep) {
        removed.push(activity)
      }
      return keep
    })
    
    // Rebuild Map after filtering
    this.rebuildMap()
    
    if (onFilter) {
      onFilter(removed)
    }
    
    logger.debug('Queue filtered', {
      beforeCount,
      afterCount: this.batchQueue.length,
      removedCount: removed.length
    })
    
    return removed
  }

  /**
   * Sets a timeout for an activity
   */
  setActivityTimeout(activityId: string, timeoutId: ReturnType<typeof setTimeout>): void {
    this.activityTimeouts.set(activityId, timeoutId)
  }

  /**
   * Clears a timeout for an activity
   */
  clearActivityTimeout(activityId: string): void {
    const timeoutId = this.activityTimeouts.get(activityId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.activityTimeouts.delete(activityId)
    }
  }

  /**
   * Clears all activity timeouts
   */
  clearAllActivityTimeouts(): void {
    for (const timeoutId of this.activityTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.activityTimeouts.clear()
    logger.debug('Cleared all activity timeouts')
  }
}


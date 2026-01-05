/**
 * Offline Service
 * 
 * Handles offline functionality with queue management and sync
 */

import { createLogger } from '../utils/logger.util'
import { storage } from './plasmo-storage.service'
import { errorReportingService } from './error-reporting.service'

const logger = createLogger('[OfflineService]')

export interface OfflineAction {
  id: string
  type: string
  payload: any
  timestamp: number
  retryCount: number
  maxRetries: number
}

export interface OfflineConfig {
  maxQueueSize: number
  retryDelay: number
  maxRetries: number
  syncInterval: number
}

class OfflineService {
  private config: OfflineConfig
  private isOnline: boolean = navigator.onLine
  private actionQueue: OfflineAction[] = []
  private syncTimer: NodeJS.Timeout | null = null
  private readonly QUEUE_KEY = 'offline_action_queue'

  constructor() {
    this.config = this.getDefaultConfig()
    this.setupEventListeners()
    this.loadQueueFromStorage()
    this.startSyncTimer()
  }

  private getDefaultConfig(): OfflineConfig {
    return {
      maxQueueSize: 100,
      retryDelay: 5000, // 5 seconds
      maxRetries: 3,
      syncInterval: 30000 // 30 seconds
    }
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      logger.info('Connection restored, starting sync')
      this.syncActions()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      logger.info('Connection lost, queuing actions')
    })
  }

  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    this.syncTimer = setInterval(() => {
      if (this.isOnline && this.actionQueue.length > 0) {
        this.syncActions()
      }
    }, this.config.syncInterval)
  }

  /**
   * Queue an action for offline execution
   */
  async queueAction(type: string, payload: any, maxRetries: number = this.config.maxRetries): Promise<string> {
    const action: OfflineAction = {
      id: this.generateActionId(),
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries
    }

    // Check queue size limit
    if (this.actionQueue.length >= this.config.maxQueueSize) {
      // Remove oldest action
      this.actionQueue.shift()
    }

    this.actionQueue.push(action)
    await this.saveQueueToStorage()

    logger.debug(`Queued action: ${type}`, { actionId: action.id })

    // Try to execute immediately if online
    if (this.isOnline) {
      this.syncActions()
    }

    return action.id
  }

  /**
   * Execute queued actions
   */
  private async syncActions(): Promise<void> {
    if (!this.isOnline || this.actionQueue.length === 0) {
      return
    }

    logger.debug(`Syncing ${this.actionQueue.length} queued actions`)

    const actionsToProcess = [...this.actionQueue]
    const successfulActions: string[] = []
    const failedActions: OfflineAction[] = []

    for (const action of actionsToProcess) {
      try {
        await this.executeAction(action)
        successfulActions.push(action.id)
        logger.debug(`Successfully executed action: ${action.type}`, { actionId: action.id })
      } catch (error) {
        logger.error(`Failed to execute action: ${action.type}`, { actionId: action.id, error })
        
        action.retryCount++
        if (action.retryCount < action.maxRetries) {
          failedActions.push(action)
        } else {
          logger.error(`Action exceeded max retries: ${action.type}`, { actionId: action.id })
          await errorReportingService.reportError({
            level: 'error',
            message: `Offline action failed after ${action.maxRetries} retries`,
            context: {
              component: 'offline',
              action: action.type
            },
            metadata: { actionId: action.id, payload: action.payload }
          })
        }
      }
    }

    // Update queue with failed actions
    this.actionQueue = failedActions
    await this.saveQueueToStorage()

    logger.info(`Sync completed: ${successfulActions.length} successful, ${failedActions.length} failed`)
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: OfflineAction): Promise<void> {
    switch (action.type) {
      case 'auth_login':
        await this.executeAuthLogin(action.payload)
        break
      case 'sync_data':
        await this.executeSyncData(action.payload)
        break
      case 'create_bookmark':
        await this.executeCreateBookmark(action.payload)
        break
      case 'update_settings':
        await this.executeUpdateSettings(action.payload)
        break
      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }
  }

  /**
   * Execute auth login action
   */
  private async executeAuthLogin(payload: any): Promise<void> {
    const { authService } = await import('./auth.service')
    await authService.login(payload.backendUrl, payload.email, payload.password)
  }

  /**
   * Execute data sync action
   */
  private async executeSyncData(payload: any): Promise<void> {
    // Import and execute sync logic
    const { historySyncService } = await import('./history-sync.service')
    await historySyncService.syncHistory()
  }

  /**
   * Execute create bookmark action
   */
  private async executeCreateBookmark(payload: any): Promise<void> {
    // Import and execute bookmark creation
    const { getPocketBase } = await import('./pocketbase/client')
    const pb = getPocketBase(payload.backendUrl)
    pb.authStore.save(payload.token)
    await pb.collection('bookmarks').create(payload.bookmark)
  }

  /**
   * Execute update settings action
   */
  private async executeUpdateSettings(payload: any): Promise<void> {
    const { userPreferencesStorage } = await import('./plasmo-storage.service')
    await userPreferencesStorage.savePreferences(payload.settings)
  }

  /**
   * Load queue from storage
   */
  private async loadQueueFromStorage(): Promise<void> {
    try {
      const storedQueue = await storage.get(this.QUEUE_KEY)
      if (storedQueue && Array.isArray(storedQueue)) {
        this.actionQueue = storedQueue
        logger.debug(`Loaded ${this.actionQueue.length} actions from storage`)
      }
    } catch (error) {
      logger.error('Failed to load offline queue from storage', error)
    }
  }

  /**
   * Save queue to storage
   */
  private async saveQueueToStorage(): Promise<void> {
    try {
      await storage.set(this.QUEUE_KEY, this.actionQueue)
    } catch (error) {
      logger.error('Failed to save offline queue to storage', error)
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    isOnline: boolean
    queueSize: number
    oldestAction?: OfflineAction
    newestAction?: OfflineAction
  } {
    return {
      isOnline: this.isOnline,
      queueSize: this.actionQueue.length,
      oldestAction: this.actionQueue[0],
      newestAction: this.actionQueue[this.actionQueue.length - 1]
    }
  }

  /**
   * Clear the action queue
   */
  async clearQueue(): Promise<void> {
    this.actionQueue = []
    await this.saveQueueToStorage()
    logger.info('Offline action queue cleared')
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OfflineConfig>): void {
    this.config = { ...this.config, ...config }
    
    if (config.syncInterval) {
      this.startSyncTimer()
    }
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }
}

// Export singleton instance
export const offlineService = new OfflineService()

// Export types
export type { OfflineAction, OfflineConfig }


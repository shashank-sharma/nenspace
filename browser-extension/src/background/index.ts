import { createLogger } from './utils/logger'
import { BrowserAPI } from './utils/browser-api'
import { BackgroundConfig } from './config'
import { HealthMonitor } from './services/health-monitor'
import { RealtimeManager } from './services/realtime-manager'
import { ActivityTracker } from './services/activity-tracker'
import { HistorySyncService } from './services/history-sync.service'
import { contextMenuService } from './services/context-menu.service'
import { initializeServices } from './services'
import { handleInstall } from './handlers/install-handler'
import { createStorageHandler } from './handlers/storage-handler'
import { setupBackgroundErrorHandlers } from '../lib/utils/error-boundary.util'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.BACKGROUND)

class BackgroundService {
  private readonly healthMonitor: HealthMonitor
  private readonly realtimeManager: RealtimeManager
  private readonly activityTracker: ActivityTracker
  private readonly historySyncService: HistorySyncService
  private isInitialized: boolean = false

  constructor() {
    this.healthMonitor = new HealthMonitor({
      onHealthChange: (healthy) => this.handleHealthChange(healthy)
    })
    
    this.realtimeManager = new RealtimeManager({
      healthMonitor: this.healthMonitor
    })

    this.activityTracker = new ActivityTracker({
      healthMonitor: this.healthMonitor
    })

    this.historySyncService = new HistorySyncService()

    initializeServices({
      healthMonitor: this.healthMonitor,
      realtimeManager: this.realtimeManager,
      activityTracker: this.activityTracker,
      historySyncService: this.historySyncService
    })
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Background service already initialized')
      return
    }

    try {
      await this.healthMonitor.initialize()
      await this.realtimeManager.initialize()
      await this.activityTracker.initialize()
      await this.historySyncService.initialize()
      await contextMenuService.initialize()
      
      this.setupEventListeners()
      await this.activityTracker.startTracking()
      
      this.isInitialized = true
    } catch (error) {
      logger.error('Failed to initialize background service', error)
    }
  }

  private setupEventListeners(): void {
    if (!BrowserAPI.runtime) {
      logger.error('Runtime API not available')
      return
    }
    
    try {
      const storageHandler = createStorageHandler({
        realtimeManager: this.realtimeManager,
        healthMonitor: this.healthMonitor,
        activityTracker: this.activityTracker,
        historySyncService: this.historySyncService
      })
      BrowserAPI.storage.onChanged(storageHandler)
      BrowserAPI.runtime.onInstalled(handleInstall)
    } catch (error) {
      logger.error('Failed to setup event listeners', error)
    }
  }

  private handleHealthChange(healthy: boolean): void {
    if (healthy) {
      this.realtimeManager.resetRetryAttempts()
      this.realtimeManager.forceReinitialize().catch(error => {
        logger.error('Failed to reinitialize realtime after recovery', error)
      })
    } else {
      logger.warn('Backend unhealthy, disabling realtime')
      this.realtimeManager.disableRealtime().catch(error => {
        logger.error('Failed to disable realtime', error)
      })
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.healthMonitor.stop()
      await this.realtimeManager.cleanup()
      await this.activityTracker.stopTracking()
    } catch (error) {
      logger.error('Error during cleanup', error)
    }
    
    this.isInitialized = false
  }
}

setupBackgroundErrorHandlers()

const backgroundService = new BackgroundService()

backgroundService.initialize().catch(error => {
  logger.error('Failed to initialize background service', error)
})

if (typeof globalThis !== 'undefined') {
  (globalThis as any).__nenspace_background = backgroundService
}

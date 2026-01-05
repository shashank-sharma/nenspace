import type { 
  ActivityRecord, 
  ActivitySettings, 
  QueuedActivity
} from '../types'
import type { StoredAuth } from '../../lib/types'
import { STORAGE_KEYS, DEFAULT_BACKEND_URL } from '../../lib/config/constants'
import { BackgroundConfig } from '../config'
import { createLogger } from '../utils/logger'
import { BrowserAPI } from '../utils/browser-api'
import { authStorage, devTokenStorage, settingsStorage } from '../../lib/services/plasmo-storage.service'
import type { HealthMonitor } from './health-monitor'
import { ActivityStorageService } from './activity/activity-storage.service'
import { ActivityQueueManager } from './activity/activity-queue-manager'
import { ActivitySyncService } from './activity/activity-sync.service'
import { ActivityAlarmManager } from './activity/activity-alarm-manager'
import { ActivitySessionService } from './activity/activity-session.service'
import { ActivityHeartbeatService } from './activity/activity-heartbeat.service'
import { ActivityIdleDetectionService } from './activity/activity-idle-detection.service'
import { ActivityTabEventsService } from './activity/activity-tab-events.service'
import {
  BATCH_SIZE_THRESHOLD,
  DEFAULT_MINIMUM_DURATION,
  OFFLINE_QUEUE_CLEANUP_AGE_MS,
  BATCH_QUEUE_CLEANUP_AGE_MS
} from './activity/constants'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.ACTIVITY)

export interface ActivityTrackerOptions {
  healthMonitor?: HealthMonitor
}

export class ActivityTracker {
  private auth: StoredAuth | null = null
  private devToken: string | null = null
  private backendUrl: string = DEFAULT_BACKEND_URL
  private browserProfileId: string | null = null
  private settings: ActivitySettings
  private isInitialized: boolean = false
  private isTracking: boolean = false
  private offlineQueue: QueuedActivity[] = []
  private healthMonitor: HealthMonitor | null = null

  private storageService: ActivityStorageService
  private queueManager: ActivityQueueManager
  private syncService: ActivitySyncService
  private alarmManager: ActivityAlarmManager
  private sessionService: ActivitySessionService
  private heartbeatService: ActivityHeartbeatService
  private idleDetectionService: ActivityIdleDetectionService
  private tabEventsService: ActivityTabEventsService

  constructor(options: ActivityTrackerOptions = {}) {
    this.healthMonitor = options.healthMonitor || null
    
    this.settings = {
      enabled: true,
      syncEnabled: false,
      incognitoMode: 'mark' as 'mark' | 'ignore' | 'block',
      heartbeatInterval: 30,
      syncInterval: 30,
      minimumDuration: DEFAULT_MINIMUM_DURATION,
      domainBlacklist: [],
      autoCleanupDays: 30,
      sleepThreshold: 60
    }
    
    this.storageService = new ActivityStorageService()
    this.queueManager = new ActivityQueueManager()
    
    this.syncService = new ActivitySyncService({
      devToken: this.devToken,
      backendUrl: this.backendUrl,
      browserProfileId: this.browserProfileId,
      settings: this.settings,
      storageService: this.storageService,
      queueManager: this.queueManager,
      calculateDuration: this.calculateDuration.bind(this),
      ensureBrowserProfileId: this.ensureBrowserProfileId.bind(this)
    })

    this.sessionService = new ActivitySessionService({
      queueManager: this.queueManager,
      storageService: this.storageService,
      getSettings: () => this.settings,
      getAuth: () => this.auth,
      getDevToken: () => this.devToken,
      getBrowserProfileId: () => this.browserProfileId,
      calculateDuration: this.calculateDuration.bind(this),
      onSyncNeeded: async () => {
        if (this.queueManager.getBatchQueue().length >= BATCH_SIZE_THRESHOLD) {
          await this.syncBatch()
        }
      }
    })

    this.heartbeatService = new ActivityHeartbeatService({
      queueManager: this.queueManager,
      storageService: this.storageService,
      sessionService: this.sessionService,
      getSettings: () => this.settings,
      isBackendHealthy: this.isBackendHealthy.bind(this),
      createActivity: this.sessionService.createActivity.bind(this.sessionService),
      finalizeActivity: this.sessionService.finalizeActivity.bind(this.sessionService),
      queueHeartbeat: this.queueHeartbeat.bind(this),
      getTabCount: this.getTabCount.bind(this)
    })

    this.idleDetectionService = new ActivityIdleDetectionService({
      heartbeatService: this.heartbeatService,
      sessionService: this.sessionService,
      queueManager: this.queueManager,
      storageService: this.storageService,
      finalizeActivity: this.sessionService.finalizeActivity.bind(this.sessionService),
      calculateDuration: this.calculateDuration.bind(this)
    })

    this.tabEventsService = new ActivityTabEventsService({
      heartbeatService: this.heartbeatService,
      finalizeActivity: this.sessionService.finalizeActivity.bind(this.sessionService),
      getCurrentActivity: () => this.sessionService.getCurrentActivity()
    })

    this.alarmManager = new ActivityAlarmManager({
      onHeartbeat: async () => {
        const activeTab = await this.getActiveTab()
        if (activeTab) {
          await this.heartbeatService.sendHeartbeat(activeTab)
        }
      },
      onSync: async () => {
        logger.info('Sync alarm triggered', { 
          batchSize: this.queueManager.getBatchQueue().length,
          syncInterval: this.settings.syncInterval 
        })
        await this.syncBatch()
      },
      onCleanup: async () => {
        logger.info('Running auto cleanup')
        await this.performAutoCleanup()
      }
    })
    
    this.idleDetectionService.setupBrowserLifecycleHooks()
    this.idleDetectionService.setupIdleDetection()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Activity tracker already initialized')
      return
    }

    logger.debug('Initializing activity tracker')

    try {
      await this.loadAuth()
      await this.loadDevToken()
      await this.loadSettings()
      
      if (!this.hasValidAuth() && !this.devToken) {
        logger.debug('No valid authentication or dev token, skipping activity tracker initialization')
        this.isInitialized = true
        return
      }

      await this.ensureBrowserProfileId()
      await this.syncService.loadCheckpoint()
      
      const loadedSyncTime = await this.storageService.loadLastSyncTime()
      if (loadedSyncTime) {
        this.syncService.setLastSyncTime(loadedSyncTime)
      }

      await this.sessionService.initializeSession(this.browserProfileId || 'unknown')

      await this.alarmManager.setupHeartbeatAlarm(this.settings)
      await this.alarmManager.setupSyncAlarm(this.settings)
      await this.alarmManager.setupCleanupAlarm()

      this.offlineQueue = await this.storageService.loadOfflineQueue()
      const loadedBatchQueue = await this.storageService.loadBatchQueue()
      this.queueManager.initializeQueues(loadedBatchQueue)

      const lastStoredHeartbeat = await this.storageService.loadLastHeartbeatTime()
      if (lastStoredHeartbeat) {
        this.heartbeatService.setLastHeartbeatTime(lastStoredHeartbeat)
        const now = Date.now()
        const gap = now - lastStoredHeartbeat
        const threshold = Math.max(this.settings.heartbeatInterval * 2000, (this.settings.sleepThreshold || 60) * 1000)
        
        if (gap > threshold) {
          const ongoing = this.queueManager.getBatchQueue().find(a => !a.end_time)
          if (ongoing?.id) {
            const endTime = new Date(lastStoredHeartbeat)
            this.queueManager.updateActivity(ongoing.id, {
              end_time: endTime,
              duration: this.calculateDuration(ongoing.start_time, endTime)
            })
            await this.storageService.saveBatchQueue(this.queueManager.getBatchQueue())
          }
        }
      }

      await this.cleanupStuckActivities()

      if (this.queueManager.getBatchQueue().length > 0) {
        await this.syncBatch()
      }

      await this.recoverFromCrash()

      this.isInitialized = true
      logger.info('Activity tracker initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize activity tracker', error)
    }
  }

  async startTracking(): Promise<void> {
    if (!this.isInitialized || this.isTracking) return
    if (!this.settings.enabled || !this.settings.syncEnabled) return
    if (!this.hasValidAuth() && !this.devToken) return

    try {
      this.tabEventsService.setupEventListeners()
      await this.sendInitialHeartbeat()
      this.isTracking = true
      logger.debug('Activity tracking started')
    } catch (error) {
      logger.error('Failed to start activity tracking', error)
    }
  }

  async stopTracking(): Promise<void> {
    if (!this.isTracking) return

    try {
      const currentActivity = this.sessionService.getCurrentActivity()
      if (currentActivity?.id) {
        await this.sessionService.finalizeActivity(currentActivity.id)
      }

      this.tabEventsService.removeEventListeners()
      this.queueManager.clearAllActivityTimeouts()

      this.isTracking = false
      logger.debug('Activity tracking stopped')
    } catch (error) {
      logger.error('Failed to stop activity tracking', error)
    }
  }

  async loadAuth(): Promise<void> {
    try {
      const authResult = await authStorage.get()
      this.auth = authResult.success ? authResult.data : null

      if (this.auth?.backendUrl) {
        this.backendUrl = this.auth.backendUrl
        this.syncService.updateDependencies({ backendUrl: this.backendUrl })
      }
    } catch (error) {
      logger.error('Failed to load auth', error)
      this.auth = null
    }
  }

  async loadDevToken(): Promise<void> {
    try {
      const storedTokenResult = await devTokenStorage.get()
      const storedToken = storedTokenResult.success ? storedTokenResult.data : null
      
      if (storedToken) {
        if (!storedToken.includes('.')) {
          this.devToken = null
          this.syncService.updateDependencies({ devToken: null })
          return
        }
        
        const parts = storedToken.split('.')
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
          this.devToken = null
          this.syncService.updateDependencies({ devToken: null })
          return
        }
        
        if (storedToken === this.auth?.primaryToken) {
          this.devToken = null
          await devTokenStorage.clear()
          this.syncService.updateDependencies({ devToken: null })
          return
        }
        
        this.devToken = storedToken
        this.syncService.updateDependencies({ devToken: storedToken })
      } else {
        this.devToken = null
        this.syncService.updateDependencies({ devToken: null })
      }
    } catch (error) {
      logger.error('Failed to load dev token', error)
      this.devToken = null
    }
  }

  private hasValidAuth(): boolean {
    return !!(this.auth?.primaryToken && this.auth?.userId)
  }

  private async loadSettings(): Promise<void> {
    try {
      const storedSettingsResult = await settingsStorage.getActivitySettings()
      const storedSettings = storedSettingsResult.success ? storedSettingsResult.data : null
      
      if (storedSettings) {
        if (!('trackTabs' in storedSettings || 'trackClicks' in storedSettings)) {
          this.settings = {
            enabled: storedSettings.enabled ?? this.settings.enabled,
            syncEnabled: storedSettings.syncEnabled ?? this.settings.syncEnabled,
            incognitoMode: (storedSettings.incognitoMode as 'mark' | 'ignore' | 'block') ?? this.settings.incognitoMode,
            heartbeatInterval: storedSettings.heartbeatInterval ?? this.settings.heartbeatInterval,
            syncInterval: storedSettings.syncInterval ?? this.settings.syncInterval,
            minimumDuration: storedSettings.minimumDuration ?? this.settings.minimumDuration,
            domainBlacklist: storedSettings.domainBlacklist ?? this.settings.domainBlacklist,
            autoCleanupDays: storedSettings.autoCleanupDays ?? this.settings.autoCleanupDays,
            sleepThreshold: storedSettings.sleepThreshold ?? this.settings.sleepThreshold
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load activity settings', error)
    }
  }

  private async ensureBrowserProfileId(): Promise<void> {
    try {
      const result = await BrowserAPI.storage.get<string>(STORAGE_KEYS.PROFILE_ID)
      let profileId = result[STORAGE_KEYS.PROFILE_ID] || null
      
      if (profileId && typeof profileId === 'string' && profileId.startsWith('"') && profileId.endsWith('"')) {
        try {
          profileId = JSON.parse(profileId)
        } catch (e) {}
      }
      
      this.browserProfileId = profileId
      this.syncService.updateDependencies({ browserProfileId: profileId })
    } catch (error) {
      logger.error('Failed to get browser profile ID', error)
    }
  }

  private async sendInitialHeartbeat(): Promise<void> {
    try {
      const activeTab = await this.getActiveTab()
      if (activeTab) {
        await this.heartbeatService.sendHeartbeat(activeTab)
      }
    } catch (error) {
      logger.error('Failed to send initial heartbeat', error)
    }
  }

  private async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    try {
      const tabs = await new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
          else resolve(tabs)
        })
      })
      if (tabs.length > 0) return tabs[0]

      const allTabs = await new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
        chrome.tabs.query({ active: true }, (tabs) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
          else resolve(tabs)
        })
      })
      return allTabs.length > 0 ? allTabs[0] : null
    } catch (error) {
      logger.error('Failed to get active tab', error)
      return null
    }
  }

  private async syncBatch(): Promise<void> {
    this.syncService.updateDependencies({
      devToken: this.devToken,
      backendUrl: this.backendUrl,
      browserProfileId: this.browserProfileId,
      settings: this.settings
    })
    await this.syncService.syncBatch()
  }

  private async queueActivity(type: 'create' | 'update' | 'finalize', data: Partial<ActivityRecord>): Promise<void> {
    const queuedActivity: QueuedActivity = {
      id: Math.random().toString(36).slice(2, 11),
      type,
      data,
      timestamp: Date.now(),
      retries: 0
    }
    this.offlineQueue.push(queuedActivity)
    await this.storageService.saveOfflineQueue(this.offlineQueue)
  }

  private async queueHeartbeat(tab: chrome.tabs.Tab): Promise<void> {
    if (!this.hasValidAuth() && !this.devToken) return

    const sessionInfo = this.sessionService.getSessionInfo()
    await this.queueActivity('create', {
      user: this.auth?.userId || 'anonymous',
      browser_profile: this.browserProfileId || 'unknown',
      url: tab.url || '',
      title: tab.title || '',
      domain: this.extractDomain(tab.url || ''),
      start_time: new Date(),
      tab_id: tab.id || 0,
      window_id: tab.windowId,
      audible: tab.audible || false,
      incognito: tab.incognito || false,
      metadata: { tabCount: await this.getTabCount() },
      session_id: sessionInfo?.id || 'unknown'
    })
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return

    const processedItems: string[] = []
    const failedItems: QueuedActivity[] = []

    for (const item of this.offlineQueue) {
      try {
        if (item.type === 'create') await this.sessionService.createActivity(item.data as any)
        else if (item.type === 'update') await this.queueManager.updateActivity(item.data.id!, item.data)
        else if (item.type === 'finalize') await this.sessionService.finalizeActivity(item.data.id!)
        processedItems.push(item.id)
      } catch (error) {
        item.retries++
        if (item.retries < 3) failedItems.push(item)
      }
    }

    this.offlineQueue = failedItems
    await this.storageService.saveOfflineQueue(this.offlineQueue)
  }

  private extractDomain(url: string): string {
    try { return new URL(url).hostname } catch { return '' }
  }

  private async getTabCount(): Promise<number> {
    try { return (await BrowserAPI.tabs.query({})).length } catch { return 0 }
  }

  private calculateDuration(startTime: Date, endTime: Date): number {
    return Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
  }

  private isBackendHealthy(): boolean {
    return !this.healthMonitor || this.healthMonitor.isHealthy()
  }

  async updateSettings(newSettings: Partial<ActivitySettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...newSettings }
      const saveResult = await settingsStorage.saveActivitySettings(this.settings)
      if (!saveResult.success) {
        logger.error('Failed to save activity settings in ActivityTracker', saveResult.error)
      }
      
      await this.loadSettings()
      
      if (newSettings.heartbeatInterval) await this.alarmManager.setupHeartbeatAlarm(this.settings)
      if (newSettings.syncInterval !== undefined || newSettings.syncEnabled !== undefined) {
        await this.alarmManager.setupSyncAlarm(this.settings)
      }
      
      this.syncService.updateDependencies({ settings: this.settings })

      if (this.settings.syncEnabled && !this.settings.enabled) {
        this.settings.enabled = true
        await settingsStorage.saveActivitySettings(this.settings)
        await this.loadSettings()
      }

      if (this.settings.syncEnabled && !this.isTracking) {
        if (!this.isInitialized) await this.initialize()
        await this.startTracking()
      }
      
      if (!this.settings.syncEnabled && this.isTracking) {
        await this.stopTracking()
      }
    } catch (error) {
      logger.error('Failed to update settings', error)
      throw error
    }
  }

  async syncOfflineQueue(): Promise<void> {
    if (this.isBackendHealthy()) await this.processOfflineQueue()
  }

  getSettings(): ActivitySettings {
    return { ...this.settings }
  }

  async reloadSettings(): Promise<void> {
    await this.loadSettings()
  }

  getCurrentActivity(): ActivityRecord | null {
    const current = this.sessionService.getCurrentActivity()
    return current ? { ...current } : null
  }

  getSyncStatus(): { running: boolean, lastSync: Date | null, totalSynced: number, isTracking: boolean } {
    return {
      running: this.syncService.isSyncInProgress(),
      lastSync: this.syncService.getLastSyncTime(),
      totalSynced: this.syncService.getTotalSyncedCount(),
      isTracking: this.isTracking
    }
  }

  private async cleanupStuckActivities(): Promise<void> {
    const now = new Date()
    const removed: ActivityRecord[] = []
    this.queueManager.filterQueue(
      (activity) => {
        const isStuck = this.queueManager.isStuckActivity(activity, now)
        if (isStuck) removed.push(activity)
        return !isStuck
      },
      (removedActivities) => {
        for (const activity of removedActivities) {
          if (activity.id) this.queueManager.clearActivityTimeout(activity.id)
        }
      }
    )
    if (removed.length > 0) await this.storageService.saveBatchQueue(this.queueManager.getBatchQueue())
  }

  async triggerRecovery(): Promise<void> {
    await this.recoverFromCrash()
  }

  async forceSaveAllQueues(): Promise<void> {
    await this.storageService.saveBatchQueue(this.queueManager.getBatchQueue())
    await this.storageService.saveOfflineQueue(this.offlineQueue)
  }

  private async recoverFromCrash(): Promise<void> {
    try {
      const loadedBatchQueue = await this.storageService.loadBatchQueue()
      this.queueManager.initializeQueues(loadedBatchQueue)
      this.offlineQueue = await this.storageService.loadOfflineQueue()
      if (this.queueManager.getBatchQueue().length > 0) await this.syncBatch()
      if (this.offlineQueue.length > 0) await this.processOfflineQueue()
    } catch (error) {
      logger.error('Failed to recover from crash', error)
    }
  }

  private async performAutoCleanup(): Promise<void> {
    try {
      const now = Date.now()
      this.offlineQueue = this.offlineQueue.filter(item => (now - item.timestamp) <= OFFLINE_QUEUE_CLEANUP_AGE_MS)
      await this.storageService.saveOfflineQueue(this.offlineQueue)
      
      this.queueManager.filterQueue(activity => (now - new Date(activity.start_time).getTime()) <= BATCH_QUEUE_CLEANUP_AGE_MS)
      await this.storageService.saveBatchQueue(this.queueManager.getBatchQueue())
      
      if (this.queueManager.getBatchQueue().length > 0) await this.syncBatch()
    } catch (error) {
      logger.error('Auto cleanup failed', error)
    }
  }
}

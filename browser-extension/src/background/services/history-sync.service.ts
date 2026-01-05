import { STORAGE_KEYS, DEFAULT_BACKEND_URL } from '../../lib/config/constants'
import { BackgroundConfig } from '../config'
import { createLogger } from '../utils/logger'
import { BrowserAPI } from '../utils/browser-api'
import { devTokenStorage } from '../../lib/services/plasmo-storage.service'
import { notificationService } from '../../lib/services/notification.service'
import { badgeService } from '../../lib/services/badge.service'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.ACTIVITY)

export interface HistorySyncCheckpoint {
  lastSyncTime: Date | null
  lastVisitTime: Date | null
  totalSynced: number
  batchesSynced: number
  failedBatches: number
  isInitialSyncComplete: boolean
}

export interface HistorySyncState {
  syncInProgress: boolean
  currentBatch: number
  totalBatches: number
  itemsProcessed: number
  failedItems: number
}

export interface BrowserHistorySyncItem {
  url: string
  title: string
  domain: string
  visit_time: string
  visit_count: number
  transition_type: string
  referrer_url?: string
}

export class HistorySyncService {
  private backendUrl: string = DEFAULT_BACKEND_URL
  private devToken: string | null = null
  private browserProfileId: string | null = null
  private checkpoint: HistorySyncCheckpoint
  private state: HistorySyncState
  private retryQueue: chrome.history.HistoryItem[] = []
  private syncAlarmName = 'history-sync-alarm'
  
  constructor() {
    this.checkpoint = {
      lastSyncTime: null,
      lastVisitTime: null,
      totalSynced: 0,
      batchesSynced: 0,
      failedBatches: 0,
      isInitialSyncComplete: false
    }
    
    this.state = {
      syncInProgress: false,
      currentBatch: 0,
      totalBatches: 0,
      itemsProcessed: 0,
      failedItems: 0
    }
  }
  
  async initialize(): Promise<void> {
    await this.loadDevToken()
    await this.loadBrowserProfileId()
    await this.loadCheckpoint()
    await this.loadRetryQueue()
    
    const syncEnabled = await this.isSyncEnabled()
    
    if (!this.devToken || !this.browserProfileId || !syncEnabled) {
      logger.info('No dev token, browser profile, or sync disabled, skipping history sync initialization')
      return
    }
    
    await this.setupPeriodicSync()
  }

  async reinitializeWithDevToken(): Promise<void> {
    logger.info('Reinitializing history sync service with dev token')
    await this.loadDevToken()
    
    if (this.devToken) {
      logger.info('Dev token found, setting up history sync')
      await this.setupPeriodicSync()
    } else {
      logger.warn('Still no dev token after reload')
    }
  }
  
  async syncFullHistory(options?: { maxDays?: number }): Promise<void> {
    const maxDays = options?.maxDays || 90
    const oldestTime = Date.now() - (maxDays * 24 * 60 * 60 * 1000)
    
    this.state.syncInProgress = true
    badgeService.setStatus('syncing', { animated: true })
    
    try {
      const historyItems = await this.fetchBrowserHistory({
        text: '',
        startTime: oldestTime,
        maxResults: 0
      })
      
      logger.info(`Found ${historyItems.length} history items to sync`)
      
      notificationService.showProgress(
        'History Sync Started',
        `Syncing ${historyItems.length} history items...`,
        0
      )
      
      historyItems.sort((a, b) => (a.lastVisitTime || 0) - (b.lastVisitTime || 0))
      await this.processBatches(historyItems)
      
      notificationService.showSuccess(
        'History Sync Complete',
        `Successfully synced ${this.checkpoint.totalSynced} history items`,
        { action: 'open_popup' }
      )
      
    } catch (error) {
      logger.error('Full history sync failed', error)
      notificationService.showError(
        'History Sync Failed',
        `Failed to sync history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { action: 'open_popup' }
      )
    } finally {
      this.state.syncInProgress = false
      await this.saveState()
      badgeService.setStatus('healthy')
    }
  }
  
  async syncIncrementalHistory(): Promise<void> {
    if (this.state.syncInProgress) {
      logger.warn('Sync already in progress')
      return
    }
    
    this.state.syncInProgress = true
    badgeService.setStatus('syncing', { animated: true })
    
    try {
      const startTime = this.checkpoint.lastVisitTime 
        ? new Date(this.checkpoint.lastVisitTime).getTime()
        : Date.now() - (24 * 60 * 60 * 1000)
      
      const historyItems = await this.fetchBrowserHistory({
        text: '',
        startTime: startTime,
        maxResults: 0
      })
      
      logger.info(`Found ${historyItems.length} new history items`)
      
      if (historyItems.length === 0) {
        logger.info('No new history to sync')
        badgeService.setStatus('healthy')
        return
      }
      
      notificationService.showProgress(
        'Syncing New History',
        `Syncing ${historyItems.length} new history items...`,
        0
      )
      
      historyItems.sort((a, b) => (a.lastVisitTime || 0) - (b.lastVisitTime || 0))
      await this.processBatches(historyItems)
      
      notificationService.showSuccess(
        'History Synced',
        `Synced ${historyItems.length} new history items`,
        { action: 'open_popup' }
      )
      
    } catch (error) {
      logger.error('Incremental sync failed', error)
      notificationService.showError(
        'History Sync Failed',
        `Failed to sync new history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { action: 'open_popup' }
      )
    } finally {
      this.state.syncInProgress = false
      await this.saveState()
      badgeService.setStatus('healthy')
    }
  }
  
  private async processBatches(historyItems: chrome.history.HistoryItem[]): Promise<void> {
    const BATCH_SIZE = 500
    const batches = this.chunkArray(historyItems, BATCH_SIZE)
    
    this.state.totalBatches = batches.length
    this.state.currentBatch = 0
    
    for (const batch of batches) {
      this.state.currentBatch++
      
      try {
        const batchWithVisits = await this.enrichBatchWithVisits(batch)
        const result = await this.syncBatch(batchWithVisits)
        
        if (result.success) {
          this.state.itemsProcessed += result.created
          this.checkpoint.totalSynced += result.created
          this.checkpoint.batchesSynced++
          
          if (batch.length > 0) {
            const lastItem = batch[batch.length - 1]
            this.checkpoint.lastVisitTime = new Date(lastItem.lastVisitTime!)
          }
          
          await this.saveCheckpoint()
        } else {
          this.checkpoint.failedBatches++
          this.state.failedItems += result.failed
          
          if (result.failed_items) {
            result.failed_items.forEach((failed: any) => {
              this.retryQueue.push(batch[failed.index])
            })
          }
        }
        
        await this.sleep(500)
        
      } catch (error) {
        logger.error(`Batch ${this.state.currentBatch} failed`, error)
        this.retryQueue.push(...batch)
        this.checkpoint.failedBatches++
      }
      
      await this.saveState()
    }
    
    if (!this.checkpoint.isInitialSyncComplete && batches.length > 0) {
      this.checkpoint.isInitialSyncComplete = true
      await this.saveCheckpoint()
    }
    
    if (this.retryQueue.length > 0) {
      await this.processRetryQueue()
    }
  }
  
  private async enrichBatchWithVisits(
    batch: chrome.history.HistoryItem[]
  ): Promise<BrowserHistorySyncItem[]> {
    const enriched: BrowserHistorySyncItem[] = []
    
    for (const item of batch) {
      try {
        const visits = await this.getVisits(item.url!)
        const latestVisit = visits[0]
        
        enriched.push({
          url: item.url!,
          title: item.title || '',
          domain: this.extractDomain(item.url!),
          visit_time: new Date(item.lastVisitTime!).toISOString(),
          visit_count: item.visitCount || 1,
          transition_type: latestVisit?.transition || 'unknown',
          referrer_url: undefined
        })
      } catch (error) {
        logger.error(`Failed to enrich item ${item.url}`, error)
        
        enriched.push({
          url: item.url!,
          title: item.title || '',
          domain: this.extractDomain(item.url!),
          visit_time: new Date(item.lastVisitTime!).toISOString(),
          visit_count: item.visitCount || 1,
          transition_type: 'unknown',
          referrer_url: undefined
        })
      }
    }
    
    return enriched
  }
  
  private async syncBatch(batch: BrowserHistorySyncItem[]): Promise<any> {
    if (!this.devToken) {
      throw new Error('No dev token available')
    }
    
    const response = await fetch(`${this.backendUrl}/api/sync/browser-history/batch`, {
      method: 'POST',
      headers: {
        'AuthSyncToken': this.devToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        browser_profile_id: this.browserProfileId,
        checkpoint: this.checkpoint.lastVisitTime?.toISOString() || new Date().toISOString(),
        history_items: batch
      })
    })
    
    if (!response.ok) {
      throw new Error(`Batch sync failed: ${response.status}`)
    }
    
    return response.json()
  }
  
  private async processRetryQueue(): Promise<void> {
    logger.info(`Processing retry queue: ${this.retryQueue.length} items`)
    
    const batches = this.chunkArray(this.retryQueue, 500)
    const successfulItems: number[] = []
    
    for (let i = 0; i < batches.length; i++) {
      try {
        const batch = batches[i]
        const enriched = await this.enrichBatchWithVisits(batch)
        const result = await this.syncBatch(enriched)
        
        if (result.success) {
          const startIdx = i * 500
          for (let j = 0; j < batch.length; j++) {
            successfulItems.push(startIdx + j)
          }
        }
        
        await this.sleep(500)
      } catch (error) {
        logger.error(`Retry batch ${i} failed`, error)
      }
    }
    
    this.retryQueue = this.retryQueue.filter((_, idx) => !successfulItems.includes(idx))
    await this.saveRetryQueue()
    
    logger.info(`Retry queue processed. Remaining: ${this.retryQueue.length}`)
  }
  
  private async fetchBrowserHistory(query: any): Promise<chrome.history.HistoryItem[]> {
    return new Promise((resolve, reject) => {
      chrome.history.search(query, (results) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve(results)
        }
      })
    })
  }
  
  private async getVisits(url: string): Promise<chrome.history.VisitItem[]> {
    return new Promise((resolve, reject) => {
      chrome.history.getVisits({ url }, (visits) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve(visits)
        }
      })
    })
  }
  
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  private async loadDevToken(): Promise<void> {
    try {
      const devTokenResult = await devTokenStorage.get()
      this.devToken = devTokenResult.success ? devTokenResult.data : null
      
      if (this.devToken) {
        logger.info('Dev token loaded successfully for history sync service')
      } else {
        logger.info('No dev token found for history sync service')
      }
    } catch (error) {
      logger.error('Failed to load dev token', error)
      this.devToken = null
    }
  }
  
  private async loadBrowserProfileId(): Promise<void> {
    try {
      const result = await BrowserAPI.storage.get<string>(STORAGE_KEYS.PROFILE_ID)
      this.browserProfileId = result[STORAGE_KEYS.PROFILE_ID] || null
    } catch (error) {
      logger.error('Failed to load browser profile ID', error)
      this.browserProfileId = null
    }
  }
  
  private async loadCheckpoint(): Promise<void> {
    try {
      const result = await BrowserAPI.storage.get<HistorySyncCheckpoint>(
        STORAGE_KEYS.HISTORY_SYNC_CHECKPOINT
      )
      if (result[STORAGE_KEYS.HISTORY_SYNC_CHECKPOINT]) {
        this.checkpoint = result[STORAGE_KEYS.HISTORY_SYNC_CHECKPOINT]
      }
    } catch (error) {
      logger.error('Failed to load checkpoint', error)
    }
  }
  
  private async saveCheckpoint(): Promise<void> {
    this.checkpoint.lastSyncTime = new Date()
    try {
      await BrowserAPI.storage.set({
        [STORAGE_KEYS.HISTORY_SYNC_CHECKPOINT]: this.checkpoint
      })
    } catch (error) {
      logger.error('Failed to save checkpoint', error)
    }
  }
  
  private async saveState(): Promise<void> {
    try {
      await BrowserAPI.storage.set({
        [STORAGE_KEYS.HISTORY_SYNC_STATE]: this.state
      })
    } catch (error) {
      logger.error('Failed to save state', error)
    }
  }
  
  private async loadRetryQueue(): Promise<void> {
    try {
      const result = await BrowserAPI.storage.get<chrome.history.HistoryItem[]>(
        STORAGE_KEYS.HISTORY_RETRY_QUEUE
      )
      this.retryQueue = result[STORAGE_KEYS.HISTORY_RETRY_QUEUE] || []
    } catch (error) {
      logger.error('Failed to load retry queue', error)
      this.retryQueue = []
    }
  }

  private async isSyncEnabled(): Promise<boolean> {
    try {
      const result = await BrowserAPI.storage.get<boolean>('nenspace_history_sync_enabled')
      return !!result['nenspace_history_sync_enabled']
    } catch (error) {
      logger.error('Failed to check sync enabled status', error)
      return false
    }
  }
  
  private async saveRetryQueue(): Promise<void> {
    try {
      await BrowserAPI.storage.set({
        [STORAGE_KEYS.HISTORY_RETRY_QUEUE]: this.retryQueue
      })
    } catch (error) {
      logger.error('Failed to save retry queue', error)
    }
  }
  
  private async setupPeriodicSync(): Promise<void> {
    try {
      await BrowserAPI.alarms.clear(this.syncAlarmName)
      await BrowserAPI.alarms.create(this.syncAlarmName, {
        periodInMinutes: 360
      })
      BrowserAPI.alarms.onAlarm.addListener(this.handleSyncAlarm.bind(this))
      logger.info('Periodic history sync setup successfully')
    } catch (error) {
      logger.warn('Failed to setup periodic sync (alarms API may not be available)', error)
    }
  }
  
  private async handleSyncAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    if (alarm.name !== this.syncAlarmName) return
    
    try {
      await this.syncIncrementalHistory()
    } catch (error) {
      logger.error('Failed to handle sync alarm', error)
    }
  }
  
  getCheckpoint(): HistorySyncCheckpoint {
    return { ...this.checkpoint }
  }
  
  getState(): HistorySyncState {
    return { ...this.state }
  }
}

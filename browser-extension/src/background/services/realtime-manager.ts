/**
 * Realtime Manager Service
 * Manages PocketBase realtime connections and subscriptions
 */

import PocketBase from 'pocketbase'
import type { RealtimeStatusPayload, NotificationPayload, BrowserProfile } from '../types'
import type { StoredAuth } from '../../lib/types'
import { STORAGE_KEYS, DEFAULT_BACKEND_URL } from '../../lib/config/constants'
import { BackgroundConfig } from '../config'
import { createLogger } from '../utils/logger'
import { BrowserAPI } from '../utils/browser-api'
import { withTimeout } from '../utils/async'
import type { HealthMonitor } from './health-monitor'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.REALTIME)

export interface RealtimeManagerOptions {
  healthMonitor?: HealthMonitor
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export class RealtimeManager {
  private pb: PocketBase | null = null
  private backendUrl: string = DEFAULT_BACKEND_URL
  private auth: StoredAuth | null = null
  private status: ConnectionStatus = 'disconnected'
  private connectionError: string | null = null
  private activeTopics: Set<string> = new Set()
  private unsubscribeFns: Array<() => Promise<void>> = []
  private isInitialized: boolean = false
  private browserId: string | null = null
  private healthMonitor: HealthMonitor | null = null
  private lastConnectionAttempt: number = 0
  private connectionAttempts: number = 0

  constructor(options: RealtimeManagerOptions = {}) {
    if (options.healthMonitor) {
      this.healthMonitor = options.healthMonitor
    }
  }

  setHealthMonitor(monitor: HealthMonitor): void {
    this.healthMonitor = monitor
  }

  async initialize(): Promise<void> {
    logger.debug('Initializing realtime manager')
    
    if (!this.canAttemptConnection()) {
      logger.warn('Max retries exceeded, waiting before next attempt', {
        attempts: this.connectionAttempts
      })
      return
    }
    
    if (!this.isBackendHealthy()) {
      logger.debug('Backend is unhealthy, skipping realtime initialization')
      await this.handleUnhealthyBackend()
      return
    }
    
    if (this.isInitialized && this.pb) {
      return
    }
    
    this.recordConnectionAttempt()
    await this.loadAuth()
    
    if (!this.hasValidAuth()) {
      logger.debug('No valid authentication, skipping realtime subscriptions')
      await this.cleanup()
      return
    }

    this.setupPocketBaseClient()
    await this.ensureBrowserId()
    
    if (!this.browserId) {
      logger.warn('No profile ID found, user must select a browser profile')
      this.status = 'disconnected'
      return
    }
    
    const topics = this.computeTopics()
    await this.subscribeTopics(topics)
    
    this.isInitialized = true
    logger.debug('Realtime initialized')
  }

  private canAttemptConnection(): boolean {
    if (this.connectionAttempts < BackgroundConfig.REALTIME_MAX_RETRY_ATTEMPTS) {
      return true
    }
    
    const timeSinceLastAttempt = Date.now() - this.lastConnectionAttempt
    if (timeSinceLastAttempt >= BackgroundConfig.REALTIME_RETRY_COOLDOWN_MS) {
      this.connectionAttempts = 0
      return true
    }
    
    return false
  }

  private isBackendHealthy(): boolean {
    if (!this.healthMonitor) {
      return true
    }
    return this.healthMonitor.isHealthy()
  }

  private async handleUnhealthyBackend(): Promise<void> {
    this.status = 'disconnected'
    this.connectionError = 'Backend unavailable'
    this.broadcastStatus()
    
    if (this.pb) {
      try {
        await this.pb.realtime.unsubscribe()
      } catch (error) {
        logger.debug('Failed to unsubscribe', error)
      }
    }
  }

  private recordConnectionAttempt(): void {
    this.lastConnectionAttempt = Date.now()
    this.connectionAttempts++
  }

  private async loadAuth(): Promise<void> {
    try {
      const result = await BrowserAPI.storage.get<StoredAuth>(STORAGE_KEYS.AUTH)
      
      let rawAuth: any = null
      
      if (result && STORAGE_KEYS.AUTH in result) {
        rawAuth = result[STORAGE_KEYS.AUTH]
      } else if (result && typeof result === 'object' && 'primaryToken' in result) {
        rawAuth = result
      }
      
      if (rawAuth) {
        if (typeof rawAuth === 'string') {
          try {
            this.auth = JSON.parse(rawAuth) as StoredAuth
          } catch (parseError) {
            logger.error('Failed to parse auth JSON string', parseError)
            this.auth = null
          }
        } else if (typeof rawAuth === 'object' && rawAuth !== null) {
          this.auth = rawAuth as StoredAuth
        } else {
          this.auth = null
        }
      } else {
        this.auth = null
      }

      if (this.auth?.backendUrl) {
        this.backendUrl = this.auth.backendUrl
      }
    } catch (error) {
      logger.error('Failed to load auth', error)
      this.auth = null
    }
  }

  private hasValidAuth(): boolean {
    const isValid = !!(this.auth?.primaryToken && this.auth?.userId)
    
    if (!isValid && this.auth) {
      logger.warn('Auth validation failed', {
        hasPrimaryToken: !!this.auth?.primaryToken,
        hasUserId: !!this.auth?.userId
      })
    }
    
    return isValid
  }

  private setupPocketBaseClient(): void {
    this.backendUrl = this.auth!.backendUrl || DEFAULT_BACKEND_URL
    this.pb = new PocketBase(this.backendUrl)

    try {
      const userRecord = {
        id: this.auth!.userId,
        email: this.auth!.email,
        name: this.auth!.email.split('@')[0],
        collectionId: '_pb_users_auth_',
        collectionName: 'users',
      }
      
      this.pb.authStore.save(this.auth!.primaryToken, userRecord)
      this.overrideRealtimeService()
      ;(this.pb.realtime as any).maxReconnectAttempts = BackgroundConfig.REALTIME_MAX_RECONNECT_ATTEMPTS
      this.setupDisconnectHandler()
      this.setupConnectHandler()
    } catch (error) {
      logger.error('Failed to setup PocketBase client', error)
    }
  }

  private setupDisconnectHandler(): void {
    if (!this.pb) return

    (this.pb.realtime as any).onDisconnect = (activeSubscriptions: string[]) => {
      logger.warn('PocketBase realtime disconnected', {
        activeSubscriptions: activeSubscriptions.length,
        topics: activeSubscriptions,
      })
      
      this.status = 'disconnected'
      this.connectionError = 'Connection lost'
      this.broadcastStatus()
      
      // If disconnected with active subscriptions, it's likely a network/server error
      if (activeSubscriptions.length > 0) {
        logger.warn('Disconnect due to network/server error')
        this.healthMonitor?.markUnhealthy('Realtime connection lost due to network/server error')
      }
    }
  }

  private setupConnectHandler(): void {
    if (!this.pb) return

    // Only subscribe to PB_CONNECT if backend is healthy
    if (this.isBackendHealthy()) {
      this.pb.realtime.subscribe('PB_CONNECT', () => {
        logger.debug('PocketBase realtime connected')
        this.status = 'connected'
        this.connectionError = null
        this.broadcastStatus()
      }).catch(error => {
        logger.error('Failed to subscribe to PB_CONNECT', error)
      })
    }
  }

  private async ensureBrowserId(): Promise<void> {
    if (this.browserId) {
      return
    }

    try {
      const result = await BrowserAPI.storage.get<string>(STORAGE_KEYS.PROFILE_ID)
      let rawProfileId: any = result[STORAGE_KEYS.PROFILE_ID]
      
      let profileId: string | null = null
      if (rawProfileId) {
        if (typeof rawProfileId === 'string') {
          try {
            const parsed = JSON.parse(rawProfileId)
            profileId = typeof parsed === 'string' ? parsed : parsed.id || parsed
          } catch {
            profileId = rawProfileId
          }
        } else if (typeof rawProfileId === 'object' && rawProfileId !== null) {
          profileId = rawProfileId.id || rawProfileId
        } else {
          profileId = String(rawProfileId)
        }
      }
      
      if (!profileId) {
        this.browserId = null
        return
      }
      
      if (!this.auth) {
        this.browserId = null
        return
      }
      
      const response = await fetch(
        `${this.backendUrl}/api/collections/browser_profiles/records/${profileId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.auth.primaryToken}`,
            'Content-Type': 'application/json',
          },
        }
      )
      
      if (response.status === 404) {
        logger.warn('Profile not found, may have been deleted', { profileId })
        this.browserId = null
        return
      }
      
      if (response.ok) {
        const profile: BrowserProfile = await response.json()
        this.browserId = profile.id
        logger.debug('Profile verified', { profileName: profile.profile_name })
      } else {
        logger.warn('Failed to verify profile', { 
          status: response.status, 
          profileId
        })
        this.browserId = null
      }
    } catch (error) {
      logger.error('Failed to get browser ID from profile', error)
      this.browserId = null
    }
  }

  private computeTopics(): string[] {
    const userId = this.auth!.userId
    if (!this.browserId) {
      return []
    }
    return [
      `notifications:${userId}:${this.browserId}`,
      `system:${userId}:${this.browserId}`
    ]
  }

  private async subscribeTopics(topics: string[]): Promise<void> {
    if (!this.pb) {
      logger.error('PocketBase client not initialized')
      return
    }

    logger.debug('Starting subscription to topics', { topics })
    await this.cleanupSubscriptions()
    this.status = 'connecting'
    this.broadcastStatus()

    let successCount = 0

    for (const topic of topics) {
      try {
        const subscriptionPromise = this.pb.realtime.subscribe(topic, (data: any) => {
          this.handleRealtimeMessage(topic, data)
        })

        const unsub = await withTimeout(
          subscriptionPromise,
          BackgroundConfig.REALTIME_CONNECTION_TIMEOUT_MS,
          'Realtime connection timeout'
        ) as () => Promise<void>

        this.unsubscribeFns.push(unsub)
        this.activeTopics.add(topic)
        successCount++
        logger.debug('Subscribed to topic', { topic })
      } catch (error: any) {
        logger.error('Failed to subscribe to topic', { topic, error: error.message })
        this.handleSubscriptionError(error)
      }
    }

    this.handleSubscriptionResults(successCount, topics.length)
  }

  private handleRealtimeMessage(_topic: string, data: any): void {
    if (this.status !== 'connected') {
      this.status = 'connected'
      this.connectionError = null
      this.broadcastStatus()
    }

    const notification: NotificationPayload = {
      message: data?.message,
      variant: data?.variant || 'info',
      duration: data?.duration ?? BackgroundConfig.DEFAULT_NOTIFICATION_DURATION_MS,
    }
    
    logger.info('[RealtimeManager] Received notification, sending to active tab', {
      message: notification.message?.substring(0, 50),
      variant: notification.variant,
      duration: notification.duration,
      topic: _topic
    })
    
    BrowserAPI.runtime.sendMessageToActiveTab({
      type: 'REALTIME_NOTIFICATION',
      payload: notification,
    }).catch((error) => {
      logger.warn('[RealtimeManager] Failed to send notification to active tab', {
        error: error instanceof Error ? error.message : error,
        notification: notification.message?.substring(0, 50)
      })
    })
  }

  private handleSubscriptionError(error: any): void {
    this.status = 'error'
    this.connectionError = error?.message || 'Subscription failed'
    this.broadcastStatus()
    this.healthMonitor?.markUnhealthy(`Realtime connection failed: ${error?.message || 'Unknown error'}`)
    this.connectionAttempts = BackgroundConfig.REALTIME_MAX_RETRY_ATTEMPTS
  }

  private handleSubscriptionResults(successCount: number, totalCount: number): void {
    if (successCount > 0 && this.status !== 'error') {
      this.status = 'connected'
      this.broadcastStatus()
      logger.debug(`Subscribed to ${successCount}/${totalCount} topics successfully`)
    } else if (successCount === 0) {
      logger.error('Failed to subscribe to any topics')
      this.status = 'error'
      this.connectionError = 'Failed to subscribe to any topics'
      this.broadcastStatus()
      
      this.healthMonitor?.markUnhealthy('Failed to establish realtime connection')
      this.connectionAttempts = BackgroundConfig.REALTIME_MAX_RETRY_ATTEMPTS
    }
  }

  private broadcastStatus(): void {
    const payload: RealtimeStatusPayload = {
      status: this.status as 'disconnected' | 'connecting' | 'connected' | 'error',
      connected: this.status === 'connected',
      error: this.connectionError,
    }

    BrowserAPI.runtime.sendMessageToTabs({
      type: 'REALTIME_STATUS',
      payload,
    }).catch(error => {
      logger.debug('Failed to broadcast realtime status', error)
    })
  }

  private async cleanupSubscriptions(): Promise<void> {
    const fns = this.unsubscribeFns.splice(0)
    for (const fn of fns) {
      try {
        await fn()
      } catch (error) {
        logger.debug('Failed to unsubscribe', error)
      }
    }
    this.activeTopics.clear()
  }

  async cleanup(): Promise<void> {
    await this.cleanupSubscriptions()
    this.pb = null
    this.status = 'disconnected'
    this.connectionError = null
    this.isInitialized = false
    this.broadcastStatus()
  }

  async forceReinitialize(): Promise<void> {
    logger.debug('Force reinitializing realtime due to auth change')
    this.isInitialized = false
    this.connectionAttempts = 0
    await this.cleanup()
    await this.initialize()
  }
  
  resetRetryAttempts(): void {
    this.connectionAttempts = 0
  }
  
  async disableRealtime(): Promise<void> {
    logger.info('Disabling realtime to prevent CORS errors')
    this.status = 'disconnected'
    this.connectionError = 'Backend unavailable'
    
    if (this.pb) {
      try {
        await this.pb.realtime.unsubscribe()
      } catch (error) {
        logger.error('Failed to unsubscribe from topics', error)
      }
    }
    
    await this.cleanupSubscriptions()
    this.broadcastStatus()
  }
  
  private overrideRealtimeService(): void {
    if (!this.pb) return
    
    const originalSubscribe = this.pb.realtime.subscribe.bind(this.pb.realtime)
    const originalUnsubscribe = this.pb.realtime.unsubscribe.bind(this.pb.realtime)
    
    this.pb.realtime.subscribe = async (topic: string, callback: any, options?: any) => {
      if (!this.isBackendHealthy()) {
        logger.warn('Backend is unhealthy, preventing realtime subscription to avoid CORS errors')
        this.status = 'disconnected'
        this.connectionError = 'Backend unavailable'
        this.broadcastStatus()
        
        return async () => {}
      }
      
      return originalSubscribe(topic, callback, options)
    }
    
    this.pb.realtime.unsubscribe = async (topic?: string) => {
      try {
        return await originalUnsubscribe(topic)
      } catch (error) {
        logger.debug('Error during unsubscribe, ignoring', error)
      }
    }
  }

  getBrowserId(): string | null {
    return this.browserId
  }
}


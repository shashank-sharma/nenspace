import type { HealthStatus, HealthStatusPayload } from '../types'
import type { StoredAuth } from '../../lib/types'
import { STORAGE_KEYS, DEFAULT_BACKEND_URL } from '../../lib/config/constants'
import { BackgroundConfig } from '../config'
import { createLogger } from '../utils/logger'
import { BrowserAPI } from '../utils/browser-api'
import { withTimeout } from '../utils/async'
import { notificationService } from '../../lib/services/notification.service'
import { badgeService } from '../../lib/services/badge.service'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.HEALTH)

export interface HealthMonitorOptions {
  onHealthChange?: (healthy: boolean) => void
}

export class HealthMonitor {
  private backendUrl: string = DEFAULT_BACKEND_URL
  private status: HealthStatus = 'disconnected'
  private error: string | null = null
  private lastChecked: Date | null = null
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private isChecking: boolean = false
  private options: HealthMonitorOptions

  constructor(options: HealthMonitorOptions = {}) {
    this.options = options
  }

  async initialize(): Promise<void> {
    await this.loadBackendUrl()
    
    if (!this.backendUrl) {
      logger.warn('No backend URL configured, skipping health checks')
      return
    }

    await this.checkHealth()
    this.startPeriodicChecks()
  }

  private startPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    this.checkInterval = setInterval(() => {
      this.checkHealth()
    }, BackgroundConfig.HEALTH_CHECK_INTERVAL_MS)
  }

  private async loadBackendUrl(): Promise<void> {
    try {
      const result = await BrowserAPI.storage.get<StoredAuth>(STORAGE_KEYS.AUTH)
      const auth = result[STORAGE_KEYS.AUTH]
      
      if (auth?.backendUrl) {
        this.backendUrl = auth.backendUrl
      }
    } catch (error) {
      logger.error('Failed to load backend URL', error)
    }
  }

  async checkHealth(): Promise<void> {
    if (this.isChecking) return;
    
    if (!this.backendUrl) {
      await this.loadBackendUrl()
      if (!this.backendUrl) return;
    }

    this.isChecking = true
    const previousStatus = this.status

    try {
      const response = await withTimeout(
        fetch(`${this.backendUrl}/api/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
        BackgroundConfig.HEALTH_CHECK_TIMEOUT_MS,
        'Health check timeout'
      )

      if (response.ok) {
        await response.json()
        this.status = 'connected'
        this.error = null
        this.lastChecked = new Date()
        
        // Update badge to healthy
        badgeService.setStatus('healthy')
        
        if (previousStatus !== 'connected' && this.options.onHealthChange) {
          this.options.onHealthChange(true)
          
          // Show reconnection notification
          notificationService.showSuccess(
            'Backend Connected',
            'Successfully reconnected to Nenspace backend',
            { action: 'open_popup' }
          )
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error: any) {
      this.status = 'error'
      this.error = error.message || 'Unknown error'
      this.lastChecked = new Date()
      
      // Update badge to error
      badgeService.setStatus('error')
      
      logger.error('Health check failed', { error: this.error })
      
      if (previousStatus === 'connected' && this.options.onHealthChange) {
        this.options.onHealthChange(false)
        
        // Show connection error notification
        notificationService.showError(
          'Backend Disconnected',
          `Lost connection to Nenspace backend: ${this.error}`,
          { action: 'open_popup' }
        )
      }
    } finally {
      this.isChecking = false
      this.broadcastStatus()
    }
  }

  private broadcastStatus(): void {
    const payload: HealthStatusPayload = {
      status: this.status,
      connected: this.status === 'connected',
      error: this.error,
      lastChecked: this.lastChecked?.toISOString() || null,
    }

    BrowserAPI.runtime.sendMessageToTabs({
      type: 'HEALTH_STATUS',
      payload,
    }).catch(error => {
      logger.debug('Failed to broadcast health status', error)
    })
  }

  getStatus(): HealthStatusPayload {
    return {
      status: this.status,
      connected: this.status === 'connected',
      error: this.error,
      lastChecked: this.lastChecked?.toISOString() || null,
    }
  }

  markUnhealthy(error: string): void {
    logger.warn('Marking backend as unhealthy', { error })
    
    const wasHealthy = this.status === 'connected'
    this.status = 'error'
    this.error = error
    this.lastChecked = new Date()
    
    this.broadcastStatus()
    
    if (wasHealthy && this.options.onHealthChange) {
      this.options.onHealthChange(false)
    }
  }

  isHealthy(): boolean {
    return this.status === 'connected'
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }
}


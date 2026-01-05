/**
 * Error Reporting Service
 * 
 * Centralized error reporting with optional external service integration
 */

import { createLogger } from '../utils/logger.util'
import { userPreferencesStorage } from './plasmo-storage.service'

const logger = createLogger('[ErrorReportingService]')

export interface ErrorReport {
  id: string
  timestamp: number
  level: 'error' | 'warn' | 'info'
  message: string
  stack?: string
  context: {
    component?: string
    action?: string
    userId?: string
    sessionId?: string
    userAgent?: string
    url?: string
  }
  metadata?: Record<string, any>
}

export interface ErrorReportingConfig {
  enabled: boolean
  endpoint?: string
  apiKey?: string
  batchSize: number
  flushInterval: number
  maxRetries: number
}

class ErrorReportingService {
  private config: ErrorReportingConfig
  private errorQueue: ErrorReport[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private sessionId: string
  private isOnline: boolean = navigator.onLine

  constructor() {
    this.sessionId = this.generateSessionId()
    this.config = this.getDefaultConfig()
    this.setupEventListeners()
    this.startFlushTimer()
  }

  private getDefaultConfig(): ErrorReportingConfig {
    return {
      enabled: true,
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      maxRetries: 3
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true
      this.flushErrors()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })

    // Listen for unhandled errors
    window.addEventListener('error', (event) => {
      this.reportError({
        message: event.message,
        stack: event.error?.stack,
        context: {
          component: 'global',
          action: 'unhandled_error',
          url: event.filename,
          userAgent: navigator.userAgent
        }
      })
    })

    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        message: `Unhandled promise rejection: ${event.reason}`,
        stack: event.reason?.stack,
        context: {
          component: 'global',
          action: 'unhandled_rejection',
          userAgent: navigator.userAgent
        }
      })
    })
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(() => {
      this.flushErrors()
    }, this.config.flushInterval)
  }

  /**
   * Report an error
   */
  async reportError(error: Omit<ErrorReport, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    const errorReport: ErrorReport = {
      ...error,
      id: this.generateErrorId(),
      timestamp: Date.now()
    }

    // Add to queue
    this.errorQueue.push(errorReport)

    // Log locally
    logger.error('Error reported', errorReport)

    // Flush if queue is full or if it's a critical error
    if (this.errorQueue.length >= this.config.batchSize || error.level === 'error') {
      await this.flushErrors()
    }
  }

  /**
   * Report a user action for analytics
   */
  async reportUserAction(action: string, metadata?: Record<string, any>): Promise<void> {
    await this.reportError({
      level: 'info',
      message: `User action: ${action}`,
      context: {
        component: 'user',
        action,
        userAgent: navigator.userAgent
      },
      metadata
    })
  }

  /**
   * Report performance metrics
   */
  async reportPerformance(metric: string, value: number, metadata?: Record<string, any>): Promise<void> {
    await this.reportError({
      level: 'info',
      message: `Performance metric: ${metric}`,
      context: {
        component: 'performance',
        action: metric,
        userAgent: navigator.userAgent
      },
      metadata: {
        ...metadata,
        value,
        metric
      }
    })
  }

  /**
   * Flush errors to external service
   */
  private async flushErrors(): Promise<void> {
    if (this.errorQueue.length === 0 || !this.isOnline) {
      return
    }

    const errorsToFlush = [...this.errorQueue]
    this.errorQueue = []

    try {
      await this.sendErrorsToService(errorsToFlush)
      logger.debug(`Flushed ${errorsToFlush.length} errors`)
    } catch (error) {
      logger.error('Failed to flush errors', error)
      // Re-add errors to queue for retry
      this.errorQueue.unshift(...errorsToFlush)
    }
  }

  /**
   * Send errors to external service
   */
  private async sendErrorsToService(errors: ErrorReport[]): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) {
      // No external service configured, just log locally
      return
    }

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        errors,
        sessionId: this.sessionId,
        timestamp: Date.now()
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to send errors: ${response.status} ${response.statusText}`)
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<ErrorReportingConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
    
    // Restart flush timer if interval changed
    if (config.flushInterval) {
      this.startFlushTimer()
    }

    // Save to user preferences
    try {
      const userPrefs = await userPreferencesStorage.getPreferences()
      if (userPrefs) {
        await userPreferencesStorage.savePreferences({
          ...userPrefs,
          errorReporting: this.config
        })
      }
    } catch (error) {
      logger.error('Failed to save error reporting config', error)
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorReportingConfig {
    return { ...this.config }
  }

  /**
   * Get error statistics
   */
  getStats(): { totalErrors: number; queuedErrors: number; isOnline: boolean } {
    return {
      totalErrors: this.errorQueue.length,
      queuedErrors: this.errorQueue.length,
      isOnline: this.isOnline
    }
  }

  /**
   * Clear error queue
   */
  clearQueue(): void {
    this.errorQueue = []
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    
    // Flush remaining errors
    this.flushErrors()
  }
}

// Export singleton instance
export const errorReportingService = new ErrorReportingService()

// Export types
export type { ErrorReport, ErrorReportingConfig }


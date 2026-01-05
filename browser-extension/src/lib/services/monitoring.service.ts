/**
 * Monitoring Service
 * 
 * Provides monitoring, logging, and analytics for the extension.
 */

import { createLogger } from '../utils/logger.util'
import { storage } from './plasmo-storage.service'
import { notificationService } from './notification.service'

const logger = createLogger('[Monitoring]')

export interface MetricData {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
  metadata?: Record<string, any>
}

export interface ErrorReport {
  id: string
  message: string
  stack?: string
  context: string
  timestamp: number
  userId?: string
  browser: string
  version: string
  url?: string
  userAgent: string
  metadata?: Record<string, any>
}

export interface PerformanceMetric {
  name: string
  duration: number
  timestamp: number
  context?: string
  metadata?: Record<string, any>
}

export interface UserEvent {
  event: string
  properties?: Record<string, any>
  timestamp: number
  userId?: string
  sessionId: string
}

class MonitoringService {
  private metrics: MetricData[] = []
  private errors: ErrorReport[] = []
  private performanceMetrics: PerformanceMetric[] = []
  private userEvents: UserEvent[] = []
  private sessionId: string
  private userId?: string
  private isEnabled = true
  private batchSize = 50
  private flushInterval = 30000 // 30 seconds
  private flushTimer: number | null = null

  constructor() {
    this.sessionId = this.generateSessionId()
    this.startFlushTimer()
  }

  /**
   * Initialize monitoring service
   */
  async initialize(userId?: string): Promise<void> {
    this.userId = userId
    await this.loadStoredData()
    logger.debug('Monitoring service initialized', { userId, sessionId: this.sessionId })
  }

  /**
   * Track a custom metric
   */
  trackMetric(name: string, value: number, tags?: Record<string, string>, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return

    const metric: MetricData = {
      name,
      value,
      timestamp: Date.now(),
      tags,
      metadata
    }

    this.metrics.push(metric)
    this.checkBatchSize()
  }

  /**
   * Track user event
   */
  trackEvent(event: string, properties?: Record<string, any>): void {
    if (!this.isEnabled) return

    const userEvent: UserEvent = {
      event,
      properties,
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId
    }

    this.userEvents.push(userEvent)
    this.checkBatchSize()
  }

  /**
   * Track performance metric
   */
  trackPerformance(name: string, duration: number, context?: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return

    const performanceMetric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      context,
      metadata
    }

    this.performanceMetrics.push(performanceMetric)
    this.checkBatchSize()
  }

  /**
   * Report error
   */
  reportError(error: Error, context: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      userId: this.userId,
      browser: this.getBrowserInfo(),
      version: this.getExtensionVersion(),
      url: this.getCurrentUrl(),
      userAgent: navigator.userAgent,
      metadata
    }

    this.errors.push(errorReport)
    this.checkBatchSize()

    // Show user notification for critical errors
    if (this.isCriticalError(error)) {
      notificationService.showError(
        'Extension Error',
        'An error occurred. Please refresh the page or restart the extension.',
        {
          action: 'retry',
          data: { retryAction: 'restart-extension' }
        }
      )
    }

    logger.error('Error reported', errorReport)
  }

  /**
   * Track page load performance
   */
  trackPageLoad(url: string, loadTime: number): void {
    this.trackPerformance('page_load', loadTime, 'content_script', {
      url,
      type: 'navigation'
    })
  }

  /**
   * Track API call performance
   */
  trackApiCall(endpoint: string, method: string, duration: number, status: number): void {
    this.trackPerformance('api_call', duration, 'background', {
      endpoint,
      method,
      status,
      success: status >= 200 && status < 300
    })
  }

  /**
   * Track storage operation
   */
  trackStorageOperation(operation: string, key: string, duration: number, success: boolean): void {
    this.trackPerformance('storage_operation', duration, 'storage', {
      operation,
      key,
      success
    })
  }

  /**
   * Track user interaction
   */
  trackInteraction(element: string, action: string, context?: string): void {
    this.trackEvent('user_interaction', {
      element,
      action,
      context
    })
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(feature: string, action: string, metadata?: Record<string, any>): void {
    this.trackEvent('feature_usage', {
      feature,
      action,
      ...metadata
    })
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    metrics: number
    errors: number
    performanceMetrics: number
    userEvents: number
    sessionId: string
    userId?: string
  } {
    return {
      metrics: this.metrics.length,
      errors: this.errors.length,
      performanceMetrics: this.performanceMetrics.length,
      userEvents: this.userEvents.length,
      sessionId: this.sessionId,
      userId: this.userId
    }
  }

  /**
   * Flush all data to storage/remote
   */
  async flush(): Promise<void> {
    try {
      await this.saveStoredData()
      await this.sendToRemote()
      this.clearData()
      logger.debug('Monitoring data flushed')
    } catch (error) {
      logger.error('Failed to flush monitoring data', error)
    }
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (enabled) {
      this.startFlushTimer()
    } else {
      this.stopFlushTimer()
    }
  }

  /**
   * Check if batch size limit reached
   */
  private checkBatchSize(): void {
    const totalItems = this.metrics.length + this.errors.length + 
                      this.performanceMetrics.length + this.userEvents.length

    if (totalItems >= this.batchSize) {
      this.flush()
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  /**
   * Load stored data from storage
   */
  private async loadStoredData(): Promise<void> {
    try {
      const stored = await storage.get('nenspace_monitoring_data')
      if (stored) {
        this.metrics = stored.metrics || []
        this.errors = stored.errors || []
        this.performanceMetrics = stored.performanceMetrics || []
        this.userEvents = stored.userEvents || []
      }
    } catch (error) {
      logger.error('Failed to load stored monitoring data', error)
    }
  }

  /**
   * Save data to storage
   */
  private async saveStoredData(): Promise<void> {
    try {
      await storage.set('nenspace_monitoring_data', {
        metrics: this.metrics,
        errors: this.errors,
        performanceMetrics: this.performanceMetrics,
        userEvents: this.userEvents,
        timestamp: Date.now()
      })
    } catch (error) {
      logger.error('Failed to save monitoring data to storage', error)
    }
  }

  /**
   * Send data to remote monitoring service
   */
  private async sendToRemote(): Promise<void> {
    // In a real implementation, this would send data to your monitoring service
    // For now, we'll just log the data
    if (this.metrics.length > 0) {
      logger.debug('Sending metrics to remote service', { count: this.metrics.length })
    }
    if (this.errors.length > 0) {
      logger.debug('Sending errors to remote service', { count: this.errors.length })
    }
    if (this.performanceMetrics.length > 0) {
      logger.debug('Sending performance metrics to remote service', { count: this.performanceMetrics.length })
    }
    if (this.userEvents.length > 0) {
      logger.debug('Sending user events to remote service', { count: this.userEvents.length })
    }
  }

  /**
   * Clear all data
   */
  private clearData(): void {
    this.metrics = []
    this.errors = []
    this.performanceMetrics = []
    this.userEvents = []
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Check if error is critical
   */
  private isCriticalError(error: Error): boolean {
    const criticalPatterns = [
      /network error/i,
      /authentication failed/i,
      /permission denied/i,
      /storage error/i
    ]

    return criticalPatterns.some(pattern => pattern.test(error.message))
  }

  /**
   * Get browser information
   */
  private getBrowserInfo(): string {
    const userAgent = navigator.userAgent
    if (userAgent.includes('Chrome')) return 'chrome'
    if (userAgent.includes('Firefox')) return 'firefox'
    if (userAgent.includes('Safari')) return 'safari'
    if (userAgent.includes('Edge')) return 'edge'
    return 'unknown'
  }

  /**
   * Get extension version
   */
  private getExtensionVersion(): string {
    return chrome.runtime.getManifest().version
  }

  /**
   * Get current URL
   */
  private getCurrentUrl(): string | undefined {
    try {
      return window.location.href
    } catch {
      return undefined
    }
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService()

/**
 * Performance tracking decorator
 */
export function trackPerformance(name: string, context?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const start = Date.now()
      try {
        const result = await originalMethod.apply(this, args)
        const duration = Date.now() - start
        monitoringService.trackPerformance(name, duration, context)
        return result
      } catch (error) {
        const duration = Date.now() - start
        monitoringService.trackPerformance(name, duration, context, { error: true })
        throw error
      }
    }

    return descriptor
  }
}

/**
 * Error tracking decorator
 */
export function trackErrors(context: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args)
      } catch (error) {
        monitoringService.reportError(error as Error, context)
        throw error
      }
    }

    return descriptor
  }
}

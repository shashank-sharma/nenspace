/**
 * Performance Monitoring Service
 * 
 * Tracks performance metrics and user interactions
 */

import { createLogger } from '../utils/logger.util'
import { errorReportingService } from './error-reporting.service'

const logger = createLogger('[PerformanceService]')

export interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  metadata?: Record<string, any>
}

export interface UserInteraction {
  action: string
  component: string
  timestamp: number
  duration?: number
  metadata?: Record<string, any>
}

class PerformanceService {
  private metrics: PerformanceMetric[] = []
  private interactions: UserInteraction[] = []
  private observers: PerformanceObserver[] = []
  private isEnabled: boolean = true

  constructor() {
    this.setupPerformanceObservers()
    this.setupUserInteractionTracking()
  }

  /**
   * Setup performance observers
   */
  private setupPerformanceObservers(): void {
    if (!this.isEnabled || typeof PerformanceObserver === 'undefined') {
      return
    }

    try {
      // Observe navigation timing
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            this.recordMetric('navigation_load_time', entry.loadEventEnd - entry.loadEventStart)
            this.recordMetric('navigation_dom_content_loaded', entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart)
            this.recordMetric('navigation_first_paint', entry.responseEnd - entry.requestStart)
          }
        }
      })
      navObserver.observe({ entryTypes: ['navigation'] })
      this.observers.push(navObserver)

      // Observe paint timing
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.recordMetric('first_contentful_paint', entry.startTime)
          } else if (entry.name === 'largest-contentful-paint') {
            this.recordMetric('largest_contentful_paint', entry.startTime)
          }
        }
      })
      paintObserver.observe({ entryTypes: ['paint', 'largest-contentful-paint'] })
      this.observers.push(paintObserver)

      // Observe resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            this.recordMetric('resource_load_time', entry.responseEnd - entry.requestStart, {
              resourceType: entry.initiatorType,
              resourceName: entry.name
            })
          }
        }
      })
      resourceObserver.observe({ entryTypes: ['resource'] })
      this.observers.push(resourceObserver)

    } catch (error) {
      logger.error('Failed to setup performance observers', error)
    }
  }

  /**
   * Setup user interaction tracking
   */
  private setupUserInteractionTracking(): void {
    if (!this.isEnabled) {
      return
    }

    // Track clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      this.recordInteraction('click', this.getElementIdentifier(target), {
        tagName: target.tagName,
        className: target.className,
        id: target.id
      })
    })

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement
      this.recordInteraction('form_submit', this.getElementIdentifier(form), {
        formId: form.id,
        formClass: form.className
      })
    })

    // Track input focus
    document.addEventListener('focus', (event) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        this.recordInteraction('input_focus', this.getElementIdentifier(target), {
          inputType: (target as HTMLInputElement).type
        })
      }
    }, true)
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    if (!this.isEnabled) {
      return
    }

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    }

    this.metrics.push(metric)

    // Send to error reporting service
    errorReportingService.reportPerformance(name, value, metadata)

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100)
    }

    logger.debug(`Performance metric recorded: ${name}`, { value, metadata })
  }

  /**
   * Record a user interaction
   */
  recordInteraction(action: string, component: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) {
      return
    }

    const interaction: UserInteraction = {
      action,
      component,
      timestamp: Date.now(),
      metadata
    }

    this.interactions.push(interaction)

    // Send to error reporting service
    errorReportingService.reportUserAction(`${action}_${component}`, metadata)

    // Keep only last 200 interactions
    if (this.interactions.length > 200) {
      this.interactions = this.interactions.slice(-200)
    }

    logger.debug(`User interaction recorded: ${action}`, { component, metadata })
  }

  /**
   * Measure function execution time
   */
  async measureFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now()
    
    try {
      const result = await fn()
      const duration = performance.now() - startTime
      this.recordMetric(`function_${name}`, duration)
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      this.recordMetric(`function_${name}_error`, duration)
      throw error
    }
  }

  /**
   * Measure API call performance
   */
  async measureApiCall<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now()
    
    try {
      const result = await fn()
      const duration = performance.now() - startTime
      this.recordMetric('api_call_success', duration, { endpoint })
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      this.recordMetric('api_call_error', duration, { endpoint })
      throw error
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    metrics: PerformanceMetric[]
    interactions: UserInteraction[]
    summary: {
      totalMetrics: number
      totalInteractions: number
      averageLoadTime?: number
      averageApiCallTime?: number
    }
  } {
    const loadTimeMetrics = this.metrics.filter(m => m.name.includes('load_time'))
    const apiCallMetrics = this.metrics.filter(m => m.name.includes('api_call'))

    return {
      metrics: [...this.metrics],
      interactions: [...this.interactions],
      summary: {
        totalMetrics: this.metrics.length,
        totalInteractions: this.interactions.length,
        averageLoadTime: loadTimeMetrics.length > 0 
          ? loadTimeMetrics.reduce((sum, m) => sum + m.value, 0) / loadTimeMetrics.length 
          : undefined,
        averageApiCallTime: apiCallMetrics.length > 0
          ? apiCallMetrics.reduce((sum, m) => sum + m.value, 0) / apiCallMetrics.length
          : undefined
      }
    }
  }

  /**
   * Get element identifier for tracking
   */
  private getElementIdentifier(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`
    }
    if (element.className) {
      return `.${element.className.split(' ')[0]}`
    }
    return element.tagName.toLowerCase()
  }

  /**
   * Enable/disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    
    if (!enabled) {
      this.cleanup()
    } else {
      this.setupPerformanceObservers()
      this.setupUserInteractionTracking()
    }
  }

  /**
   * Clear all metrics and interactions
   */
  clear(): void {
    this.metrics = []
    this.interactions = []
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }

  /**
   * Destroy service
   */
  destroy(): void {
    this.cleanup()
    this.clear()
  }
}

// Export singleton instance
export const performanceService = new PerformanceService()

// Export types
export type { PerformanceMetric, UserInteraction }


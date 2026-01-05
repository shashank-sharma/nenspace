/**
 * Debounce Utility
 * 
 * Provides debouncing and throttling utilities for performance optimization.
 */

import { createLogger } from './logger.util'

const logger = createLogger('[Debounce]')

/**
 * Debounce function - delays execution until after wait time has passed
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: number | null = null

  return function executedFunction(...args: Parameters<T>): void {
    const later = () => {
      timeout = null
      if (!immediate) func(...args)
    }

    const callNow = immediate && !timeout

    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(later, wait)

    if (callNow) func(...args)
  }
}

/**
 * Async debounce function - returns a promise that resolves with the latest result
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeout: number | null = null
  let latestResolve: ((value: Awaited<ReturnType<T>>) => void) | null = null
  let latestReject: ((reason?: any) => void) | null = null

  return function executedFunction(...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    return new Promise((resolve, reject) => {
      // Cancel previous timeout
      if (timeout) {
        clearTimeout(timeout)
      }

      // Store latest resolve/reject
      latestResolve = resolve
      latestReject = reject

      timeout = setTimeout(async () => {
        try {
          const result = await func(...args)
          if (latestResolve) {
            latestResolve(result)
          }
        } catch (error) {
          if (latestReject) {
            latestReject(error)
          }
        }
      }, wait)
    })
  }
}

/**
 * Throttle function - limits execution to once per wait time
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null
  let previous = 0

  return function executedFunction(...args: Parameters<T>): void {
    const now = Date.now()
    const remaining = wait - (now - previous)

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      func(...args)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now()
        timeout = null
        func(...args)
      }, remaining)
    }
  }
}

/**
 * Async throttle function - limits async execution to once per wait time
 */
export function throttleAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeout: number | null = null
  let previous = 0
  let lastResult: Awaited<ReturnType<T>>
  let lastPromise: Promise<Awaited<ReturnType<T>>> | null = null

  return function executedFunction(...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    const now = Date.now()
    const remaining = wait - (now - previous)

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      lastPromise = func(...args)
      return lastPromise.then(result => {
        lastResult = result
        return result
      })
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now()
        timeout = null
        lastPromise = func(...args)
        lastPromise.then(result => {
          lastResult = result
        })
      }, remaining)
    }

    // Return the last promise or result
    if (lastPromise) {
      return lastPromise
    }
    return Promise.resolve(lastResult)
  }
}

/**
 * Search debounce utility specifically for search inputs
 * Silently cancels outdated searches when query changes (no error thrown)
 */
export function createSearchDebounce<T>(
  searchFn: (query: string) => Promise<T>,
  delay = 300
): (query: string) => Promise<T> {
  let currentQuery = ''
  let currentPromise: Promise<T> | null = null
  let timeoutId: number | null = null

  return async (query: string): Promise<T> => {
    const queryAtCallTime = query
    currentQuery = query

    // Cancel any pending timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    // If there's already a search in progress, wait for it but check if query changed
    if (currentPromise) {
      try {
        await currentPromise
      } catch (error) {
        // Ignore "Query changed" errors - they're expected when user types quickly
        if (!(error instanceof Error && error.message === 'Query changed')) {
          // Re-throw other errors
          throw error
        }
      }
    }

    // If query changed while waiting, start new search
    if (currentQuery !== queryAtCallTime) {
      return createSearchDebounce(searchFn, delay)(currentQuery)
    }

    // Start new search
    currentPromise = new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          // Check if query is still current
          if (currentQuery === queryAtCallTime) {
            const result = await searchFn(queryAtCallTime)
            resolve(result)
          } else {
            // Query changed during delay - this is expected, resolve with last known value
            // This prevents unhandled promise rejections
            resolve(undefined as T)
          }
        } catch (error) {
          reject(error)
        } finally {
          currentPromise = null
          timeoutId = null
        }
      }, delay) as unknown as number
    })

    return currentPromise
  }
}

/**
 * Batch processor for handling multiple operations with debouncing
 */
export class BatchProcessor<T> {
  private items: T[] = []
  private timeout: number | null = null
  private readonly batchSize: number
  private readonly delay: number
  private readonly processor: (items: T[]) => Promise<void>

  constructor(
    processor: (items: T[]) => Promise<void>,
    batchSize = 10,
    delay = 100
  ) {
    this.processor = processor
    this.batchSize = batchSize
    this.delay = delay
  }

  /**
   * Add item to batch
   */
  add(item: T): void {
    this.items.push(item)

    // Process immediately if batch is full
    if (this.items.length >= this.batchSize) {
      this.process()
    } else {
      // Schedule processing
      this.schedule()
    }
  }

  /**
   * Schedule batch processing
   */
  private schedule(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    this.timeout = setTimeout(() => {
      this.process()
    }, this.delay)
  }

  /**
   * Process current batch
   */
  private async process(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    if (this.items.length === 0) {
      return
    }

    const itemsToProcess = [...this.items]
    this.items = []

    try {
      await this.processor(itemsToProcess)
      logger.debug(`Processed batch of ${itemsToProcess.length} items`)
    } catch (error) {
      logger.error('Batch processing failed', error)
      // Could implement retry logic here
    }
  }

  /**
   * Force process all pending items
   */
  async flush(): Promise<void> {
    await this.process()
  }

  /**
   * Get current batch size
   */
  get currentBatchSize(): number {
    return this.items.length
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private requests: number[] = []
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  /**
   * Check if request is allowed
   */
  isAllowed(): boolean {
    const now = Date.now()
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs)
    
    // Check if we're under the limit
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now)
      return true
    }
    
    return false
  }

  /**
   * Get time until next request is allowed
   */
  getTimeUntilReset(): number {
    if (this.requests.length < this.maxRequests) {
      return 0
    }
    
    const oldestRequest = Math.min(...this.requests)
    return Math.max(0, oldestRequest + this.windowMs - Date.now())
  }

  /**
   * Get current request count
   */
  getCurrentCount(): number {
    const now = Date.now()
    this.requests = this.requests.filter(time => now - time < this.windowMs)
    return this.requests.length
  }
}

/**
 * Storage Batch Utility
 * 
 * Provides batching capabilities for storage operations to improve performance.
 */

import { createLogger } from './logger.util'

const logger = createLogger('[StorageBatch]')

export interface BatchOperation {
  type: 'set' | 'get' | 'remove' | 'clear'
  key?: string
  value?: any
  area?: 'local' | 'sync'
}

export interface BatchResult<T = any> {
  success: boolean
  data?: T
  error?: Error
}

export class StorageBatcher {
  private operations: BatchOperation[] = []
  private batchSize: number
  private batchTimeout: number
  private timeoutId: number | null = null
  private isProcessing = false

  constructor(batchSize = 10, batchTimeout = 100) {
    this.batchSize = batchSize
    this.batchTimeout = batchTimeout
  }

  /**
   * Add a set operation to the batch
   */
  set(key: string, value: any, area: 'local' | 'sync' = 'local'): Promise<BatchResult> {
    return this.addOperation({
      type: 'set',
      key,
      value,
      area
    })
  }

  /**
   * Add a get operation to the batch
   */
  get(key: string, area: 'local' | 'sync' = 'local'): Promise<BatchResult> {
    return this.addOperation({
      type: 'get',
      key,
      area
    })
  }

  /**
   * Add a remove operation to the batch
   */
  remove(key: string, area: 'local' | 'sync' = 'local'): Promise<BatchResult> {
    return this.addOperation({
      type: 'remove',
      key,
      area
    })
  }

  /**
   * Add a clear operation to the batch
   */
  clear(area: 'local' | 'sync' = 'local'): Promise<BatchResult> {
    return this.addOperation({
      type: 'clear',
      area
    })
  }

  /**
   * Add operation to batch and schedule processing
   */
  private addOperation(operation: BatchOperation): Promise<BatchResult> {
    return new Promise((resolve, reject) => {
      const operationWithCallback = {
        ...operation,
        resolve,
        reject
      }

      this.operations.push(operationWithCallback as any)

      // Process immediately if batch is full
      if (this.operations.length >= this.batchSize) {
        this.processBatch()
      } else {
        // Schedule processing after timeout
        this.scheduleProcessing()
      }
    })
  }

  /**
   * Schedule batch processing
   */
  private scheduleProcessing(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }

    this.timeoutId = setTimeout(() => {
      this.processBatch()
    }, this.batchTimeout)
  }

  /**
   * Process all operations in the batch
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.operations.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      const operations = [...this.operations]
      this.operations = []

      // Group operations by area
      const localOps = operations.filter(op => op.area === 'local')
      const syncOps = operations.filter(op => op.area === 'sync')

      // Process local operations
      if (localOps.length > 0) {
        await this.processOperationsForArea(localOps, 'local')
      }

      // Process sync operations
      if (syncOps.length > 0) {
        await this.processOperationsForArea(syncOps, 'sync')
      }

      logger.debug(`Processed ${operations.length} storage operations`)
    } catch (error) {
      logger.error('Batch processing failed', error)
      // Reject all pending operations
      this.operations.forEach(op => {
        if ((op as any).reject) {
          (op as any).reject(error)
        }
      })
      this.operations = []
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process operations for a specific storage area
   */
  private async processOperationsForArea(
    operations: BatchOperation[], 
    area: 'local' | 'sync'
  ): Promise<void> {
    // Group operations by type for better performance
    const setOps = operations.filter(op => op.type === 'set')
    const getOps = operations.filter(op => op.type === 'get')
    const removeOps = operations.filter(op => op.type === 'remove')
    const clearOps = operations.filter(op => op.type === 'clear')

    // Process set operations in batch
    if (setOps.length > 0) {
      await this.batchSetOperations(setOps, area)
    }

    // Process get operations in batch
    if (getOps.length > 0) {
      await this.batchGetOperations(getOps, area)
    }

    // Process remove operations in batch
    if (removeOps.length > 0) {
      await this.batchRemoveOperations(removeOps, area)
    }

    // Process clear operations
    if (clearOps.length > 0) {
      await this.batchClearOperations(clearOps, area)
    }
  }

  /**
   * Batch set operations
   */
  private async batchSetOperations(operations: BatchOperation[], area: 'local' | 'sync'): Promise<void> {
    try {
      const storage = area === 'local' ? chrome.storage.local : chrome.storage.sync
      const items: Record<string, any> = {}

      operations.forEach(op => {
        if (op.key && op.value !== undefined) {
          items[op.key] = op.value
        }
      })

      await storage.set(items)

      // Resolve all set operations
      operations.forEach(op => {
        if ((op as any).resolve) {
          (op as any).resolve({ success: true })
        }
      })
    } catch (error) {
      // Reject all set operations
      operations.forEach(op => {
        if ((op as any).reject) {
          (op as any).reject({ success: false, error })
        }
      })
    }
  }

  /**
   * Batch get operations
   */
  private async batchGetOperations(operations: BatchOperation[], area: 'local' | 'sync'): Promise<void> {
    try {
      const storage = area === 'local' ? chrome.storage.local : chrome.storage.sync
      const keys = operations.map(op => op.key).filter(Boolean) as string[]

      const result = await storage.get(keys)

      // Resolve each get operation with its specific result
      operations.forEach(op => {
        if ((op as any).resolve) {
          const value = op.key ? result[op.key] : result
          (op as any).resolve({ success: true, data: value })
        }
      })
    } catch (error) {
      // Reject all get operations
      operations.forEach(op => {
        if ((op as any).reject) {
          (op as any).reject({ success: false, error })
        }
      })
    }
  }

  /**
   * Batch remove operations
   */
  private async batchRemoveOperations(operations: BatchOperation[], area: 'local' | 'sync'): Promise<void> {
    try {
      const storage = area === 'local' ? chrome.storage.local : chrome.storage.sync
      const keys = operations.map(op => op.key).filter(Boolean) as string[]

      await storage.remove(keys)

      // Resolve all remove operations
      operations.forEach(op => {
        if ((op as any).resolve) {
          (op as any).resolve({ success: true })
        }
      })
    } catch (error) {
      // Reject all remove operations
      operations.forEach(op => {
        if ((op as any).reject) {
          (op as any).reject({ success: false, error })
        }
      })
    }
  }

  /**
   * Batch clear operations
   */
  private async batchClearOperations(operations: BatchOperation[], area: 'local' | 'sync'): Promise<void> {
    try {
      const storage = area === 'local' ? chrome.storage.local : chrome.storage.sync

      await storage.clear()

      // Resolve all clear operations
      operations.forEach(op => {
        if ((op as any).resolve) {
          (op as any).resolve({ success: true })
        }
      })
    } catch (error) {
      // Reject all clear operations
      operations.forEach(op => {
        if ((op as any).reject) {
          (op as any).reject({ success: false, error })
        }
      })
    }
  }

  /**
   * Force process all pending operations
   */
  async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    await this.processBatch()
  }

  /**
   * Get current batch size
   */
  get currentBatchSize(): number {
    return this.operations.length
  }

  /**
   * Check if batch is processing
   */
  get processing(): boolean {
    return this.isProcessing
  }
}

// Export singleton instance
export const storageBatcher = new StorageBatcher()

/**
 * Debounce utility for storage operations
 */
export function debounceStorage<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: number | null = null
  let resolvePromise: ((value: ReturnType<T>) => void) | null = null

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      resolvePromise = resolve

      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args)
          if (resolvePromise) {
            resolvePromise(result)
          }
        } catch (error) {
          if (resolvePromise) {
            resolvePromise(error as ReturnType<T>)
          }
        }
      }, delay)
    })
  }
}

/**
 * Throttle utility for storage operations
 */
export function throttleStorage<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let inThrottle = false
  let lastResult: ReturnType<T>

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (!inThrottle) {
      inThrottle = true
      lastResult = await func(...args)
      setTimeout(() => {
        inThrottle = false
      }, limit)
      return lastResult
    }
    return lastResult
  }
}

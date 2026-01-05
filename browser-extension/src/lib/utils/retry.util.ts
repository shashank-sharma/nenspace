/**
 * Retry utility with exponential backoff
 * Provides consistent retry logic across all services
 */

import { createLogger } from './logger.util'

const logger = createLogger('[RetryUtil]')

export interface RetryOptions {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryCondition?: (error: any) => boolean
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly originalError: any,
    public readonly attempts: number
  ) {
    super(message)
    this.name = 'RetryError'
  }
}

/**
 * Default retry condition - retry on network errors and 5xx status codes
 */
function defaultRetryCondition(error: any): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }
  
  // HTTP 5xx errors
  if (error?.status >= 500) {
    return true
  }
  
  // Rate limiting (429)
  if (error?.status === 429) {
    return true
  }
  
  // Timeout errors
  if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
    return true
  }
  
  return false
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number, backoffMultiplier: number): number {
  const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt - 1)
  const jitter = Math.random() * 0.1 * exponentialDelay // Add 10% jitter
  return Math.min(exponentialDelay + jitter, maxDelay)
}

/**
 * Retry an async function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryCondition = defaultRetryCondition
  } = options

  let lastError: any
  let attempt = 1

  while (attempt <= maxAttempts) {
    try {
      logger.debug(`Attempt ${attempt}/${maxAttempts}`)
      return await fn()
    } catch (error) {
      lastError = error
      
      // Check if we should retry
      if (attempt === maxAttempts || !retryCondition(error)) {
        logger.error(`Final attempt failed or non-retryable error`, { attempt, error })
        break
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, baseDelay, maxDelay, backoffMultiplier)
      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, { error: error.message })
      
      await new Promise(resolve => setTimeout(resolve, delay))
      attempt++
    }
  }

  throw new RetryError(
    `Operation failed after ${maxAttempts} attempts`,
    lastError,
    maxAttempts
  )
}

/**
 * Circuit breaker pattern for API calls
 */
export class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private readonly failureThreshold = 5,
    private readonly recoveryTimeout = 60000, // 1 minute
    private readonly monitoringPeriod = 10000 // 10 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN'
        logger.debug('Circuit breaker transitioning to HALF_OPEN')
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED'
      logger.debug('Circuit breaker transitioning to CLOSED')
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN'
      logger.warn('Circuit breaker transitioning to OPEN', { 
        failureCount: this.failureCount,
        threshold: this.failureThreshold 
      })
    }
  }

  getState(): string {
    return this.state
  }

  getFailureCount(): number {
    return this.failureCount
  }
}

/**
 * Timeout wrapper for async operations
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage))
      }, timeoutMs)
    })
  ])
}

/**
 * Combine retry, circuit breaker, and timeout
 */
export async function withResilience<T>(
  fn: () => Promise<T>,
  options: {
    retry?: RetryOptions
    circuitBreaker?: CircuitBreaker
    timeout?: number
  } = {}
): Promise<T> {
  const { retry = {}, circuitBreaker, timeout = 30000 } = options

  let operation = fn

  // Add timeout
  if (timeout > 0) {
    operation = () => withTimeout(fn(), timeout)
  }

  // Add circuit breaker
  if (circuitBreaker) {
    const originalOperation = operation
    operation = () => circuitBreaker.execute(originalOperation)
  }

  // Add retry
  return withRetry(operation, retry)
}


/**
 * Unit tests for retry utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withRetry, RetryError, CircuitBreaker, withTimeout, withResilience } from '../retry.util'

describe('withRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('should succeed on first attempt', async () => {
    const mockFn = vi.fn().mockResolvedValue('success')
    
    const result = await withRetry(mockFn)
    
    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and eventually succeed', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success')
    
    const resultPromise = withRetry(mockFn, { maxAttempts: 3, baseDelay: 100 })
    
    // Fast-forward timers to simulate delays
    await vi.runAllTimersAsync()
    
    const result = await resultPromise
    
    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(3)
  })

  it('should throw RetryError after max attempts', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Persistent error'))
    
    const resultPromise = withRetry(mockFn, { maxAttempts: 2, baseDelay: 100 })
    
    await vi.runAllTimersAsync()
    
    await expect(resultPromise).rejects.toThrow(RetryError)
    expect(mockFn).toHaveBeenCalledTimes(2)
  })

  it('should not retry non-retryable errors', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Validation error'))
    
    const resultPromise = withRetry(mockFn, {
      maxAttempts: 3,
      retryCondition: (error) => error.message.includes('Network')
    })
    
    await expect(resultPromise).rejects.toThrow('Validation error')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })
})

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(2, 1000) // 2 failures, 1s timeout
  })

  it('should start in CLOSED state', () => {
    expect(circuitBreaker.getState()).toBe('CLOSED')
  })

  it('should transition to OPEN after failure threshold', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Service error'))
    
    // First failure
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow()
    expect(circuitBreaker.getState()).toBe('CLOSED')
    
    // Second failure - should open circuit
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow()
    expect(circuitBreaker.getState()).toBe('OPEN')
  })

  it('should reject immediately when OPEN', async () => {
    // Open the circuit
    const mockFn = vi.fn().mockRejectedValue(new Error('Service error'))
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow()
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow()
    
    // Should reject immediately without calling function
    const newMockFn = vi.fn()
    await expect(circuitBreaker.execute(newMockFn)).rejects.toThrow('Circuit breaker is OPEN')
    expect(newMockFn).not.toHaveBeenCalled()
  })

  it('should transition to HALF_OPEN after timeout', async () => {
    vi.useFakeTimers()
    
    // Open the circuit
    const mockFn = vi.fn().mockRejectedValue(new Error('Service error'))
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow()
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow()
    
    // Fast-forward time
    vi.advanceTimersByTime(1001)
    
    // Should be in HALF_OPEN state
    expect(circuitBreaker.getState()).toBe('HALF_OPEN')
    
    vi.useRealTimers()
  })
})

describe('withTimeout', () => {
  it('should resolve when operation completes within timeout', async () => {
    const fastOperation = Promise.resolve('success')
    
    const result = await withTimeout(fastOperation, 1000)
    
    expect(result).toBe('success')
  })

  it('should reject when operation exceeds timeout', async () => {
    const slowOperation = new Promise(resolve => setTimeout(resolve, 2000))
    
    await expect(withTimeout(slowOperation, 1000)).rejects.toThrow('Operation timed out')
  })
})

describe('withResilience', () => {
  it('should combine retry, circuit breaker, and timeout', async () => {
    const circuitBreaker = new CircuitBreaker(5, 1000)
    const mockFn = vi.fn().mockResolvedValue('success')
    
    const result = await withResilience(mockFn, {
      retry: { maxAttempts: 2 },
      circuitBreaker,
      timeout: 5000
    })
    
    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })
})


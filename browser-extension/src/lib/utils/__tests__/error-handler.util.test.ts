/**
 * Unit tests for error handler utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  formatError, 
  createApiError, 
  isNetworkError, 
  isAuthError, 
  parsePocketBaseError,
  handleApiError
} from '../error-handler.util'

describe('formatError', () => {
  it('should format string errors', () => {
    const result = formatError('Simple error message')
    expect(result).toBe('Simple error message')
  })

  it('should format API errors with status codes', () => {
    const apiError = { message: 'Not found', code: 404 }
    const result = formatError(apiError)
    expect(result).toBe('Not found')
  })

  it('should format authentication errors', () => {
    const authError = { code: 401, message: 'Unauthorized' }
    const result = formatError(authError)
    expect(result).toBe('Authentication expired. Please sign in again.')
  })

  it('should format network errors', () => {
    const networkError = { code: 0, message: 'Network error' }
    const result = formatError(networkError)
    expect(result).toBe('Network connection failed. Please check your internet connection.')
  })

  it('should format server errors', () => {
    const serverError = { code: 500, message: 'Internal server error' }
    const result = formatError(serverError)
    expect(result).toBe('Server error. Please try again later.')
  })

  it('should format PocketBase validation errors', () => {
    const pbError = {
      data: {
        data: {
          email: ['Email is required'],
          password: ['Password must be at least 8 characters']
        }
      }
    }
    const result = formatError(pbError)
    expect(result).toBe('Email is required, Password must be at least 8 characters')
  })

  it('should return default message for unknown errors', () => {
    const unknownError = { someProperty: 'value' }
    const result = formatError(unknownError)
    expect(result).toBe('An unexpected error occurred. Please try again.')
  })
})

describe('createApiError', () => {
  it('should create API error with message', () => {
    const error = createApiError('Test error')
    expect(error).toEqual({
      message: 'Test error',
      code: undefined,
      data: undefined
    })
  })

  it('should create API error with code and data', () => {
    const error = createApiError('Test error', 400, { field: 'value' })
    expect(error).toEqual({
      message: 'Test error',
      code: 400,
      data: { field: 'value' }
    })
  })
})

describe('isNetworkError', () => {
  it('should identify network errors by code', () => {
    const networkError = { code: 0 }
    expect(isNetworkError(networkError)).toBe(true)
  })

  it('should identify fetch errors', () => {
    const fetchError = new TypeError('Failed to fetch')
    expect(isNetworkError(fetchError)).toBe(true)
  })

  it('should return false for non-network errors', () => {
    const otherError = { code: 400, message: 'Bad request' }
    expect(isNetworkError(otherError)).toBe(false)
  })
})

describe('isAuthError', () => {
  it('should identify 401 errors', () => {
    const authError = { code: 401 }
    expect(isAuthError(authError)).toBe(true)
  })

  it('should identify 403 errors', () => {
    const authError = { code: 403 }
    expect(isAuthError(authError)).toBe(true)
  })

  it('should return false for non-auth errors', () => {
    const otherError = { code: 400 }
    expect(isAuthError(otherError)).toBe(false)
  })
})

describe('parsePocketBaseError', () => {
  it('should parse PocketBase error with status', () => {
    const pbError = {
      status: 400,
      message: 'Validation failed',
      data: { field: 'value' }
    }
    
    const result = parsePocketBaseError(pbError)
    
    expect(result).toEqual({
      message: 'Validation failed',
      code: 400,
      data: { field: 'value' }
    })
  })

  it('should handle errors without status', () => {
    const error = { message: 'Generic error' }
    
    const result = parsePocketBaseError(error)
    
    expect(result).toEqual({
      message: 'Generic error',
      code: undefined,
      data: undefined
    })
  })

  it('should handle errors without message', () => {
    const error = { status: 500 }
    
    const result = parsePocketBaseError(error)
    
    expect(result).toEqual({
      message: 'An unexpected error occurred',
      code: 500,
      data: undefined
    })
  })
})

describe('handleApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should attempt retry for retryable errors', async () => {
    const retryAction = vi.fn().mockResolvedValue(undefined)
    const retryableError = { code: 500, message: 'Server error' }
    
    await handleApiError('Test', retryableError, { retryAction })
    
    expect(retryAction).toHaveBeenCalled()
  })

  it('should not retry non-retryable errors', async () => {
    const retryAction = vi.fn()
    const nonRetryableError = { code: 400, message: 'Bad request' }
    
    await handleApiError('Test', nonRetryableError, { retryAction })
    
    expect(retryAction).not.toHaveBeenCalled()
  })

  it('should continue to show error if retry fails', async () => {
    const retryAction = vi.fn().mockRejectedValue(new Error('Retry failed'))
    const retryableError = { code: 500, message: 'Server error' }
    
    // Should not throw, but should handle the retry failure
    await expect(handleApiError('Test', retryableError, { retryAction })).resolves.toBeUndefined()
    
    expect(retryAction).toHaveBeenCalled()
  })
})


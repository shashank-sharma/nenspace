// API helper utilities

import type { ApiError } from '$lib/types'
import { createApiError } from './error-handler.util'

/**
 * Add custom headers to PocketBase request options
 */
export function addCustomHeaders(
  options: RequestInit,
  headers: Record<string, string>
): RequestInit {
  return {
    ...options,
    headers: {
      ...options.headers,
      ...headers
    }
  }
}

/**
 * Parse PocketBase error response
 */
export function parsePocketBaseError(error: any): ApiError {
  if (error.status) {
    return createApiError(
      error.message || 'API request failed',
      error.status,
      error.data
    )
  }

  return createApiError(error.message || 'An unexpected error occurred')
}

/**
 * Retry API call with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // Don't retry on auth errors
      if (error && typeof error === 'object') {
        const apiError = error as ApiError
        if (apiError.code === 401 || apiError.code === 403) {
          throw error
        }
      }

      // Wait before retrying (exponential backoff)
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Normalize backend URL (remove trailing slash)
 */
export function normalizeBackendUrl(url: string): string {
  return url.replace(/\/$/, '')
}


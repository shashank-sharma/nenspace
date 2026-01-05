// Error handling utilities

import type { ApiError } from '$lib/types'
import type { PocketBaseError } from '../types/pocketbase.types'
import { ERROR_MESSAGES } from '$lib/config/constants'
import { createLogger } from './logger.util'
import { notificationService } from '../services/notification.service'

const logger = createLogger('[ErrorHandler]')

/**
 * Format error for user display
 */
export function formatError(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const apiError = error as ApiError

    // Handle specific error codes
    if (apiError.code === 401 || apiError.code === 403) {
      return ERROR_MESSAGES.AUTH_EXPIRED
    }

    if (apiError.code === 0) {
      return ERROR_MESSAGES.NETWORK_ERROR
    }

    if (apiError.code && apiError.code >= 500) {
      return 'Server error. Please try again later.'
    }

    // Return error message if available
    if (apiError.message) {
      return apiError.message
    }

    // Check for PocketBase error format
    if ('data' in apiError && apiError.data) {
      const data = apiError.data as any
      if (data.message) {
        return data.message
      }
      if (data.data) {
        // PocketBase validation errors
        const errors = Object.values(data.data).flat()
        if (errors.length > 0) {
          return errors.join(', ')
        }
      }
    }
  }

  return 'An unexpected error occurred. Please try again.'
}

/**
 * Create API error object
 */
export function createApiError(
  message: string,
  code?: number,
  data?: any
): ApiError {
  return { message, code, data }
}

/**
 * Check if error is network related
 */
export function isNetworkError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const apiError = error as ApiError
    return apiError.code === 0 || (error instanceof TypeError && error.message.includes('fetch'))
  }
  return false
}

/**
 * Check if error is authentication related
 */
export function isAuthError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const apiError = error as ApiError
    return apiError.code === 401 || apiError.code === 403
  }
  return false
}

/**
 * Log error to console with context
 */
export function logError(context: string, error: unknown): void {
  logger.error(`[${context}]`, error)
}

/**
 * Parse PocketBase error into ApiError format
 */
export function parsePocketBaseError(error: PocketBaseError | Error): ApiError {
  if ('status' in error && typeof error.status === 'number') {
    return createApiError(
      error.message || 'API request failed',
      error.status,
      error.data
    )
  }
  return createApiError(error.message || 'An unexpected error occurred')
}

/**
 * Handle error with user notification
 */
export async function handleErrorWithNotification(
  context: string,
  error: unknown,
  options: {
    showNotification?: boolean
    title?: string
    retryAction?: () => Promise<void>
  } = {}
): Promise<void> {
  const { showNotification = true, title, retryAction } = options
  
  // Log error
  logError(context, error)
  
  // Format error message
  const message = formatError(error)
  
  // Show notification if enabled
  if (showNotification) {
    const notificationTitle = title || `${context} Error`
    
    try {
      await notificationService.showError(
        notificationTitle,
        message,
        retryAction ? {
          action: 'retry',
          data: { retryAction: retryAction.toString() }
        } : undefined
      )
    } catch (notificationError) {
      logger.error('Failed to show error notification', notificationError)
    }
  }
}

/**
 * Handle API error with notification and retry logic
 */
export async function handleApiError(
  context: string,
  error: unknown,
  options: {
    showNotification?: boolean
    title?: string
    retryAction?: () => Promise<void>
    maxRetries?: number
  } = {}
): Promise<void> {
  // Parse error if it's a PocketBase error
  const apiError = error && typeof error === 'object' && 'status' in error 
    ? parsePocketBaseError(error)
    : error as ApiError

  // If retry action is provided and error is retryable, attempt retry
  if (options.retryAction && isRetryableError(apiError)) {
    try {
      await options.retryAction()
      return // Success, no need to show error
    } catch (retryError) {
      logger.warn(`Retry failed for ${context}`, retryError)
      // Continue to show error notification
    }
  }

  await handleErrorWithNotification(context, apiError, options)
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const apiError = error as ApiError
    
    // Network errors
    if (apiError.code === 0) return true
    
    // Server errors (5xx)
    if (apiError.code && apiError.code >= 500) return true
    
    // Rate limiting
    if (apiError.code === 429) return true
    
    // Timeout errors
    if (apiError.message?.includes('timeout')) return true
  }
  
  return false
}

/**
 * Handle network error with notification
 */
export async function handleNetworkError(
  context: string,
  error: unknown,
  retryAction?: () => Promise<void>
): Promise<void> {
  await handleErrorWithNotification(context, error, {
    title: 'Connection Error',
    retryAction
  })
}

/**
 * Handle authentication error with notification
 */
export async function handleAuthError(
  context: string,
  error: unknown
): Promise<void> {
  await handleErrorWithNotification(context, error, {
    title: 'Authentication Error'
  })
}


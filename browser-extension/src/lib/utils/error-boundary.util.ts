/**
 * Error Boundary Utilities
 * 
 * Provides global error handling for content scripts and other contexts.
 */

import { createLogger } from './logger.util'

const logger = createLogger('[ErrorBoundary]')

/**
 * Setup global error handlers for content scripts
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    logger.error('Global error in content script', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    })
    
    // Allow error to bubble so other trackers (like Sentry) can see it
  })

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection in content script', {
      reason: event.reason,
      promise: event.promise
    })
    
    // Allow error to bubble
  })

  logger.debug('Global error handlers setup complete')
}

/**
 * Setup error handlers for background service worker
 */
export function setupBackgroundErrorHandlers(): void {
  // Handle uncaught errors
  self.addEventListener('error', (event) => {
    logger.error('Global error in background script', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    })
  })

  // Handle unhandled promise rejections
  self.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection in background script', {
      reason: event.reason,
      promise: event.promise
    })
  })

  logger.debug('Background error handlers setup complete')
}

/**
 * Safe async wrapper that catches and logs errors
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    logger.error(`Error in ${context}`, error)
    return fallback
  }
}

/**
 * Safe sync wrapper that catches and logs errors
 */
export function safeSync<T>(
  fn: () => T,
  context: string,
  fallback?: T
): T | undefined {
  try {
    return fn()
  } catch (error) {
    logger.error(`Error in ${context}`, error)
    return fallback
  }
}

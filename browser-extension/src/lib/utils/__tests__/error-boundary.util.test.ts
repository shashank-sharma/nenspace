/**
 * Tests for Error Boundary Utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  setupGlobalErrorHandlers, 
  setupBackgroundErrorHandlers,
  safeAsync,
  safeSync
} from '../error-boundary.util'

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

vi.mock('../logger.util', () => ({
  createLogger: () => mockLogger
}))

describe('Error Boundary Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setupGlobalErrorHandlers', () => {
    let originalAddEventListener: typeof window.addEventListener
    let originalRemoveEventListener: typeof window.removeEventListener

    beforeEach(() => {
      originalAddEventListener = window.addEventListener
      originalRemoveEventListener = window.removeEventListener
      window.addEventListener = vi.fn()
      window.removeEventListener = vi.fn()
    })

    afterEach(() => {
      window.addEventListener = originalAddEventListener
      window.removeEventListener = originalRemoveEventListener
    })

    it('should setup global error handlers', () => {
      setupGlobalErrorHandlers()

      expect(window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function))
      expect(window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
    })

    it('should log error information when error occurs', () => {
      setupGlobalErrorHandlers()

      // Get the error handler
      const errorHandler = (window.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === 'error'
      )[1]

      const mockEvent = {
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        error: new Error('Test error'),
        preventDefault: vi.fn()
      }

      errorHandler(mockEvent)

      expect(mockLogger.error).toHaveBeenCalledWith('Global error in content script', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        error: expect.any(Error)
      })
      expect(mockEvent.preventDefault).toHaveBeenCalled()
    })

    it('should log unhandled promise rejection', () => {
      setupGlobalErrorHandlers()

      // Get the rejection handler
      const rejectionHandler = (window.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === 'unhandledrejection'
      )[1]

      const mockEvent = {
        reason: 'Promise rejection reason',
        promise: Promise.resolve(),
        preventDefault: vi.fn()
      }

      rejectionHandler(mockEvent)

      expect(mockLogger.error).toHaveBeenCalledWith('Unhandled promise rejection in content script', {
        reason: 'Promise rejection reason',
        promise: expect.any(Promise)
      })
      expect(mockEvent.preventDefault).toHaveBeenCalled()
    })
  })

  describe('setupBackgroundErrorHandlers', () => {
    let originalAddEventListener: typeof self.addEventListener

    beforeEach(() => {
      originalAddEventListener = self.addEventListener
      self.addEventListener = vi.fn()
    })

    afterEach(() => {
      self.addEventListener = originalAddEventListener
    })

    it('should setup background error handlers', () => {
      setupBackgroundErrorHandlers()

      expect(self.addEventListener).toHaveBeenCalledWith('error', expect.any(Function))
      expect(self.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
    })

    it('should log error information when background error occurs', () => {
      setupBackgroundErrorHandlers()

      // Get the error handler
      const errorHandler = (self.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === 'error'
      )[1]

      const mockEvent = {
        message: 'Background error',
        filename: 'background.js',
        lineno: 20,
        colno: 10,
        error: new Error('Background error')
      }

      errorHandler(mockEvent)

      expect(mockLogger.error).toHaveBeenCalledWith('Global error in background script', {
        message: 'Background error',
        filename: 'background.js',
        lineno: 20,
        colno: 10,
        error: expect.any(Error)
      })
    })

    it('should log unhandled promise rejection in background', () => {
      setupBackgroundErrorHandlers()

      // Get the rejection handler
      const rejectionHandler = (self.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === 'unhandledrejection'
      )[1]

      const mockEvent = {
        reason: 'Background promise rejection',
        promise: Promise.resolve()
      }

      rejectionHandler(mockEvent)

      expect(mockLogger.error).toHaveBeenCalledWith('Unhandled promise rejection in background script', {
        reason: 'Background promise rejection',
        promise: expect.any(Promise)
      })
    })
  })

  describe('safeAsync', () => {
    it('should return success result when function succeeds', async () => {
      const mockFn = vi.fn().mockResolvedValue('success')

      const result = await safeAsync(mockFn, 'test context')

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalled()
    })

    it('should return fallback value when function fails', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'))

      const result = await safeAsync(mockFn, 'test context', 'fallback')

      expect(result).toBe('fallback')
      expect(mockLogger.error).toHaveBeenCalledWith('Error in test context', expect.any(Error))
    })

    it('should return undefined when function fails and no fallback provided', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'))

      const result = await safeAsync(mockFn, 'test context')

      expect(result).toBeUndefined()
      expect(mockLogger.error).toHaveBeenCalledWith('Error in test context', expect.any(Error))
    })

    it('should handle non-Error rejections', async () => {
      const mockFn = vi.fn().mockRejectedValue('string error')

      const result = await safeAsync(mockFn, 'test context')

      expect(result).toBeUndefined()
      expect(mockLogger.error).toHaveBeenCalledWith('Error in test context', 'string error')
    })
  })

  describe('safeSync', () => {
    it('should return success result when function succeeds', () => {
      const mockFn = vi.fn().mockReturnValue('success')

      const result = safeSync(mockFn, 'test context')

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalled()
    })

    it('should return fallback value when function fails', () => {
      const mockFn = vi.fn().mockImplementation(() => {
        throw new Error('Test error')
      })

      const result = safeSync(mockFn, 'test context', 'fallback')

      expect(result).toBe('fallback')
      expect(mockLogger.error).toHaveBeenCalledWith('Error in test context', expect.any(Error))
    })

    it('should return undefined when function fails and no fallback provided', () => {
      const mockFn = vi.fn().mockImplementation(() => {
        throw new Error('Test error')
      })

      const result = safeSync(mockFn, 'test context')

      expect(result).toBeUndefined()
      expect(mockLogger.error).toHaveBeenCalledWith('Error in test context', expect.any(Error))
    })

    it('should handle non-Error exceptions', () => {
      const mockFn = vi.fn().mockImplementation(() => {
        throw 'string error'
      })

      const result = safeSync(mockFn, 'test context')

      expect(result).toBeUndefined()
      expect(mockLogger.error).toHaveBeenCalledWith('Error in test context', 'string error')
    })
  })
})

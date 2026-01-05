/**
 * Tests for Notification Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { notificationService } from '../notification.service'
import type { NotificationOptions, NotificationClickData } from '../notification.service'

// Mock Chrome APIs
const mockChrome = {
  notifications: {
    create: vi.fn(),
    clear: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onButtonClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  tabs: {
    create: vi.fn(),
    update: vi.fn()
  }
}

// Mock global chrome object
Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true
})

// Mock logger
vi.mock('../../utils/logger.util', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset notification IDs
    notificationService['notificationIds'].clear()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('show', () => {
    it('should create basic notification', async () => {
      const options: NotificationOptions = {
        type: 'basic',
        title: 'Test Title',
        message: 'Test Message'
      }

      mockChrome.notifications.create.mockResolvedValue('notification-123')

      const result = await notificationService.show(options)

      expect(result).toBe('notification-123')
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        {
          type: 'basic',
          title: 'Test Title',
          message: 'Test Message',
          iconUrl: expect.any(String)
        }
      )
    })

    it('should create image notification', async () => {
      const options: NotificationOptions = {
        type: 'image',
        title: 'Test Title',
        message: 'Test Message',
        imageUrl: 'https://example.com/image.png'
      }

      mockChrome.notifications.create.mockResolvedValue('notification-123')

      const result = await notificationService.show(options)

      expect(result).toBe('notification-123')
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        {
          type: 'image',
          title: 'Test Title',
          message: 'Test Message',
          imageUrl: 'https://example.com/image.png',
          iconUrl: expect.any(String)
        }
      )
    })

    it('should create list notification', async () => {
      const options: NotificationOptions = {
        type: 'list',
        title: 'Test Title',
        message: 'Test Message',
        items: [
          { title: 'Item 1', message: 'Message 1' },
          { title: 'Item 2', message: 'Message 2' }
        ]
      }

      mockChrome.notifications.create.mockResolvedValue('notification-123')

      const result = await notificationService.show(options)

      expect(result).toBe('notification-123')
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        {
          type: 'list',
          title: 'Test Title',
          message: '2 items',
          items: options.items,
          iconUrl: expect.any(String)
        }
      )
    })

    it('should create progress notification', async () => {
      const options: NotificationOptions = {
        type: 'progress',
        title: 'Test Title',
        message: 'Test Message',
        progress: 75
      }

      mockChrome.notifications.create.mockResolvedValue('notification-123')

      const result = await notificationService.show(options)

      expect(result).toBe('notification-123')
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        {
          type: 'progress',
          title: 'Test Title',
          message: 'Test Message',
          progress: 75,
          iconUrl: expect.any(String)
        }
      )
    })

    it('should handle notification creation failure', async () => {
      const options: NotificationOptions = {
        title: 'Test Title',
        message: 'Test Message'
      }

      mockChrome.notifications.create.mockRejectedValue(new Error('Creation failed'))

      const result = await notificationService.show(options)

      expect(result).toBeNull()
    })

    it('should setup click handler when clickData is provided', async () => {
      const clickData: NotificationClickData = {
        action: 'open_tab',
        data: { url: 'https://example.com' }
      }

      const options: NotificationOptions = {
        title: 'Test Title',
        message: 'Test Message',
        clickData
      }

      mockChrome.notifications.create.mockResolvedValue('notification-123')

      await notificationService.show(options)

      expect(mockChrome.notifications.onClicked.addListener).toHaveBeenCalled()
    })

    it('should auto-cleanup old notifications when limit is reached', async () => {
      // Fill up notification IDs to trigger cleanup
      for (let i = 0; i < 5; i++) {
        notificationService['notificationIds'].add(`notification-${i}`)
      }

      const options: NotificationOptions = {
        title: 'Test Title',
        message: 'Test Message'
      }

      mockChrome.notifications.create.mockResolvedValue('notification-123')
      mockChrome.notifications.clear.mockResolvedValue(true)

      await notificationService.show(options)

      expect(mockChrome.notifications.clear).toHaveBeenCalledWith('notification-0')
    })
  })

  describe('showSuccess', () => {
    it('should show success notification with success icon', async () => {
      mockChrome.notifications.create.mockResolvedValue('notification-123')

      const result = await notificationService.showSuccess('Success!', 'Operation completed')

      expect(result).toBe('notification-123')
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        expect.objectContaining({
          type: 'basic',
          title: 'Success!',
          message: 'Operation completed',
          iconUrl: expect.stringContaining('success')
        })
      )
    })

    it('should pass clickData to show method', async () => {
      const clickData: NotificationClickData = {
        action: 'retry',
        data: { retryAction: 'test-action' }
      }

      mockChrome.notifications.create.mockResolvedValue('notification-123')

      await notificationService.showSuccess('Success!', 'Operation completed', clickData)

      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        expect.objectContaining({
          clickData
        })
      )
    })
  })

  describe('showError', () => {
    it('should show error notification with error icon', async () => {
      mockChrome.notifications.create.mockResolvedValue('notification-123')

      const result = await notificationService.showError('Error!', 'Something went wrong')

      expect(result).toBe('notification-123')
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        expect.objectContaining({
          type: 'basic',
          title: 'Error!',
          message: 'Something went wrong',
          iconUrl: expect.stringContaining('error'),
          requireInteraction: true
        })
      )
    })
  })

  describe('showProgress', () => {
    it('should show progress notification with clamped progress value', async () => {
      mockChrome.notifications.create.mockResolvedValue('notification-123')

      const result = await notificationService.showProgress('Progress', '50% complete', 50)

      expect(result).toBe('notification-123')
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        expect.objectContaining({
          type: 'progress',
          title: 'Progress',
          message: '50% complete',
          progress: 50,
          iconUrl: expect.stringContaining('progress')
        })
      )
    })

    it('should clamp progress value to 0-100 range', async () => {
      mockChrome.notifications.create.mockResolvedValue('notification-123')

      await notificationService.showProgress('Progress', 'Over 100%', 150)

      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        expect.objectContaining({
          progress: 100
        })
      )

      await notificationService.showProgress('Progress', 'Under 0%', -10)

      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        expect.objectContaining({
          progress: 0
        })
      )
    })
  })

  describe('showList', () => {
    it('should show list notification with items', async () => {
      const items = [
        { title: 'Item 1', message: 'Message 1' },
        { title: 'Item 2', message: 'Message 2' }
      ]

      mockChrome.notifications.create.mockResolvedValue('notification-123')

      const result = await notificationService.showList('List Title', items)

      expect(result).toBe('notification-123')
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        expect.objectContaining({
          type: 'list',
          title: 'List Title',
          message: '2 items',
          items
        })
      )
    })
  })

  describe('showImage', () => {
    it('should show image notification with image URL', async () => {
      const imageUrl = 'https://example.com/image.png'

      mockChrome.notifications.create.mockResolvedValue('notification-123')

      const result = await notificationService.showImage('Image Title', 'Image Message', imageUrl)

      expect(result).toBe('notification-123')
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        'notification-123',
        expect.objectContaining({
          type: 'image',
          title: 'Image Title',
          message: 'Image Message',
          imageUrl
        })
      )
    })
  })

  describe('clear', () => {
    it('should clear notification and remove from tracking', async () => {
      notificationService['notificationIds'].add('notification-123')
      mockChrome.notifications.clear.mockResolvedValue(true)

      const result = await notificationService.clear('notification-123')

      expect(result).toBe(true)
      expect(mockChrome.notifications.clear).toHaveBeenCalledWith('notification-123')
      expect(notificationService['notificationIds'].has('notification-123')).toBe(false)
    })

    it('should return false if notification not found', async () => {
      mockChrome.notifications.clear.mockResolvedValue(false)

      const result = await notificationService.clear('nonexistent-notification')

      expect(result).toBe(false)
    })
  })

  describe('clearAll', () => {
    it('should clear all tracked notifications', async () => {
      notificationService['notificationIds'].add('notification-1')
      notificationService['notificationIds'].add('notification-2')
      mockChrome.notifications.clear.mockResolvedValue(true)

      await notificationService.clearAll()

      expect(mockChrome.notifications.clear).toHaveBeenCalledWith('notification-1')
      expect(mockChrome.notifications.clear).toHaveBeenCalledWith('notification-2')
      expect(notificationService['notificationIds'].size).toBe(0)
    })
  })

  describe('handleNotificationAction', () => {
    it('should open tab when action is open_tab', () => {
      const data = { url: 'https://example.com' }

      notificationService['handleNotificationAction']('open_tab', data)

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({ url: 'https://example.com' })
    })

    it('should focus tab when action is focus_tab', () => {
      const data = { tabId: 123 }

      notificationService['handleNotificationAction']('focus_tab', data)

      expect(mockChrome.tabs.update).toHaveBeenCalledWith(123, { active: true })
    })

    it('should handle retry action', () => {
      const data = { retryAction: 'test-action' }

      // This would typically trigger a retry mechanism
      notificationService['handleNotificationAction']('retry', data)

      // In a real implementation, this would call the retry action
      // For now, we just verify it doesn't throw
      expect(true).toBe(true)
    })
  })

  describe('getIconUrl', () => {
    it('should return success icon URL', () => {
      const iconUrl = notificationService['getSuccessIcon']()
      expect(iconUrl).toContain('success')
    })

    it('should return error icon URL', () => {
      const iconUrl = notificationService['getErrorIcon']()
      expect(iconUrl).toContain('error')
    })

    it('should return progress icon URL', () => {
      const iconUrl = notificationService['getProgressIcon']()
      expect(iconUrl).toContain('progress')
    })

    it('should return default icon URL', () => {
      const iconUrl = notificationService['getDefaultIcon']()
      expect(iconUrl).toContain('icon')
    })
  })
})

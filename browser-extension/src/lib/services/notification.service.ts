/**
 * Notification Service
 * 
 * Type-safe wrapper around Chrome notifications API with auto-cleanup,
 * click handling, and user preference integration.
 */

import { createLogger } from '../utils/logger.util'
import { userPreferencesStorage } from './plasmo-storage.service'
import { getUrl } from '../utils/environment.util'

const logger = createLogger('[NotificationService]')

// Notification types
export type NotificationType = 'basic' | 'image' | 'list' | 'progress'

export interface NotificationClickData {
  action: 'open_tab' | 'open_popup' | 'focus_tab' | 'retry'
  data?: {
    url?: string
    tabId?: number
    retryAction?: string
  }
}

export interface NotificationOptions {
  type?: NotificationType
  iconUrl?: string
  title: string
  message: string
  contextMessage?: string
  imageUrl?: string
  items?: Array<{ title: string; message: string }>
  progress?: number
  buttons?: Array<{ title: string; iconUrl?: string }>
  requireInteraction?: boolean
  silent?: boolean
  clickData?: NotificationClickData
}

export interface NotificationPreferences {
  enabled: boolean
  showSuccessNotifications: boolean
  showErrorNotifications: boolean
  showProgressNotifications: boolean
  soundEnabled: boolean
}

class NotificationService {
  private readonly maxNotifications = 5
  private readonly notificationIds = new Set<string>()
  private preferences: NotificationPreferences | null = null
  private readonly isFirefox: boolean

  constructor() {
    this.isFirefox = this.detectFirefox()
    this.loadPreferences()
  }

  /**
   * Detect if running in Firefox
   */
  private detectFirefox(): boolean {
    return typeof browser !== 'undefined' && browser.runtime && browser.runtime.getBrowserInfo
  }

  private async loadPreferences(): Promise<void> {
    try {
      const userPrefs = await userPreferencesStorage.getPreferences()
      this.preferences = userPrefs?.notificationSettings || this.getDefaultPreferences()
    } catch (error) {
      logger.error('Failed to load notification preferences', error)
      this.preferences = this.getDefaultPreferences()
    }
  }

  private getDefaultPreferences(): NotificationPreferences {
    return {
      enabled: true,
      showSuccessNotifications: true,
      showErrorNotifications: true,
      showProgressNotifications: false,
      soundEnabled: true
    }
  }

  /**
   * Show a notification with type safety and preference checking
   */
  async show(options: NotificationOptions): Promise<string | null> {
    try {
      // Check if notifications are enabled
      if (!this.preferences?.enabled) {
        logger.debug('Notifications disabled by user preference')
        return null
      }

      // Check notification type preferences
      if (!this.shouldShowNotification(options)) {
        logger.debug('Notification type disabled by user preference', { type: options.type })
        return null
      }

      // Check if Chrome notifications API is available
      if (!chrome.notifications) {
        logger.warn('Chrome notifications API not available')
        return null
      }

      // Clean up old notifications if we have too many
      await this.cleanupOldNotifications()

      // Generate unique notification ID
      const notificationId = this.generateNotificationId()

      // Prepare notification options
      const notificationOptions: chrome.notifications.NotificationOptions<NotificationType> = {
        type: options.type || 'basic',
        iconUrl: options.iconUrl || this.getDefaultIcon(),
        title: options.title,
        message: options.message,
        contextMessage: options.contextMessage,
        imageUrl: options.imageUrl,
        items: options.items,
        progress: options.progress
      }

      // Add Chrome-specific properties only for Chrome
      if (!this.isFirefox) {
        if (options.buttons) {
          (notificationOptions as any).buttons = options.buttons
        }
        if (options.requireInteraction !== undefined) {
          (notificationOptions as any).requireInteraction = options.requireInteraction
        }
        if (options.silent !== undefined) {
          (notificationOptions as any).silent = options.silent || !this.preferences?.soundEnabled
        }
      }

      // Create the notification
      await new Promise<void>((resolve, reject) => {
        chrome.notifications.create(notificationId, notificationOptions, (createdId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })

      // Track the notification
      this.notificationIds.add(notificationId)

      // Set up click handler
      this.setupClickHandler(notificationId, options.clickData)

      logger.debug('Notification created', { id: notificationId, title: options.title })
      return notificationId

    } catch (error) {
      logger.error('Failed to show notification', error)
      return null
    }
  }

  /**
   * Show success notification
   */
  async showSuccess(title: string, message: string, clickData?: NotificationClickData): Promise<string | null> {
    return this.show({
      type: 'basic',
      title,
      message,
      iconUrl: this.getSuccessIcon(),
      clickData
    })
  }

  /**
   * Show error notification
   */
  async showError(title: string, message: string, clickData?: NotificationClickData): Promise<string | null> {
    return this.show({
      type: 'basic',
      title,
      message,
      iconUrl: this.getErrorIcon(),
      requireInteraction: true,
      clickData
    })
  }

  /**
   * Show progress notification
   */
  async showProgress(title: string, message: string, progress: number, clickData?: NotificationClickData): Promise<string | null> {
    return this.show({
      type: 'progress',
      title,
      message,
      progress: Math.max(0, Math.min(100, progress)),
      iconUrl: this.getProgressIcon(),
      clickData
    })
  }

  /**
   * Show list notification
   */
  async showList(title: string, items: Array<{ title: string; message: string }>, clickData?: NotificationClickData): Promise<string | null> {
    return this.show({
      type: 'list',
      title,
      message: `${items.length} items`,
      items,
      clickData
    })
  }

  /**
   * Show image notification
   */
  async showImage(title: string, message: string, imageUrl: string, clickData?: NotificationClickData): Promise<string | null> {
    return this.show({
      type: 'image',
      title,
      message,
      imageUrl,
      clickData
    })
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      const current = await userPreferencesStorage.getPreferences()
      const updated = {
        ...current,
        notificationSettings: {
          ...current?.notificationSettings,
          ...preferences
        }
      }
      await userPreferencesStorage.savePreferences(updated)
      this.preferences = updated.notificationSettings
      logger.debug('Notification preferences updated', preferences)
    } catch (error) {
      logger.error('Failed to update notification preferences', error)
      throw error
    }
  }

  /**
   * Clear a specific notification
   */
  async clear(notificationId: string): Promise<void> {
    try {
      if (chrome.notifications) {
        chrome.notifications.clear(notificationId)
        this.notificationIds.delete(notificationId)
        logger.debug('Notification cleared', { id: notificationId })
      }
    } catch (error) {
      logger.error('Failed to clear notification', error)
    }
  }

  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    try {
      if (chrome.notifications) {
        for (const id of this.notificationIds) {
          chrome.notifications.clear(id)
        }
        this.notificationIds.clear()
        logger.debug('All notifications cleared')
      }
    } catch (error) {
      logger.error('Failed to clear all notifications', error)
    }
  }

  /**
   * Check if notification should be shown based on preferences
   */
  private shouldShowNotification(options: NotificationOptions): boolean {
    if (!this.preferences) return true

    // Check if it's a success notification
    if (options.iconUrl?.includes('success') || options.title.toLowerCase().includes('success')) {
      return this.preferences.showSuccessNotifications
    }

    // Check if it's an error notification
    if (options.iconUrl?.includes('error') || options.title.toLowerCase().includes('error')) {
      return this.preferences.showErrorNotifications
    }

    // Check if it's a progress notification
    if (options.type === 'progress' || options.progress !== undefined) {
      return this.preferences.showProgressNotifications
    }

    // Default to showing other notifications
    return true
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `nenspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Clean up old notifications if we have too many
   */
  private async cleanupOldNotifications(): Promise<void> {
    if (this.notificationIds.size >= this.maxNotifications) {
      const oldestId = Array.from(this.notificationIds)[0]
      await this.clear(oldestId)
    }
  }

  /**
   * Set up click handler for notification
   */
  private setupClickHandler(notificationId: string, clickData?: NotificationClickData): void {
    if (!chrome.notifications) return

    const clickHandler = (id: string) => {
      if (id === notificationId) {
        logger.debug('Notification clicked', { id, clickData })
        
        // Handle click based on data
        if (clickData?.action) {
          this.handleNotificationAction(clickData.action, clickData.data)
        }
        
        // Clear the notification after click
        this.clear(notificationId)
      }
    }

    chrome.notifications.onClicked.addListener(clickHandler)
  }

  /**
   * Handle notification action
   */
  private handleNotificationAction(action: string, data?: NotificationClickData['data']): void {
    switch (action) {
      case 'open_tab':
        if (data.url) {
          chrome.tabs.create({ url: data.url })
        }
        break
      case 'open_popup':
        chrome.action.openPopup()
        break
      case 'focus_tab':
        if (data.tabId) {
          chrome.tabs.update(data.tabId, { active: true })
        }
        break
      default:
        logger.debug('Unknown notification action', { action, data })
    }
  }

  /**
   * Get default icon URL
   */
  private getDefaultIcon(): string {
    return getUrl('assets/icon.png')
  }

  /**
   * Get success icon URL
   */
  private getSuccessIcon(): string {
    return getUrl('assets/icon-success.png')
  }

  /**
   * Get error icon URL
   */
  private getErrorIcon(): string {
    return getUrl('assets/icon-error.png')
  }

  /**
   * Get progress icon URL
   */
  private getProgressIcon(): string {
    return getUrl('assets/icon-progress.png')
  }
}

// Export singleton instance
export const notificationService = new NotificationService()

// Export types
export type { NotificationOptions, NotificationPreferences }

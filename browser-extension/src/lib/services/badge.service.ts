/**
 * Badge Service
 * 
 * Manages extension badge text and color to show status information
 * like sync status, pending tasks, and connection state.
 */

import { createLogger } from '../utils/logger.util'

const logger = createLogger('[BadgeService]')

export type BadgeStatus = 'healthy' | 'syncing' | 'error' | 'offline' | 'pending'

export interface BadgeState {
  text: string
  color: string
  title: string
}

export interface BadgeOptions {
  text?: string
  color?: string
  title?: string
  animated?: boolean
}

class BadgeService {
  private currentState: BadgeState | null = null
  private animationInterval: NodeJS.Timeout | null = null
  private pendingCount = 0

  constructor() {
    this.initializeBadge()
  }

  /**
   * Initialize badge with default state
   */
  private initializeBadge(): void {
    this.setStatus('offline', { text: '·', color: '#6b7280', title: 'Nenspace - Offline' })
  }

  /**
   * Set badge status with predefined states
   */
  async setStatus(status: BadgeStatus, options: BadgeOptions = {}): Promise<void> {
    try {
      if (!chrome.action) {
        logger.warn('Chrome action API not available')
        return
      }

      const state = this.getStatusState(status, options)
      this.currentState = state

      // Clear any existing animation
      this.clearAnimation()

      // Set badge properties
      await Promise.all([
        this.setBadgeText(state.text),
        this.setBadgeColor(state.color),
        this.setTitle(state.title)
      ])

      // Start animation if requested
      if (options.animated) {
        this.startAnimation(status)
      }

      logger.debug('Badge status updated', { status, state })
    } catch (error) {
      logger.error('Failed to set badge status', error)
    }
  }

  /**
   * Set custom badge text
   */
  async setText(text: string, color?: string, title?: string): Promise<void> {
    try {
      if (!chrome.action) return

      await this.setBadgeText(text)
      if (color) await this.setBadgeColor(color)
      if (title) await this.setTitle(title)

      this.currentState = {
        text,
        color: color || this.currentState?.color || '#3b82f6',
        title: title || this.currentState?.title || 'Nenspace'
      }

      logger.debug('Badge text updated', { text, color, title })
    } catch (error) {
      logger.error('Failed to set badge text', error)
    }
  }

  /**
   * Update pending tasks count
   */
  async setPendingCount(count: number): Promise<void> {
    this.pendingCount = count
    
    if (count > 0) {
      await this.setStatus('pending', { 
        text: count > 99 ? '99+' : count.toString(),
        color: '#f59e0b',
        title: `${count} pending tasks`
      })
    } else {
      // Reset to healthy if no pending tasks
      await this.setStatus('healthy')
    }
  }

  /**
   * Clear badge
   */
  async clear(): Promise<void> {
    try {
      if (!chrome.action) return

      await this.setBadgeText('')
      await this.setBadgeColor('#3b82f6')
      await this.setTitle('Nenspace')

      this.clearAnimation()
      this.currentState = null
      this.pendingCount = 0

      logger.debug('Badge cleared')
    } catch (error) {
      logger.error('Failed to clear badge', error)
    }
  }

  /**
   * Get current badge state
   */
  getCurrentState(): BadgeState | null {
    return this.currentState
  }

  /**
   * Get pending count
   */
  getPendingCount(): number {
    return this.pendingCount
  }

  /**
   * Get predefined state for status
   */
  private getStatusState(status: BadgeStatus, options: BadgeOptions): BadgeState {
    const states: Record<BadgeStatus, BadgeState> = {
      healthy: {
        text: '✓',
        color: '#10b981',
        title: 'Nenspace - All synced'
      },
      syncing: {
        text: '↻',
        color: '#f59e0b',
        title: 'Nenspace - Syncing...'
      },
      error: {
        text: '!',
        color: '#ef4444',
        title: 'Nenspace - Error'
      },
      offline: {
        text: '·',
        color: '#6b7280',
        title: 'Nenspace - Offline'
      },
      pending: {
        text: options.text || '!',
        color: options.color || '#f59e0b',
        title: options.title || 'Nenspace - Pending tasks'
      }
    }

    const baseState = states[status]
    return {
      text: options.text || baseState.text,
      color: options.color || baseState.color,
      title: options.title || baseState.title
    }
  }

  /**
   * Set badge text
   */
  private async setBadgeText(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.action.setBadgeText({ text }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Set badge color
   */
  private async setBadgeColor(color: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.action.setBadgeBackgroundColor({ color }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Set badge title (tooltip)
   */
  private async setTitle(title: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.action.setTitle({ title }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Start animation for specific status
   */
  private startAnimation(status: BadgeStatus): void {
    this.clearAnimation()

    if (status === 'syncing') {
      this.animationInterval = setInterval(() => {
        this.animateSyncing()
      }, 1000)
    } else if (status === 'error') {
      this.animationInterval = setInterval(() => {
        this.animateError()
      }, 2000)
    }
  }

  /**
   * Clear animation
   */
  private clearAnimation(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval)
      this.animationInterval = null
    }
  }

  /**
   * Animate syncing status
   */
  private async animateSyncing(): Promise<void> {
    if (!this.currentState) return

    const symbols = ['↻', '⟳', '⟲', '↻']
    const currentIndex = symbols.indexOf(this.currentState.text)
    const nextIndex = (currentIndex + 1) % symbols.length

    await this.setText(symbols[nextIndex], this.currentState.color, this.currentState.title)
  }

  /**
   * Animate error status
   */
  private async animateError(): Promise<void> {
    if (!this.currentState) return

    const isVisible = this.currentState.text === '!'
    await this.setText(isVisible ? '' : '!', this.currentState.color, this.currentState.title)
  }

  /**
   * Cleanup on service destruction
   */
  destroy(): void {
    this.clearAnimation()
  }
}

// Export singleton instance
export const badgeService = new BadgeService()

// Export types
export type { BadgeState, BadgeOptions }

import { createLogger } from './logger.util'

const logger = createLogger('[TabActivityTracker]')

export interface TabActivityState {
  isVisible: boolean
  isActive: boolean
  hasWindowFocus: boolean
  visibilityState: DocumentVisibilityState
  timestamp: number
}

export type TabActivityCallback = (state: TabActivityState) => void

/**
 * Tab Activity Tracker
 * 
 * Reliably tracks tab visibility and activity state, handling edge cases like:
 * - Input field focus (shouldn't hide notifications)
 * - Window focus/blur events
 * - Tab switching
 * - Page visibility changes
 * 
 * Inspired by shortcut focus tracking approach.
 */
export class TabActivityTracker {
  private isVisible = false
  private hasWindowFocus = false
  private visibilityState: DocumentVisibilityState = 'visible'
  private subscribers = new Set<TabActivityCallback>()
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly debounceMs = 50

  constructor() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      logger.warn('TabActivityTracker initialized in non-browser context')
      return
    }

    this.initialize()
  }

  /**
   * Get current activity state
   */
  getState(): TabActivityState {
    return {
      isVisible: this.isVisible,
      isActive: this.isActive,
      hasWindowFocus: this.hasWindowFocus,
      visibilityState: this.visibilityState,
      timestamp: Date.now(),
    }
  }

  /**
   * Check if tab is currently active
   * A tab is active if it's visible AND the window has focus
   */
  get isActive(): boolean {
    return this.isVisible && this.hasWindowFocus
  }

  /**
   * Subscribe to activity state changes
   * @param callback - Called whenever activity state changes
   * @returns Unsubscribe function
   */
  subscribe(callback: TabActivityCallback): () => void {
    this.subscribers.add(callback)
    callback(this.getState())
    
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Initialize event listeners
   */
  private initialize(): void {
    this.updateVisibilityState()
    this.updateWindowFocus()

    document.addEventListener('visibilitychange', this.handleVisibilityChange, true)
    window.addEventListener('focus', this.handleWindowFocus, true)
    window.addEventListener('blur', this.handleWindowBlur, true)

    logger.debug('TabActivityTracker initialized', this.getState())
  }

  /**
   * Cleanup event listeners
   */
  destroy(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }

    document.removeEventListener('visibilitychange', this.handleVisibilityChange, true)
    window.removeEventListener('focus', this.handleWindowFocus, true)
    window.removeEventListener('blur', this.handleWindowBlur, true)

    this.subscribers.clear()
    logger.debug('TabActivityTracker destroyed')
  }

  /**
   * Update visibility state from document.visibilityState
   */
  private updateVisibilityState(): void {
    const wasVisible = this.isVisible
    this.visibilityState = document.visibilityState
    this.isVisible = this.visibilityState === 'visible'

    if (wasVisible !== this.isVisible) {
      logger.debug('Visibility state changed', {
        wasVisible,
        isVisible: this.isVisible,
        visibilityState: this.visibilityState,
      })
      this.notifySubscribers()
    }
  }

  /**
   * Update window focus state
   * Uses document.hasFocus() as a fallback, but primarily relies on focus/blur events
   */
  private updateWindowFocus(): void {
    const hadFocus = this.hasWindowFocus
    
    if (typeof document.hasFocus === 'function') {
      this.hasWindowFocus = document.hasFocus()
    } else {
      this.hasWindowFocus = true
    }

    if (hadFocus !== this.hasWindowFocus) {
      logger.debug('Window focus state changed', {
        hadFocus,
        hasWindowFocus: this.hasWindowFocus,
      })
      this.notifySubscribers()
    }
  }

  /**
   * Handle visibility change events
   */
  private handleVisibilityChange = (): void => {
    this.updateVisibilityState()
  }

  /**
   * Handle window focus events
   * Only triggers when the window itself receives focus (not input fields)
   */
  private handleWindowFocus = (event: FocusEvent): void => {
    if (event.target === window || event.target === document) {
      this.debouncedUpdate(() => {
        this.hasWindowFocus = true
        this.notifySubscribers()
      })
    }
  }

  /**
   * Handle window blur events
   * Only triggers when the window itself loses focus
   */
  private handleWindowBlur = (event: FocusEvent): void => {
    if (event.target === window || event.target === document) {
      this.debouncedUpdate(() => {
        this.hasWindowFocus = false
        this.notifySubscribers()
      })
    }
  }

  /**
   * Debounced update to prevent rapid state changes
   */
  private debouncedUpdate(updateFn: () => void): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
    }

    this.debounceTimeout = setTimeout(() => {
      updateFn()
      this.debounceTimeout = null
    }, this.debounceMs)
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    const state = this.getState()
    this.subscribers.forEach((callback) => {
      try {
        callback(state)
      } catch (error) {
        logger.error('Error in TabActivityTracker subscriber', error)
      }
    })
  }
}

let globalTracker: TabActivityTracker | null = null

/**
 * Get or create the global TabActivityTracker instance
 * Use this for singleton behavior across the extension
 */
export function getTabActivityTracker(): TabActivityTracker {
  if (!globalTracker) {
    globalTracker = new TabActivityTracker()
  }
  return globalTracker
}

/**
 * Destroy the global tracker (useful for cleanup in tests)
 */
export function destroyGlobalTracker(): void {
  if (globalTracker) {
    globalTracker.destroy()
    globalTracker = null
  }
}


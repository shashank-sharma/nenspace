/**
 * Focus Trap Utility
 * 
 * Provides focus management for modals and other overlay components.
 * Ensures keyboard navigation stays within the modal boundaries.
 */

import { createLogger } from './logger.util'

const logger = createLogger('[FocusTrap]')

export interface FocusTrapOptions {
  /** Element to trap focus within */
  container: HTMLElement
  /** Whether to focus the first element on activation */
  focusFirst?: boolean
  /** Whether to restore focus to the previously focused element on deactivation */
  restoreFocus?: boolean
  /** Custom selector for focusable elements */
  focusableSelector?: string
}

export class FocusTrap {
  private container: HTMLElement
  private focusFirst: boolean
  private restoreFocus: boolean
  private focusableSelector: string
  private previouslyFocusedElement: HTMLElement | null = null
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null
  private isActive = false

  constructor(options: FocusTrapOptions) {
    this.container = options.container
    this.focusFirst = options.focusFirst ?? true
    this.restoreFocus = options.restoreFocus ?? true
    this.focusableSelector = options.focusableSelector ?? 
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  }

  /**
   * Activate focus trap
   */
  activate(): void {
    if (this.isActive) {
      logger.warn('Focus trap already active')
      return
    }

    // Store currently focused element
    if (this.restoreFocus) {
      this.previouslyFocusedElement = document.activeElement as HTMLElement
    }

    // Find focusable elements
    const focusableElements = this.getFocusableElements()
    
    if (focusableElements.length === 0) {
      logger.warn('No focusable elements found in container')
      return
    }

    // Focus first element if requested
    if (this.focusFirst) {
      focusableElements[0].focus()
    }

    // Setup keyboard handler
    this.keydownHandler = (event: KeyboardEvent) => {
      this.handleKeydown(event, focusableElements)
    }

    this.container.addEventListener('keydown', this.keydownHandler)
    this.isActive = true

    logger.debug('Focus trap activated', {
      focusableCount: focusableElements.length,
      firstElement: focusableElements[0]?.tagName
    })
  }

  /**
   * Deactivate focus trap
   */
  deactivate(): void {
    if (!this.isActive) {
      logger.warn('Focus trap not active')
      return
    }

    // Remove keyboard handler
    if (this.keydownHandler) {
      this.container.removeEventListener('keydown', this.keydownHandler)
      this.keydownHandler = null
    }

    // Restore focus to previously focused element
    if (this.restoreFocus && this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus()
      this.previouslyFocusedElement = null
    }

    this.isActive = false
    logger.debug('Focus trap deactivated')
  }

  /**
   * Get all focusable elements within the container
   */
  private getFocusableElements(): HTMLElement[] {
    const elements = Array.from(
      this.container.querySelectorAll(this.focusableSelector)
    ) as HTMLElement[]

    return elements.filter(element => {
      // Check if element is visible and not disabled
      const style = window.getComputedStyle(element)
      const isVisible = style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0'
      const isEnabled = !element.hasAttribute('disabled')
      const isFocusable = element.tabIndex >= 0 || 
                         element.tagName === 'A' || 
                         element.tagName === 'BUTTON' ||
                         element.tagName === 'INPUT' ||
                         element.tagName === 'SELECT' ||
                         element.tagName === 'TEXTAREA'

      return isVisible && isEnabled && isFocusable
    })
  }

  /**
   * Handle keyboard navigation
   */
  private handleKeydown(event: KeyboardEvent, focusableElements: HTMLElement[]): void {
    if (event.key !== 'Tab') {
      return
    }

    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
    
    if (currentIndex === -1) {
      // Current focus is not in our trap, focus first element
      focusableElements[0]?.focus()
      event.preventDefault()
      return
    }

    if (event.shiftKey) {
      // Shift + Tab: move backwards
      if (currentIndex === 0) {
        // Wrap to last element
        focusableElements[focusableElements.length - 1]?.focus()
        event.preventDefault()
      }
    } else {
      // Tab: move forwards
      if (currentIndex === focusableElements.length - 1) {
        // Wrap to first element
        focusableElements[0]?.focus()
        event.preventDefault()
      }
    }
  }

  /**
   * Check if focus trap is active
   */
  get active(): boolean {
    return this.isActive
  }

  /**
   * Update focusable elements (useful when content changes)
   */
  updateFocusableElements(): void {
    if (!this.isActive) {
      return
    }

    const focusableElements = this.getFocusableElements()
    const currentElement = document.activeElement as HTMLElement
    
    // If current focus is no longer valid, focus first element
    if (!focusableElements.includes(currentElement)) {
      focusableElements[0]?.focus()
    }
  }
}

/**
 * Create a focus trap for a container element
 */
export function createFocusTrap(options: FocusTrapOptions): FocusTrap {
  return new FocusTrap(options)
}

/**
 * Focus trap hook for Svelte components
 */
export function useFocusTrap(
  container: HTMLElement,
  options: Omit<FocusTrapOptions, 'container'> = {}
): FocusTrap {
  return new FocusTrap({ ...options, container })
}

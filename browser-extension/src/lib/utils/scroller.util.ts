/**
 * Scroller Utility
 *
 * Provides smooth scrolling functionality for page navigation.
 * Handles both smooth and instant scrolling with proper element detection.
 */

export interface ScrollOptions {
  smooth?: boolean
  behavior?: ScrollBehavior
  duration?: number
}

export interface ScrollDirection {
  x: 'left' | 'right' | 'center'
  y: 'up' | 'down' | 'top' | 'bottom' | 'center'
}

class ScrollerUtil {
  private activatedElement: Element | null = null
  private isScrolling = false
  private scrollAnimationId: number | null = null

  /**
   * Get the main scrolling element (document.scrollingElement or document.body)
   */
  private getScrollingElement(): Element {
    return document.scrollingElement || document.body || document.documentElement
  }

  /**
   * Check if an element is scrollable in a given direction
   */
  private isScrollableElement(element: Element, direction: 'x' | 'y'): boolean {
    const computedStyle = globalThis.getComputedStyle(element)
    const overflow = direction === 'x' ? 'overflow-x' : 'overflow-y'
    const overflowValue = computedStyle.getPropertyValue(overflow)
    
    return overflowValue !== 'hidden' && 
           computedStyle.getPropertyValue('visibility') !== 'hidden' &&
           computedStyle.getPropertyValue('display') !== 'none'
  }

  /**
   * Find the first scrollable element starting from the given element
   */
  private findScrollableElement(element: Element, direction: 'x' | 'y'): Element {
    let current = element
    
    while (current && current !== this.getScrollingElement()) {
      if (this.isScrollableElement(current, direction)) {
        return current
      }
      current = current.parentElement || this.getScrollingElement()
    }
    
    return this.getScrollingElement()
  }

  /**
   * Get scroll properties for a direction
   */
  private getScrollProperties(direction: 'x' | 'y') {
    return {
      x: {
        axisName: 'scrollLeft',
        max: 'scrollWidth',
        viewSize: 'clientWidth'
      },
      y: {
        axisName: 'scrollTop',
        max: 'scrollHeight',
        viewSize: 'clientHeight'
      }
    }[direction]
  }

  /**
   * Calculate scroll amount based on direction and step size
   */
  private calculateScrollAmount(
    element: Element, 
    direction: 'x' | 'y', 
    amount: number | string
  ): number {
    const props = this.getScrollProperties(direction)
    
    if (typeof amount === 'string') {
      switch (amount) {
        case 'max':
          return element[props.max] - element[props.axisName]
        case 'viewSize':
          return direction === 'x' ? globalThis.innerWidth : globalThis.innerHeight
        default:
          return 0
      }
    }
    
    return amount
  }

  /**
   * Perform smooth scroll animation
   */
  private smoothScroll(
    element: Element, 
    direction: 'x' | 'y', 
    amount: number, 
    options: ScrollOptions = {}
  ): Promise<void> {
    return new Promise((resolve) => {
      if (this.scrollAnimationId) {
        cancelAnimationFrame(this.scrollAnimationId)
      }

      const props = this.getScrollProperties(direction)
      const startPosition = element[props.axisName]
      const duration = options.duration || 300
      const startTime = performance.now()

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3)
        const currentPosition = startPosition + (amount * easeOut)
        
        element[props.axisName] = currentPosition
        
        if (progress < 1) {
          this.scrollAnimationId = requestAnimationFrame(animate)
        } else {
          this.scrollAnimationId = null
          this.isScrolling = false
          resolve()
        }
      }

      this.isScrolling = true
      this.scrollAnimationId = requestAnimationFrame(animate)
    })
  }

  /**
   * Scroll by a relative amount
   */
  async scrollBy(
    direction: 'x' | 'y', 
    amount: number | string, 
    options: ScrollOptions = {}
  ): Promise<void> {
    if (this.isScrolling && !options.smooth) {
      return // Prevent overlapping scrolls unless explicitly smooth
    }

    // Find the appropriate scrolling element
    if (!this.activatedElement) {
      this.activatedElement = this.findScrollableElement(document.activeElement || document.body, direction)
    }

    const element = this.findScrollableElement(this.activatedElement, direction)
    const scrollAmount = this.calculateScrollAmount(element, direction, amount)

    if (scrollAmount === 0) return

    if (options.smooth || options.behavior === 'smooth') {
      await this.smoothScroll(element, direction, scrollAmount, options)
    } else {
      // Instant scroll
      const props = this.getScrollProperties(direction)
      element[props.axisName] += scrollAmount
    }

    // Update activated element
    this.activatedElement = element
  }

  /**
   * Scroll to an absolute position
   */
  async scrollTo(
    direction: 'x' | 'y', 
    position: number | string, 
    options: ScrollOptions = {}
  ): Promise<void> {
    if (!this.activatedElement) {
      this.activatedElement = this.findScrollableElement(document.activeElement || document.body, direction)
    }

    const element = this.findScrollableElement(this.activatedElement, direction)
    const props = this.getScrollProperties(direction)
    const currentPosition = element[props.axisName]
    const targetPosition = typeof position === 'string' 
      ? this.calculateScrollAmount(element, direction, position)
      : position
    
    const scrollAmount = targetPosition - currentPosition

    if (scrollAmount === 0) return

    if (options.smooth || options.behavior === 'smooth') {
      await this.smoothScroll(element, direction, scrollAmount, options)
    } else {
      element[props.axisName] = targetPosition
    }

    this.activatedElement = element
  }

  /**
   * Scroll to top of page
   */
  async scrollToTop(options: ScrollOptions = {}): Promise<void> {
    await this.scrollTo('y', 0, options)
  }

  /**
   * Scroll to bottom of page
   */
  async scrollToBottom(options: ScrollOptions = {}): Promise<void> {
    await this.scrollTo('y', 'max', options)
  }

  /**
   * Scroll up by a step
   */
  async scrollUp(step: number = 100, options: ScrollOptions = {}): Promise<void> {
    await this.scrollBy('y', -step, options)
  }

  /**
   * Scroll down by a step
   */
  async scrollDown(step: number = 100, options: ScrollOptions = {}): Promise<void> {
    await this.scrollBy('y', step, options)
  }

  /**
   * Scroll left by a step
   */
  async scrollLeft(step: number = 100, options: ScrollOptions = {}): Promise<void> {
    await this.scrollBy('x', -step, options)
  }

  /**
   * Scroll right by a step
   */
  async scrollRight(step: number = 100, options: ScrollOptions = {}): Promise<void> {
    await this.scrollBy('x', step, options)
  }

  /**
   * Scroll up by half a page
   */
  async scrollPageUp(options: ScrollOptions = {}): Promise<void> {
    await this.scrollBy('y', 'viewSize', { ...options, smooth: true })
    await this.scrollBy('y', -window.innerHeight / 2, options)
  }

  /**
   * Scroll down by half a page
   */
  async scrollPageDown(options: ScrollOptions = {}): Promise<void> {
    await this.scrollBy('y', window.innerHeight / 2, options)
  }

  /**
   * Scroll to center of page
   */
  async scrollToCenter(options: ScrollOptions = {}): Promise<void> {
    const element = this.getScrollingElement()
    const props = this.getScrollProperties('y')
    const maxScroll = element[props.max] - element[props.viewSize]
    const centerPosition = maxScroll / 2
    await this.scrollTo('y', centerPosition, options)
  }

  /**
   * Reset the activated element
   */
  reset(): void {
    this.activatedElement = null
    if (this.scrollAnimationId) {
      cancelAnimationFrame(this.scrollAnimationId)
      this.scrollAnimationId = null
    }
    this.isScrolling = false
  }

  /**
   * Check if currently scrolling
   */
  isCurrentlyScrolling(): boolean {
    return this.isScrolling
  }
}

// Export singleton instance
export const scroller = new ScrollerUtil()

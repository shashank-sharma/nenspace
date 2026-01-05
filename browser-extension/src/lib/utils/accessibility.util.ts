/**
 * Accessibility Utilities
 * 
 * Provides accessibility testing and validation utilities.
 */

import { createLogger } from './logger.util'

const logger = createLogger('[Accessibility]')

export interface AccessibilityViolation {
  id: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
  description: string
  help: string
  helpUrl: string
  nodes: Array<{
    target: string[]
    html: string
    failureSummary: string
  }>
}

export interface AccessibilityResults {
  violations: AccessibilityViolation[]
  passes: number
  incomplete: number
  inapplicable: number
}

/**
 * Accessibility service for testing and validation
 */
export class AccessibilityService {
  private axeCore: any = null

  constructor() {
    this.initializeAxeCore()
  }

  /**
   * Initialize axe-core for accessibility testing
   */
  private async initializeAxeCore(): Promise<void> {
    try {
      // In a real implementation, you would import axe-core
      // For now, we'll create a mock implementation
      this.axeCore = {
        run: this.mockAxeRun.bind(this)
      }
      logger.debug('Accessibility service initialized')
    } catch (error) {
      logger.error('Failed to initialize axe-core', error)
    }
  }

  /**
   * Run accessibility tests on an element
   */
  async testElement(element: HTMLElement): Promise<AccessibilityResults> {
    if (!this.axeCore) {
      logger.warn('Axe-core not initialized, returning empty results')
      return {
        violations: [],
        passes: 0,
        incomplete: 0,
        inapplicable: 0
      }
    }

    try {
      const results = await this.axeCore.run(element)
      return this.processResults(results)
    } catch (error) {
      logger.error('Accessibility test failed', error)
      return {
        violations: [],
        passes: 0,
        incomplete: 0,
        inapplicable: 0
      }
    }
  }

  /**
   * Run accessibility tests on the entire document
   */
  async testDocument(): Promise<AccessibilityResults> {
    return this.testElement(document.documentElement)
  }

  /**
   * Check if an element has proper ARIA attributes
   */
  validateAriaAttributes(element: HTMLElement): string[] {
    const issues: string[] = []
    const tagName = element.tagName.toLowerCase()

    // Check for missing aria-label on interactive elements
    if (this.isInteractiveElement(element) && !this.hasAriaLabel(element)) {
      issues.push(`Interactive element ${tagName} missing aria-label or aria-labelledby`)
    }

    // Check for missing role on custom interactive elements
    if (this.isCustomInteractiveElement(element) && !element.getAttribute('role')) {
      issues.push(`Custom interactive element ${tagName} missing role attribute`)
    }

    // Check for proper heading hierarchy
    if (tagName.match(/^h[1-6]$/)) {
      const level = parseInt(tagName[1])
      const previousHeading = this.getPreviousHeading(element)
      if (previousHeading) {
        const prevLevel = parseInt(previousHeading.tagName[1])
        if (level > prevLevel + 1) {
          issues.push(`Heading level ${level} skips level ${prevLevel + 1}`)
        }
      }
    }

    return issues
  }

  /**
   * Check color contrast ratio
   */
  checkColorContrast(foreground: string, background: string): {
    ratio: number
    level: 'AA' | 'AAA' | 'FAIL'
    largeText: boolean
  } {
    // Simplified contrast calculation
    // In a real implementation, you would use a proper contrast calculation library
    const ratio = this.calculateContrastRatio(foreground, background)
    
    let level: 'AA' | 'AAA' | 'FAIL'
    if (ratio >= 7) {
      level = 'AAA'
    } else if (ratio >= 4.5) {
      level = 'AA'
    } else {
      level = 'FAIL'
    }

    return {
      ratio,
      level,
      largeText: false // Would need font size to determine this
    }
  }

  /**
   * Check if element is keyboard accessible
   */
  isKeyboardAccessible(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase()
    
    // Native interactive elements are keyboard accessible
    if (['a', 'button', 'input', 'select', 'textarea'].includes(tagName)) {
      return true
    }

    // Check for tabindex
    const tabIndex = element.getAttribute('tabindex')
    if (tabIndex !== null && tabIndex !== '-1') {
      return true
    }

    // Check for role
    const role = element.getAttribute('role')
    if (role && ['button', 'link', 'menuitem', 'tab'].includes(role)) {
      return true
    }

    return false
  }

  /**
   * Mock axe-core run function for testing
   */
  private async mockAxeRun(element: HTMLElement): Promise<any> {
    // This is a mock implementation
    // In a real implementation, you would use the actual axe-core library
    return {
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: []
    }
  }

  /**
   * Process axe-core results
   */
  private processResults(results: any): AccessibilityResults {
    return {
      violations: results.violations || [],
      passes: results.passes?.length || 0,
      incomplete: results.incomplete?.length || 0,
      inapplicable: results.inapplicable?.length || 0
    }
  }

  /**
   * Check if element is interactive
   */
  private isInteractiveElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase()
    return ['a', 'button', 'input', 'select', 'textarea', 'details'].includes(tagName)
  }

  /**
   * Check if element has aria-label or aria-labelledby
   */
  private hasAriaLabel(element: HTMLElement): boolean {
    return !!(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby'))
  }

  /**
   * Check if element is a custom interactive element
   */
  private isCustomInteractiveElement(element: HTMLElement): boolean {
    const role = element.getAttribute('role')
    return role && ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio'].includes(role)
  }

  /**
   * Get previous heading element
   */
  private getPreviousHeading(element: HTMLElement): HTMLHeadingElement | null {
    let current = element.previousElementSibling
    while (current) {
      if (current.tagName.match(/^H[1-6]$/)) {
        return current as HTMLHeadingElement
      }
      current = current.previousElementSibling
    }
    return null
  }

  /**
   * Calculate contrast ratio between two colors
   */
  private calculateContrastRatio(color1: string, color2: string): number {
    // Simplified implementation
    // In a real implementation, you would convert colors to RGB and calculate luminance
    return 4.5 // Mock value
  }
}

// Export singleton instance
export const accessibilityService = new AccessibilityService()

/**
 * Quick accessibility check for an element
 */
export async function quickA11yCheck(element: HTMLElement): Promise<{
  issues: string[]
  score: number
}> {
  const service = new AccessibilityService()
  const ariaIssues = service.validateAriaAttributes(element)
  const keyboardAccessible = service.isKeyboardAccessible(element)
  
  const issues = [...ariaIssues]
  if (!keyboardAccessible && service.isInteractiveElement(element)) {
    issues.push('Element is not keyboard accessible')
  }

  const score = Math.max(0, 100 - (issues.length * 20))
  
  return { issues, score }
}
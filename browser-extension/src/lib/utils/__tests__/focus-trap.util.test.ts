/**
 * Tests for Focus Trap Utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FocusTrap, createFocusTrap } from '../focus-trap.util'

// Mock logger
vi.mock('../logger.util', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('FocusTrap', () => {
  let container: HTMLElement
  let button1: HTMLButtonElement
  let button2: HTMLButtonElement
  let input: HTMLInputElement
  let hiddenButton: HTMLButtonElement
  let disabledButton: HTMLButtonElement

  beforeEach(() => {
    // Create test DOM structure
    container = document.createElement('div')
    container.innerHTML = `
      <button id="button1">Button 1</button>
      <input id="input" type="text" />
      <button id="button2">Button 2</button>
      <button id="hidden" style="display: none">Hidden Button</button>
      <button id="disabled" disabled>Disabled Button</button>
    `
    document.body.appendChild(container)

    button1 = container.querySelector('#button1') as HTMLButtonElement
    button2 = container.querySelector('#button2') as HTMLButtonElement
    input = container.querySelector('#input') as HTMLInputElement
    hiddenButton = container.querySelector('#hidden') as HTMLButtonElement
    disabledButton = container.querySelector('#disabled') as HTMLButtonElement
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  describe('constructor', () => {
    it('should create focus trap with default options', () => {
      const focusTrap = new FocusTrap({ container })

      expect(focusTrap.active).toBe(false)
    })

    it('should create focus trap with custom options', () => {
      const focusTrap = new FocusTrap({
        container,
        focusFirst: false,
        restoreFocus: false,
        focusableSelector: 'button'
      })

      expect(focusTrap.active).toBe(false)
    })
  })

  describe('activate', () => {
    it('should activate focus trap and focus first element', () => {
      const focusTrap = new FocusTrap({ container })

      focusTrap.activate()

      expect(focusTrap.active).toBe(true)
      expect(document.activeElement).toBe(button1)
    })

    it('should not focus first element when focusFirst is false', () => {
      const focusTrap = new FocusTrap({ 
        container, 
        focusFirst: false 
      })

      focusTrap.activate()

      expect(focusTrap.active).toBe(true)
      expect(document.activeElement).not.toBe(button1)
    })

    it('should not activate if already active', () => {
      const focusTrap = new FocusTrap({ container })
      focusTrap.activate()

      const initialActiveElement = document.activeElement
      focusTrap.activate()

      expect(document.activeElement).toBe(initialActiveElement)
    })

    it('should handle container with no focusable elements', () => {
      const emptyContainer = document.createElement('div')
      const focusTrap = new FocusTrap({ container: emptyContainer })

      focusTrap.activate()

      expect(focusTrap.active).toBe(false)
    })
  })

  describe('deactivate', () => {
    it('should deactivate focus trap', () => {
      const focusTrap = new FocusTrap({ container })
      focusTrap.activate()

      focusTrap.deactivate()

      expect(focusTrap.active).toBe(false)
    })

    it('should restore focus to previously focused element', () => {
      const focusTrap = new FocusTrap({ container })
      
      // Focus an element outside the container
      const outsideButton = document.createElement('button')
      document.body.appendChild(outsideButton)
      outsideButton.focus()

      focusTrap.activate()
      focusTrap.deactivate()

      expect(document.activeElement).toBe(outsideButton)
      
      document.body.removeChild(outsideButton)
    })

    it('should not deactivate if not active', () => {
      const focusTrap = new FocusTrap({ container })

      focusTrap.deactivate()

      expect(focusTrap.active).toBe(false)
    })
  })

  describe('keyboard navigation', () => {
    let focusTrap: FocusTrap

    beforeEach(() => {
      focusTrap = new FocusTrap({ container })
      focusTrap.activate()
    })

    afterEach(() => {
      focusTrap.deactivate()
    })

    it('should move focus forward with Tab key', () => {
      button1.focus()

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' })
      container.dispatchEvent(tabEvent)

      expect(document.activeElement).toBe(input)
    })

    it('should move focus backward with Shift+Tab', () => {
      input.focus()

      const shiftTabEvent = new KeyboardEvent('keydown', { 
        key: 'Tab', 
        shiftKey: true 
      })
      container.dispatchEvent(shiftTabEvent)

      expect(document.activeElement).toBe(button1)
    })

    it('should wrap to last element when Tab is pressed on last element', () => {
      button2.focus()

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' })
      container.dispatchEvent(tabEvent)

      expect(document.activeElement).toBe(button1)
    })

    it('should wrap to first element when Shift+Tab is pressed on first element', () => {
      button1.focus()

      const shiftTabEvent = new KeyboardEvent('keydown', { 
        key: 'Tab', 
        shiftKey: true 
      })
      container.dispatchEvent(shiftTabEvent)

      expect(document.activeElement).toBe(button2)
    })

    it('should not handle non-Tab keys', () => {
      button1.focus()

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      container.dispatchEvent(enterEvent)

      expect(document.activeElement).toBe(button1)
    })

    it('should focus first element if current focus is not in trap', () => {
      // Focus an element outside the container
      const outsideButton = document.createElement('button')
      document.body.appendChild(outsideButton)
      outsideButton.focus()

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' })
      container.dispatchEvent(tabEvent)

      expect(document.activeElement).toBe(button1)
      
      document.body.removeChild(outsideButton)
    })
  })

  describe('getFocusableElements', () => {
    it('should return only visible and enabled focusable elements', () => {
      const focusTrap = new FocusTrap({ container })
      const focusableElements = focusTrap['getFocusableElements']()

      expect(focusableElements).toContain(button1)
      expect(focusableElements).toContain(button2)
      expect(focusableElements).toContain(input)
      expect(focusableElements).not.toContain(hiddenButton)
      expect(focusableElements).not.toContain(disabledButton)
    })

    it('should use custom focusable selector', () => {
      const focusTrap = new FocusTrap({ 
        container, 
        focusableSelector: 'button' 
      })
      const focusableElements = focusTrap['getFocusableElements']()

      expect(focusableElements).toContain(button1)
      expect(focusableElements).toContain(button2)
      expect(focusableElements).not.toContain(input)
    })
  })

  describe('updateFocusableElements', () => {
    it('should update focus when content changes', () => {
      const focusTrap = new FocusTrap({ container })
      focusTrap.activate()
      
      // Focus an element that will be removed
      button1.focus()
      
      // Remove the focused element
      container.removeChild(button1)
      
      // Update focusable elements
      focusTrap.updateFocusableElements()
      
      // Should focus the first remaining element
      expect(document.activeElement).toBe(input)
    })
  })
})

describe('createFocusTrap', () => {
  it('should create a new FocusTrap instance', () => {
    const container = document.createElement('div')
    const focusTrap = createFocusTrap({ container })

    expect(focusTrap).toBeInstanceOf(FocusTrap)
  })
})

describe('useFocusTrap', () => {
  it('should create a new FocusTrap instance with container', () => {
    const container = document.createElement('div')
    const focusTrap = createFocusTrap({ container })

    expect(focusTrap).toBeInstanceOf(FocusTrap)
  })
})

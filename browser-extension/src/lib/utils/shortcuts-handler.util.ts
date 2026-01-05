import { scroller } from "./scroller.util"
import { findMode } from "./find-mode.util"
import { createLogger } from "./logger.util"
import { BrowserAPI } from "../../background/utils/browser-api"
import { modalStore } from "../stores/modal.store"

const logger = createLogger("[ShortcutsHandler]")

export interface ShortcutsMode {
  name: string
  isActive: boolean
  onKeyDown: (event: KeyboardEvent) => boolean
  onExit: () => void
}

class ShortcutsHandler {
  private currentMode: ShortcutsMode | null = null
  private isEnabled = true
  private keyBuffer: string[] = []
  private keyBufferTimeout: ReturnType<typeof setTimeout> | null = null
  private helpDialog: any = null

  private readonly keyMappings: Record<string, () => void> = {
    'h': () => { void scroller.scrollLeft(100, { smooth: true }) },
    'j': () => { void scroller.scrollDown(100, { smooth: true }) },
    'k': () => { void scroller.scrollUp(100, { smooth: true }) },
    'l': () => { void scroller.scrollRight(100, { smooth: true }) },
    'gg': () => { void scroller.scrollToTop({ smooth: true }) },
    'G': () => { void scroller.scrollToBottom({ smooth: true }) },
    'd': () => { void scroller.scrollPageDown({ smooth: true }) },
    'u': () => { void scroller.scrollPageUp({ smooth: true }) },
    '/': () => this.enterFindMode(),
    'n': () => this.findNext(),
    'N': () => this.findPrevious(),
    'H': () => { globalThis.history.back() },
    'L': () => { globalThis.history.forward() },
    'J': () => { void this.previousTab() },
    'K': () => { void this.nextTab() },
    't': () => { this.openCommandPalette() },
    'x': () => { void this.closeTab() },
    'X': () => { void this.restoreTab() },
    'r': () => { globalThis.location.reload() },
    '?': () => { this.showHelp() },
    'Escape': () => { this.exitCurrentMode() }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (!enabled) {
      this.exitCurrentMode()
    }
  }

  isShortcutsEnabled(): boolean {
    return this.isEnabled
  }

  setHelpDialog(helpDialog: any): void {
    this.helpDialog = helpDialog
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.isEnabled) return false

    if (this.isCommandPaletteOpen()) {
      return false
    }

    if (this.isInputElement(event.target as HTMLElement)) {
      return false
    }

    if (event.key === 'Escape') {
      this.exitCurrentMode()
      modalStore.closeModal()
      return true
    }

    if (this.currentMode?.isActive) {
      const handled = this.currentMode.onKeyDown(event)
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
        return true
      }
    }

    return this.handleNormalMode(event)
  }

  private handleNormalMode(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase()
    this.addToKeyBuffer(key)
    
    const exactMatch = this.keyMappings[key]
    if (exactMatch) {
      event.preventDefault()
      event.stopPropagation()
      exactMatch()
      this.clearKeyBuffer()
      return true
    }

    const sequence = this.keyBuffer.join('')
    const sequenceMatch = this.keyMappings[sequence]
    if (sequenceMatch) {
      event.preventDefault()
      event.stopPropagation()
      sequenceMatch()
      this.clearKeyBuffer()
      return true
    }

    this.scheduleKeyBufferClear()
    return false
  }

  private addToKeyBuffer(key: string): void {
    this.keyBuffer.push(key)
    if (this.keyBuffer.length > 3) {
      this.keyBuffer.shift()
    }
  }

  private clearKeyBuffer(): void {
    this.keyBuffer = []
    if (this.keyBufferTimeout) {
      clearTimeout(this.keyBufferTimeout)
      this.keyBufferTimeout = null
    }
  }

  private scheduleKeyBufferClear(): void {
    if (this.keyBufferTimeout) {
      clearTimeout(this.keyBufferTimeout)
    }
    this.keyBufferTimeout = globalThis.setTimeout(() => {
      this.clearKeyBuffer()
    }, 1000)
  }

  private isCommandPaletteOpen(): boolean {
    const commandPalette = document.querySelector('[data-modal="command-palette"]')
    return commandPalette !== null && commandPalette.offsetParent !== null
  }

  private isInputElement(element: HTMLElement): boolean {
    if (!element) return false
    const tagName = element.tagName.toLowerCase()
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      element.isContentEditable ||
      !!element.closest('input') ||
      !!element.closest('textarea') ||
      !!element.closest('[contenteditable="true"]') ||
      !!element.closest('[contenteditable=""]')
    )
  }

  private enterFindMode(): void {
    const query = globalThis.getSelection()?.toString().trim() || ''
    const result = findMode.startFind(query, { caseSensitive: false })
    
    this.currentMode = {
      name: 'find',
      isActive: true,
      onKeyDown: (event) => {
        if (event.key === 'Escape') {
          this.exitCurrentMode()
          return true
        }
        if (event.key === 'Enter') {
          findMode.exit()
          this.exitCurrentMode()
          return true
        }
        if (event.key.length === 1) {
          const newQuery = findMode.getCurrentResult().query + event.key
          findMode.updateQuery(newQuery)
          return true
        }
        return false
      },
      onExit: () => {
        findMode.exit()
      }
    }
    logger.debug('Entered find mode', { query, result })
  }

  private findNext(): void {
    if (findMode.isFindModeActive()) {
      const result = findMode.findNext()
      logger.debug('Find next', result)
    }
  }

  private findPrevious(): void {
    if (findMode.isFindModeActive()) {
      const result = findMode.findPrevious()
      logger.debug('Find previous', result)
    }
  }

  private showHelp(): void {
    if (this.helpDialog) {
      this.helpDialog.show()
    } else {
      logger.warn('Help dialog not available')
    }
  }

  private async previousTab(): Promise<void> {
    try {
      const response = await BrowserAPI.runtime.sendMessage({ type: 'PREVIOUS_TAB' })
      if (!response?.success) {
        logger.error('Failed to switch to previous tab', response?.error)
      }
    } catch (error) {
      logger.error('Error switching to previous tab', error)
    }
  }

  private async nextTab(): Promise<void> {
    try {
      const response = await BrowserAPI.runtime.sendMessage({ type: 'NEXT_TAB' })
      if (!response?.success) {
        logger.error('Failed to switch to next tab', response?.error)
      }
    } catch (error) {
      logger.error('Error switching to next tab', error)
    }
  }

  private openCommandPalette(): void {
    const position = {
      x: globalThis.innerWidth / 2,
      y: globalThis.innerHeight / 3
    }
    logger.debug('Shortcuts handler: Opening command palette')
    modalStore.toggleCommandPalette(position)
    logger.debug('Shortcuts handler: Command palette opened')
  }

  private async closeTab(): Promise<void> {
    try {
      const response = await BrowserAPI.runtime.sendMessage({ type: 'CLOSE_TAB' })
      if (!response?.success) {
        logger.error('Failed to close tab', response?.error)
      }
    } catch (error) {
      logger.error('Error closing tab', error)
    }
  }

  private async restoreTab(): Promise<void> {
    try {
      const response = await BrowserAPI.runtime.sendMessage({ type: 'RESTORE_TAB' })
      if (!response?.success) {
        logger.error('Failed to restore tab', response?.error)
      }
    } catch (error) {
      logger.error('Error restoring tab', error)
    }
  }

  private exitCurrentMode(): void {
    if (this.currentMode) {
      this.currentMode.onExit()
      this.currentMode = null
      logger.debug('Exited current mode')
    }
  }

  getCurrentMode(): ShortcutsMode | null {
    return this.currentMode
  }

  isModeActive(modeName: string): boolean {
    return this.currentMode?.name === modeName && this.currentMode?.isActive === true
  }

  destroy(): void {
    this.clearKeyBuffer()
    this.exitCurrentMode()
  }
}

export const shortcutsHandler = new ShortcutsHandler()

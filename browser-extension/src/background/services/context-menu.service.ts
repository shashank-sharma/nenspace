/**
 * Context Menu Service
 * 
 * Manages context menu registration and handlers for quick access
 * to extension features from right-click menus.
 */

import { createLogger } from '../utils/logger'

const logger = createLogger('[ContextMenuService]')

export interface ContextMenuAction {
  id: string
  title: string
  contexts: chrome.contextMenus.ContextType[]
  documentUrlPatterns?: string[]
  onclick?: (info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) => void
}

export interface ContextMenuHandler {
  id: string
  handler: (info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) => void
}

class ContextMenuService {
  private isInitialized = false
  private handlers = new Map<string, ContextMenuHandler>()

  constructor() {
    this.setupClickHandler()
  }

  /**
   * Initialize context menus
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Context menu service already initialized')
      return
    }

    try {
      // Clear existing menus
      await this.clearAllMenus()

      // Register context menu items
      await this.registerMenus()

      this.isInitialized = true
      logger.info('Context menu service initialized')
    } catch (error) {
      logger.error('Failed to initialize context menu service', error)
      throw error
    }
  }

  /**
   * Register all context menu items
   */
  private async registerMenus(): Promise<void> {
    const menuActions: ContextMenuAction[] = [
      {
        id: 'nenspace-bookmark',
        title: 'Save as Bookmark',
        contexts: ['link', 'page'],
        documentUrlPatterns: ['http://*/*', 'https://*/*'],
        onclick: (info, tab) => this.handleBookmark(info, tab)
      },
      {
        id: 'nenspace-task',
        title: 'Create Task from Selection',
        contexts: ['selection'],
        onclick: (info, tab) => this.handleTask(info, tab)
      },
      {
        id: 'nenspace-search',
        title: 'Search in Nenspace',
        contexts: ['selection'],
        onclick: (info, tab) => this.handleSearch(info, tab)
      },
      {
        id: 'nenspace-note',
        title: 'Quick Note',
        contexts: ['page'],
        onclick: (info, tab) => this.handleNote(info, tab)
      },
      {
        id: 'nenspace-separator-1',
        title: '---',
        contexts: ['page'],
        onclick: () => {} // Separator
      },
      {
        id: 'nenspace-sync',
        title: 'Sync Now',
        contexts: ['page'],
        onclick: (info, tab) => this.handleSync(info, tab)
      }
    ]

    // Register each menu item
    for (const action of menuActions) {
      await this.createMenuItem(action)
    }
  }

  /**
   * Create a single context menu item
   */
  private async createMenuItem(action: ContextMenuAction): Promise<void> {
    return new Promise((resolve, reject) => {
      const menuOptions: chrome.contextMenus.CreateProperties = {
        id: action.id,
        title: action.title,
        contexts: action.contexts,
        documentUrlPatterns: action.documentUrlPatterns,
        onclick: action.onclick
      }

      chrome.contextMenus.create(menuOptions, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          logger.debug('Context menu item created', { id: action.id, title: action.title })
          resolve()
        }
      })
    })
  }

  /**
   * Setup click handler for context menus
   */
  private setupClickHandler(): void {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab)
    })
  }

  /**
   * Handle context menu clicks
   */
  private async handleContextMenuClick(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab): Promise<void> {
    try {
      logger.debug('Context menu clicked', { menuItemId: info.menuItemId, info, tab })

      switch (info.menuItemId) {
        case 'nenspace-bookmark':
          await this.handleBookmark(info, tab)
          break
        case 'nenspace-task':
          await this.handleTask(info, tab)
          break
        case 'nenspace-search':
          await this.handleSearch(info, tab)
          break
        case 'nenspace-note':
          await this.handleNote(info, tab)
          break
        case 'nenspace-sync':
          await this.handleSync(info, tab)
          break
        default:
          logger.warn('Unknown context menu item clicked', { menuItemId: info.menuItemId })
      }
    } catch (error) {
      logger.error('Failed to handle context menu click', error)
    }
  }

  /**
   * Handle bookmark creation
   */
  private async handleBookmark(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab): Promise<void> {
    try {
      const url = info.linkUrl || tab.url
      const title = info.linkText || tab.title || 'Untitled'

      if (!url) {
        logger.warn('No URL available for bookmark')
        return
      }

      // Send message to content script to open bookmark modal
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'OPEN_BOOKMARK_MODAL',
          data: {
            url,
            title,
            description: info.selectionText || ''
          }
        })
      }

      logger.debug('Bookmark context menu handled', { url, title })
    } catch (error) {
      logger.error('Failed to handle bookmark context menu', error)
    }
  }

  /**
   * Handle task creation from selection
   */
  private async handleTask(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab): Promise<void> {
    try {
      const text = info.selectionText
      if (!text) {
        logger.warn('No text selected for task creation')
        return
      }

      // Send message to content script to open task modal
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'OPEN_TASK_MODAL',
          data: {
            title: text.substring(0, 100), // Limit title length
            description: text,
            url: tab.url
          }
        })
      }

      logger.debug('Task context menu handled', { text: text.substring(0, 50) })
    } catch (error) {
      logger.error('Failed to handle task context menu', error)
    }
  }

  /**
   * Handle search in Nenspace
   */
  private async handleSearch(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab): Promise<void> {
    try {
      const query = info.selectionText
      if (!query) {
        logger.warn('No text selected for search')
        return
      }

      // Send message to content script to open search
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'OPEN_SEARCH',
          data: { query }
        })
      }

      logger.debug('Search context menu handled', { query })
    } catch (error) {
      logger.error('Failed to handle search context menu', error)
    }
  }

  /**
   * Handle quick note creation
   */
  private async handleNote(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab): Promise<void> {
    try {
      // Send message to content script to open note modal
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'OPEN_NOTE_MODAL',
          data: {
            url: tab.url,
            title: tab.title || 'Untitled'
          }
        })
      }

      logger.debug('Note context menu handled')
    } catch (error) {
      logger.error('Failed to handle note context menu', error)
    }
  }

  /**
   * Handle sync now action
   */
  private async handleSync(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab): Promise<void> {
    try {
      // Send message to background to trigger sync
      chrome.runtime.sendMessage({
        type: 'TRIGGER_SYNC',
        data: { source: 'context_menu' }
      })

      logger.debug('Sync context menu handled')
    } catch (error) {
      logger.error('Failed to handle sync context menu', error)
    }
  }

  /**
   * Clear all context menus
   */
  private async clearAllMenus(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          logger.debug('All context menus cleared')
          resolve()
        }
      })
    })
  }

  /**
   * Update context menu visibility based on permissions
   */
  async updateMenuVisibility(): Promise<void> {
    try {
      // This could be used to show/hide menus based on user permissions
      // or authentication status
      logger.debug('Context menu visibility updated')
    } catch (error) {
      logger.error('Failed to update context menu visibility', error)
    }
  }

  /**
   * Cleanup on service destruction
   */
  async cleanup(): Promise<void> {
    try {
      await this.clearAllMenus()
      this.handlers.clear()
      this.isInitialized = false
      logger.debug('Context menu service cleaned up')
    } catch (error) {
      logger.error('Failed to cleanup context menu service', error)
    }
  }
}

// Export singleton instance
export const contextMenuService = new ContextMenuService()

// Export types
export type { ContextMenuAction, ContextMenuHandler }

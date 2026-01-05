import type { TabInfo } from '../types'
import { createLogger } from '../../lib/utils/logger.util'
import { hasAPI } from '../../lib/utils/environment.util'

const logger = createLogger('[BrowserAPI]')

const browserAPI = (() => {
  if ((globalThis as any).browser !== undefined) {
    return (globalThis as any).browser
  }
  if (chrome !== undefined) {
    return chrome
  }
  throw new Error('No browser API available')
})()

export class BrowserAPIError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'BrowserAPIError'
  }
}

/**
 * Storage API abstraction
 */
export class StorageAPI {
  static async get<T>(keys: string | string[]): Promise<Record<string, T>> {
    return new Promise((resolve, reject) => {
      try {
        browserAPI.storage.local.get(keys, (result: Record<string, T>) => {
          if (browserAPI.runtime.lastError) {
            reject(new BrowserAPIError('Storage get failed', browserAPI.runtime.lastError))
          } else {
            resolve(result || {})
          }
        })
      } catch (error) {
        reject(new BrowserAPIError('Storage get failed', error))
      }
    })
  }

  static async set(items: Record<string, any>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        browserAPI.storage.local.set(items, () => {
          if (browserAPI.runtime.lastError) {
            reject(new BrowserAPIError('Storage set failed', browserAPI.runtime.lastError))
          } else {
            resolve()
          }
        })
      } catch (error) {
        reject(new BrowserAPIError('Storage set failed', error))
      }
    })
  }

  static async remove(keys: string | string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        browserAPI.storage.local.remove(keys, () => {
          if (browserAPI.runtime.lastError) {
            reject(new BrowserAPIError('Storage remove failed', browserAPI.runtime.lastError))
          } else {
            resolve()
          }
        })
      } catch (error) {
        reject(new BrowserAPIError('Storage remove failed', error))
      }
    })
  }

  static onChanged(callback: (changes: Record<string, any>, areaName: string) => void): void {
    browserAPI.storage.onChanged.addListener(callback)
  }
}

/**
 * Tabs API abstraction
 */
export class TabsAPI {
  static async query(queryInfo?: chrome.tabs.QueryInfo): Promise<TabInfo[]> {
    try {
      if (!browserAPI.tabs) {
        throw new BrowserAPIError('Tabs API not available in this context')
      }
      const tabs = await browserAPI.tabs.query(queryInfo || {})
      return tabs.map((tab: chrome.tabs.Tab) => ({
        id: tab.id!,
        title: tab.title || 'Untitled',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl,
        windowId: tab.windowId!,
      }))
    } catch (error) {
      throw new BrowserAPIError('Tabs query failed', error)
    }
  }

  static async update(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<void> {
    try {
      if (!browserAPI.tabs) {
        throw new BrowserAPIError('Tabs API not available in this context')
      }
      await browserAPI.tabs.update(tabId, updateProperties)
    } catch (error) {
      throw new BrowserAPIError(`Failed to update tab ${tabId}`, error)
    }
  }

  static async create(createProperties: chrome.tabs.CreateProperties): Promise<void> {
    try {
      if (!browserAPI.tabs) {
        throw new BrowserAPIError('Tabs API not available in this context')
      }
      await browserAPI.tabs.create(createProperties)
    } catch (error) {
      throw new BrowserAPIError('Failed to create tab', error)
    }
  }

  static async get(tabId: number): Promise<chrome.tabs.Tab> {
    try {
      if (!browserAPI.tabs) {
        throw new BrowserAPIError('Tabs API not available in this context')
      }
      return await browserAPI.tabs.get(tabId)
    } catch (error) {
      throw new BrowserAPIError(`Failed to get tab ${tabId}`, error)
    }
  }

  static get onActivated() {
    if (!browserAPI.tabs) {
      throw new BrowserAPIError('Tabs API not available in this context')
    }
    return browserAPI.tabs.onActivated
  }
  
  static get onUpdated() {
    if (!browserAPI.tabs) {
      throw new BrowserAPIError('Tabs API not available in this context')
    }
    return browserAPI.tabs.onUpdated
  }
  
  static get onRemoved() {
    if (!browserAPI.tabs) {
      throw new BrowserAPIError('Tabs API not available in this context')
    }
    return browserAPI.tabs.onRemoved
  }
}

/**
 * Windows API abstraction
 */
export class WindowsAPI {
  static async update(windowId: number, updateInfo: chrome.windows.UpdateInfo): Promise<void> {
    try {
      if (!browserAPI.windows) {
        throw new BrowserAPIError('Windows API not available in this context')
      }
      await browserAPI.windows.update(windowId, updateInfo)
    } catch (error) {
      throw new BrowserAPIError(`Failed to update window ${windowId}`, error)
    }
  }

  static get onFocusChanged() {
    if (!browserAPI.windows) {
      throw new BrowserAPIError('Windows API not available in this context')
    }
    return browserAPI.windows.onFocusChanged
  }
}

/**
 * Alarms API abstraction
 */
export class AlarmsAPI {
  static async create(name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): Promise<void> {
    try {
      if (!browserAPI.alarms) {
        throw new BrowserAPIError('Alarms API not available')
      }
      await browserAPI.alarms.create(name, alarmInfo)
    } catch (error) {
      throw new BrowserAPIError(`Failed to create alarm ${name}`, error)
    }
  }

  static async clear(name?: string): Promise<boolean> {
    try {
      if (!browserAPI.alarms) {
        throw new BrowserAPIError('Alarms API not available')
      }
      return await browserAPI.alarms.clear(name)
    } catch (error) {
      throw new BrowserAPIError(`Failed to clear alarm ${name || 'all'}`, error)
    }
  }

  static get onAlarm() {
    if (!browserAPI.alarms) {
      return {
        addListener: () => {},
        removeListener: () => {},
        hasListener: () => false,
        hasListeners: () => false
      }
    }
    return browserAPI.alarms.onAlarm
  }
}


export class RuntimeAPI {
  static sendMessage<T = any>(message: any): Promise<T | undefined> {
    return new Promise((resolve) => {
      try {
        if (!hasAPI('chrome.runtime')) {
          logger.warn('Runtime API not available in this context')
          resolve(undefined)
          return
        }

        const promise = browserAPI.runtime.sendMessage(message)
        
        if (promise && typeof promise.then === 'function') {
          promise
            .then(resolve)
            .catch(() => resolve(undefined))
        } else {
          resolve(undefined)
        }
      } catch (error) {
        logger.debug('Runtime sendMessage failed', error)
        resolve(undefined)
      }
    })
  }


  static sendMessageToTabs(message: any): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (!browserAPI.tabs) {
          logger.warn('Tabs API not available in this context')
          resolve()
          return
        }
        browserAPI.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
          if (browserAPI.runtime.lastError) {
            logger.warn('Failed to query tabs for message broadcast', browserAPI.runtime.lastError)
            resolve()
            return
          }

          let sentCount = 0
          const totalTabs = tabs.length

          if (totalTabs === 0) {
            resolve()
            return
          }

          tabs.forEach((tab: chrome.tabs.Tab) => {
            if (tab.id) {
              browserAPI.tabs.sendMessage(tab.id, message, (_response: any) => {
                sentCount++
                if (sentCount === totalTabs) {
                  resolve()
                }
              })
            } else {
              sentCount++
              if (sentCount === totalTabs) {
                resolve()
              }
            }
          })
        })
      } catch (error) {
        logger.warn('Failed to send message to tabs', error)
        resolve()
      }
    })
  }

  static sendMessageToActiveTab(message: any): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (!browserAPI.tabs) {
          logger.warn('Tabs API not available in this context')
          resolve()
          return
        }
        
        logger.debug('[sendMessageToActiveTab] Querying for active tab', {
          messageType: message?.type,
          timestamp: Date.now()
        })
        
        browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
          const lastError = browserAPI.runtime?.lastError
          if (lastError) {
            logger.warn('[sendMessageToActiveTab] Failed to query active tab', {
              error: lastError.message || lastError,
              messageType: message?.type
            })
            resolve()
            return
          }

          if (!tabs || tabs.length === 0) {
            logger.debug('[sendMessageToActiveTab] No active tab found', {
              messageType: message?.type,
              reason: 'No tabs match query'
            })
            resolve()
            return
          }

          const activeTab = tabs[0]
          if (!activeTab?.id) {
            logger.warn('[sendMessageToActiveTab] Active tab has no ID', {
              tab: activeTab,
              messageType: message?.type
            })
            resolve()
            return
          }

          logger.info('[sendMessageToActiveTab] Sending to active tab', {
            tabId: activeTab.id,
            tabUrl: activeTab.url?.substring(0, 50) || 'unknown',
            tabTitle: activeTab.title?.substring(0, 30) || 'unknown',
            messageType: message?.type,
            totalTabsFound: tabs.length
          })

          browserAPI.tabs.sendMessage(activeTab.id, message, (_response: any) => {
            const sendError = browserAPI.runtime?.lastError
            if (sendError) {
              logger.warn('[sendMessageToActiveTab] Message not delivered', { 
                tabId: activeTab.id,
                reason: sendError.message || sendError,
                messageType: message?.type
              })
            } else {
              logger.info('[sendMessageToActiveTab] Message delivered successfully', {
                tabId: activeTab.id,
                messageType: message?.type
              })
            }
            resolve()
          })
        })
      } catch (error) {
        logger.error('[sendMessageToActiveTab] Exception occurred', {
          error: error instanceof Error ? error.message : error,
          messageType: message?.type
        })
        resolve()
      }
    })
  }

  static onMessage(
    callback: (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => boolean | void
  ): void {
    browserAPI.runtime.onMessage.addListener(callback)
  }

  static onInstalled(callback: (details: chrome.runtime.InstalledDetails) => void): void {
    browserAPI.runtime.onInstalled.addListener(callback)
  }

  static getURL(path: string): string {
    try {
      return browserAPI.runtime.getURL(path)
    } catch (error) {
      logger.warn('Failed to get URL, using fallback', error)
      return `chrome-extension://${chrome.runtime?.id || 'dev'}/${path}`
    }
  }
}

export const BrowserAPI = {
  storage: StorageAPI,
  tabs: TabsAPI,
  windows: WindowsAPI,
  alarms: AlarmsAPI,
  runtime: RuntimeAPI,
}


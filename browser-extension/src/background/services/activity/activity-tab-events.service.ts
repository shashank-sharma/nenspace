import { createLogger } from '../../utils/logger'
import { BackgroundConfig } from '../../config'
import type { ActivityHeartbeatService } from './activity-heartbeat.service'
import { BrowserAPI } from '../../utils/browser-api'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.ACTIVITY + ':TabEvents')

export interface TabEventsOptions {
  heartbeatService: ActivityHeartbeatService
  finalizeActivity: (activityId: string) => Promise<void>
  getCurrentActivity: () => { tab_id?: number, id?: string } | null
}

export class ActivityTabEventsService {
  private boundHandleTabActivated = this.handleTabActivated.bind(this)
  private boundHandleTabUpdated = this.handleTabUpdated.bind(this)
  private boundHandleTabRemoved = this.handleTabRemoved.bind(this)
  private boundHandleWindowFocusChanged = this.handleWindowFocusChanged.bind(this)

  constructor(private options: TabEventsOptions) {}

  setupEventListeners(): void {
    BrowserAPI.tabs.onActivated.addListener(this.boundHandleTabActivated)
    BrowserAPI.tabs.onUpdated.addListener(this.boundHandleTabUpdated)
    BrowserAPI.tabs.onRemoved.addListener(this.boundHandleTabRemoved)
    BrowserAPI.windows.onFocusChanged.addListener(this.boundHandleWindowFocusChanged)
  }

  removeEventListeners(): void {
    BrowserAPI.tabs.onActivated.removeListener(this.boundHandleTabActivated)
    BrowserAPI.tabs.onUpdated.removeListener(this.boundHandleTabUpdated)
    BrowserAPI.tabs.onRemoved.removeListener(this.boundHandleTabRemoved)
    BrowserAPI.windows.onFocusChanged.removeListener(this.boundHandleWindowFocusChanged)
  }

  private async handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): Promise<void> {
    try {
      const tab = await BrowserAPI.tabs.get(activeInfo.tabId)
      if (tab) {
        await this.options.heartbeatService.sendHeartbeat(tab)
      }
    } catch (error) {
      logger.error('Failed to handle tab activation', error)
    }
  }

  private async handleTabUpdated(
    _tabId: number, 
    changeInfo: chrome.tabs.TabChangeInfo, 
    tab: chrome.tabs.Tab
  ): Promise<void> {
    if (!tab.active) return

    if (changeInfo.url || changeInfo.title) {
      try {
        await this.options.heartbeatService.sendHeartbeat(tab)
      } catch (error) {
        logger.error('Failed to handle tab update', error)
      }
    }
  }

  private async handleTabRemoved(tabId: number): Promise<void> {
    try {
      const currentActivity = this.options.getCurrentActivity()
      if (currentActivity?.tab_id === tabId && currentActivity.id) {
        await this.options.finalizeActivity(currentActivity.id)
      }
    } catch (error) {
      logger.error('Failed to handle tab removal', error)
    }
  }

  private async handleWindowFocusChanged(_windowId: number): Promise<void> {
    try {
      const activeTab = await this.getActiveTab()
      if (activeTab) {
        await this.options.heartbeatService.sendHeartbeat(activeTab)
      }
    } catch (error) {
      logger.error('Failed to handle window focus change', error)
    }
  }

  private async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    try {
      const tabs = await new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
          else resolve(tabs)
        })
      })
      if (tabs.length > 0) return tabs[0]

      const allTabs = await new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
        chrome.tabs.query({ active: true }, (tabs) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
          else resolve(tabs)
        })
      })
      return allTabs.length > 0 ? allTabs[0] : null
    } catch (error) {
      logger.error('Failed to get active tab', error)
      return null
    }
  }
}


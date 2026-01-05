/**
 * Extension Install/Update Handler
 */

import { BrowserAPI } from '../utils/browser-api'
import { createLogger } from '../utils/logger'
import { BackgroundConfig } from '../config'

const logger = createLogger(BackgroundConfig.LOG_PREFIX.BACKGROUND)

/**
 * Handle extension installation and updates
 */
export function handleInstall(details: chrome.runtime.InstalledDetails): void {
  logger.info('Extension installed/updated', { reason: details.reason })
  
  if (details.reason === 'install') {
    // Open welcome page on first install
    BrowserAPI.tabs.create({ 
      url: BrowserAPI.runtime.getURL('popup.html')
    }).catch(error => {
      logger.error('Failed to open welcome page', error)
    })
  }
}


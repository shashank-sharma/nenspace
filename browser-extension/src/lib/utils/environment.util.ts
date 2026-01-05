/**
 * Environment Detection Utilities
 * 
 * Provides environment detection helpers similar to Plasmo constants
 * for better development experience and consistent environment handling.
 */

/**
 * Check if running in development mode
 */
export function isDev(): boolean {
  return process.env.NODE_ENV === 'development' || 
         process.env.NODE_ENV === 'dev' ||
         process.env.PLASMO_TAG === 'dev'
}

/**
 * Check if running in production mode
 */
export function isProd(): boolean {
  return process.env.NODE_ENV === 'production' || 
         process.env.NODE_ENV === 'prod' ||
         process.env.PLASMO_TAG === 'prod'
}

/**
 * Check if running in background script context
 */
export function isBackground(): boolean {
  // In Plasmo extensions, background scripts don't have a window object
  // but do have access to chrome.runtime
  if (typeof window !== 'undefined') {
    // We have a window, so we're not in the background
    return false
  }
  
  // No window and we have chrome.runtime - likely background
  return typeof chrome !== 'undefined' && 
         chrome.runtime !== undefined
}

/**
 * Check if running in content script context
 */
export function isContentScript(): boolean {
  return typeof globalThis.window !== 'undefined' && 
         globalThis.window !== globalThis.window.top
}

/**
 * Check if running in popup context
 */
export function isPopup(): boolean {
  return typeof globalThis.window !== 'undefined' && 
         globalThis.window.location && 
         globalThis.window.location.protocol === 'chrome-extension:'
}

/**
 * Check if running in options page context
 */
export function isOptionsPage(): boolean {
  return typeof globalThis.window !== 'undefined' && 
         globalThis.window.location && 
         globalThis.window.location.pathname.includes('options')
}

/**
 * Get the current environment context
 */
export function getContext(): 'background' | 'content' | 'popup' | 'options' | 'unknown' {
  if (isBackground()) return 'background'
  if (isContentScript()) return 'content'
  if (isPopup()) return 'popup'
  if (isOptionsPage()) return 'options'
  return 'unknown'
}

/**
 * Get URL for extension assets (replaces chrome.runtime.getURL)
 */
export function getUrl(path: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    return chrome.runtime.getURL(path)
  }
  
  // Fallback for development or when chrome.runtime is not available
  if (isDev()) {
    return `chrome-extension://${chrome.runtime?.id || 'dev'}/${path}`
  }
  
  throw new Error('chrome.runtime.getURL is not available')
}

/**
 * Get the current browser type
 */
export function getBrowserType(): 'chrome' | 'firefox' | 'edge' | 'unknown' {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    const manifest = chrome.runtime.getManifest()
    if (manifest) {
      if (manifest.manifest_version === 3) return 'chrome'
      if (manifest.manifest_version === 2) return 'firefox'
    }
  }
  
  if (typeof (globalThis as any).browser !== 'undefined') {
    return 'firefox'
  }
  
  return 'unknown'
}

/**
 * Check if a specific API is available
 */
export function hasAPI(apiName: string): boolean {
  try {
    const api = apiName.split('.').reduce((obj, key) => obj?.[key], globalThis as any)
    return api !== undefined
  } catch {
    return false
  }
}

/**
 * Get environment information for debugging
 */
export function getEnvironmentInfo(): Record<string, any> {
  return {
    context: getContext(),
    browser: getBrowserType(),
    isDev: isDev(),
    isProd: isProd(),
    isBackground: isBackground(),
    isContentScript: isContentScript(),
    isPopup: isPopup(),
    isOptionsPage: isOptionsPage(),
    nodeEnv: process.env.NODE_ENV,
    plasmoTag: process.env.PLASMO_TAG,
    hasChrome: hasAPI('chrome'),
    hasBrowser: hasAPI('browser'),
    hasRuntime: hasAPI('chrome.runtime'),
    hasStorage: hasAPI('chrome.storage'),
    hasTabs: hasAPI('chrome.tabs'),
    hasNotifications: hasAPI('chrome.notifications'),
    hasContextMenus: hasAPI('chrome.contextMenus')
  }
}

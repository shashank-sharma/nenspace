/**
 * Context Menu Search Handler
 * 
 * Handles search actions from context menu selections.
 */

import { createLogger } from '../utils/logger'
import { sendToBackground } from '~lib/utils/api.util'

const logger = createLogger('[ContextMenuSearch]')

export interface SearchData {
  query: string
  context?: string
  url?: string
}

export interface SearchResponse {
  success: boolean
  results?: any[]
  error?: string
}

/**
 * Handle search from context menu
 */
export async function handleSearch(data: SearchData): Promise<SearchResponse> {
  try {
    logger.debug('Searching from context menu', { query: data.query })

    // Send message to background to perform search
    const response = await sendToBackground<SearchData, SearchResponse>({
      name: 'search-content',
      body: data
    })

    if (response?.success) {
      logger.debug('Search completed successfully', { resultCount: response.results?.length || 0 })
    } else {
      logger.error('Search failed', { error: response?.error })
    }

    return response || { success: false, error: 'No response from background' }
  } catch (error) {
    logger.error('Error searching from context menu', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Open search in new tab
 */
export async function openSearchInTab(query: string): Promise<void> {
  try {
    const searchUrl = `chrome-extension://${chrome.runtime.id}/popup.html?search=${encodeURIComponent(query)}`
    await chrome.tabs.create({ url: searchUrl })
    logger.debug('Search opened in new tab', { query })
  } catch (error) {
    logger.error('Failed to open search in new tab', error)
  }
}

/**
 * Validate search data
 */
export function validateSearchData(data: SearchData): { valid: boolean; error?: string } {
  if (!data.query || data.query.trim().length === 0) {
    return { valid: false, error: 'Search query is required' }
  }

  if (data.query.length > 500) {
    return { valid: false, error: 'Search query too long (max 500 characters)' }
  }

  return { valid: true }
}

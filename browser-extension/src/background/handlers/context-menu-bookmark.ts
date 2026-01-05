/**
 * Context Menu Bookmark Handler
 * 
 * Handles bookmark creation from context menu actions.
 */

import { createLogger } from '../utils/logger'
import { sendToBackground } from '~lib/utils/api.util'

const logger = createLogger('[ContextMenuBookmark]')

export interface BookmarkData {
  url: string
  title: string
  description?: string
  tags?: string[]
}

export interface BookmarkResponse {
  success: boolean
  bookmarkId?: string
  error?: string
}

/**
 * Handle bookmark creation from context menu
 */
export async function handleBookmarkCreation(data: BookmarkData): Promise<BookmarkResponse> {
  try {
    logger.debug('Creating bookmark from context menu', { url: data.url, title: data.title })

    // Send message to background to create bookmark
    const response = await sendToBackground<BookmarkData, BookmarkResponse>({
      name: 'create-bookmark',
      body: data
    })

    if (response?.success) {
      logger.debug('Bookmark created successfully', { bookmarkId: response.bookmarkId })
    } else {
      logger.error('Failed to create bookmark', { error: response?.error })
    }

    return response || { success: false, error: 'No response from background' }
  } catch (error) {
    logger.error('Error creating bookmark from context menu', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Validate bookmark data
 */
export function validateBookmarkData(data: BookmarkData): { valid: boolean; error?: string } {
  if (!data.url) {
    return { valid: false, error: 'URL is required' }
  }

  if (!data.title) {
    return { valid: false, error: 'Title is required' }
  }

  // Basic URL validation
  try {
    new URL(data.url)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  return { valid: true }
}

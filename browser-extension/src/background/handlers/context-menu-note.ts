/**
 * Context Menu Note Handler
 * 
 * Handles quick note creation from context menu actions.
 */

import { createLogger } from '../utils/logger'
import { sendToBackground } from '~lib/utils/api.util'

const logger = createLogger('[ContextMenuNote]')

export interface NoteData {
  title: string
  content?: string
  url?: string
  tags?: string[]
}

export interface NoteResponse {
  success: boolean
  noteId?: string
  error?: string
}

/**
 * Handle note creation from context menu
 */
export async function handleNoteCreation(data: NoteData): Promise<NoteResponse> {
  try {
    logger.debug('Creating note from context menu', { title: data.title })

    // Send message to background to create note
    const response = await sendToBackground<NoteData, NoteResponse>({
      name: 'create-note',
      body: data
    })

    if (response?.success) {
      logger.debug('Note created successfully', { noteId: response.noteId })
    } else {
      logger.error('Failed to create note', { error: response?.error })
    }

    return response || { success: false, error: 'No response from background' }
  } catch (error) {
    logger.error('Error creating note from context menu', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Open note editor in new tab
 */
export async function openNoteEditor(data: NoteData): Promise<void> {
  try {
    const noteUrl = `chrome-extension://${chrome.runtime.id}/popup.html?note=${encodeURIComponent(JSON.stringify(data))}`
    await chrome.tabs.create({ url: noteUrl })
    logger.debug('Note editor opened in new tab', { title: data.title })
  } catch (error) {
    logger.error('Failed to open note editor in new tab', error)
  }
}

/**
 * Validate note data
 */
export function validateNoteData(data: NoteData): { valid: boolean; error?: string } {
  if (!data.title || data.title.trim().length === 0) {
    return { valid: false, error: 'Title is required' }
  }

  if (data.title.length > 200) {
    return { valid: false, error: 'Title too long (max 200 characters)' }
  }

  if (data.content && data.content.length > 5000) {
    return { valid: false, error: 'Content too long (max 5000 characters)' }
  }

  if (data.url) {
    try {
      new URL(data.url)
    } catch {
      return { valid: false, error: 'Invalid URL format' }
    }
  }

  return { valid: true }
}

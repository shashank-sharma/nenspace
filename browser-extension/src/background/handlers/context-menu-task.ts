/**
 * Context Menu Task Handler
 * 
 * Handles task creation from context menu actions.
 */

import { createLogger } from '../utils/logger'
import { sendToBackground } from '~lib/utils/api.util'

const logger = createLogger('[ContextMenuTask]')

export interface TaskData {
  title: string
  description?: string
  url?: string
  priority?: 'low' | 'medium' | 'high'
  tags?: string[]
}

export interface TaskResponse {
  success: boolean
  taskId?: string
  error?: string
}

/**
 * Handle task creation from context menu
 */
export async function handleTaskCreation(data: TaskData): Promise<TaskResponse> {
  try {
    logger.debug('Creating task from context menu', { title: data.title })

    // Send message to background to create task
    const response = await sendToBackground<TaskData, TaskResponse>({
      name: 'create-task',
      body: data
    })

    if (response?.success) {
      logger.debug('Task created successfully', { taskId: response.taskId })
    } else {
      logger.error('Failed to create task', { error: response?.error })
    }

    return response || { success: false, error: 'No response from background' }
  } catch (error) {
    logger.error('Error creating task from context menu', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Validate task data
 */
export function validateTaskData(data: TaskData): { valid: boolean; error?: string } {
  if (!data.title || data.title.trim().length === 0) {
    return { valid: false, error: 'Title is required' }
  }

  if (data.title.length > 200) {
    return { valid: false, error: 'Title too long (max 200 characters)' }
  }

  if (data.description && data.description.length > 1000) {
    return { valid: false, error: 'Description too long (max 1000 characters)' }
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

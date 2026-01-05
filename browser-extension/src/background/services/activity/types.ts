/**
 * Shared types for activity tracking services
 */

import type { ActivityRecord } from '../../types'

// Types for sync API responses
export interface SyncResponse {
  success: boolean
  processed?: number
  created?: number
  updated?: number
  duplicates?: number
  checkpoint?: string
  failed_items?: FailedSyncItem[]
}

export interface FailedSyncItem {
  index: number
  error: string
  activity?: ActivityRecord
}


/**
 * History Sync Service
 * 
 * Frontend service for managing browser history sync using Plasmo messaging.
 */

import { sendToBackground } from '@plasmohq/messaging'
import { createLogger } from '../utils/logger.util'
import type { HistorySyncFullResponse, HistorySyncIncrementalResponse, HistoryGetStatusResponse } from '../types/messages'

const logger = createLogger('[HistorySyncService]')

export interface HistorySyncStatus {
  checkpoint: {
    lastSyncTime: Date | null
    lastVisitTime: Date | null
    totalSynced: number
    batchesSynced: number
    failedBatches: number
    isInitialSyncComplete: boolean
  }
  state: {
    syncInProgress: boolean
    currentBatch: number
    totalBatches: number
    itemsProcessed: number
    failedItems: number
  }
  syncStatus: {
    enabled: boolean
    running: boolean
    interval: number
    lastSync?: Date | string | null
    itemsQueued: number
    totalSynced?: number
  }
}

class HistorySyncServiceImpl {
  async syncFullHistory(options?: { maxDays?: number }): Promise<boolean> {
    try {
      const response = await sendToBackground<{}, HistorySyncFullResponse>({
        name: 'history-sync-full'
      })
      return response.success
    } catch (error) {
      logger.error('Failed to sync full history', error)
      return false
    }
  }

  async syncIncrementalHistory(): Promise<boolean> {
    try {
      const response = await sendToBackground<{}, HistorySyncIncrementalResponse>({
        name: 'history-sync-incremental'
      })
      return response.success
    } catch (error) {
      logger.error('Failed to sync incremental history', error)
      return false
    }
  }

  async getStatus(): Promise<HistorySyncStatus | null> {
    try {
      const response = await sendToBackground<{}, HistoryGetStatusResponse>({
        name: 'history-get-status'
      })
      if (response.success && response.status) {
        // Ensure syncStatus exists
        if (!response.status.syncStatus) {
          response.status.syncStatus = {
            enabled: false,
            running: response.status.state?.syncInProgress || false,
            interval: 300,
            lastSync: response.status.checkpoint?.lastSyncTime || null,
            itemsQueued: 0,
            totalSynced: response.status.checkpoint?.totalSynced || 0
          }
        }
        return response.status
      }
      return null
    } catch (error) {
      logger.error('Failed to get history sync status', error)
      return null
    }
  }
}

export const HistorySyncService = new HistorySyncServiceImpl()


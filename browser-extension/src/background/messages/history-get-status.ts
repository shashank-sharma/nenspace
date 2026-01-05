import type { PlasmoMessaging } from "@plasmohq/messaging"
import { createLogger } from "~background/utils/logger"
import type { HistoryGetStatusRequest, HistoryGetStatusResponse } from "~lib/types/messages"
import { getHistorySyncService } from "~background/services"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:HistoryGetStatus]')

const handler: PlasmoMessaging.MessageHandler<HistoryGetStatusRequest, HistoryGetStatusResponse> = async (req, res) => {
  logger.debug('Handling HISTORY_GET_STATUS message')
  
  try {
    const service = getHistorySyncService()
    const checkpoint = service.getCheckpoint()
    const state = service.getState()
    
    const status = {
      checkpoint,
      state,
      syncStatus: {
        enabled: false, // History sync doesn't have an enabled/disabled state currently
        running: state.syncInProgress,
        interval: 300, // Default interval for history sync
        lastSync: checkpoint.lastSyncTime,
        itemsQueued: 0, // History sync doesn't queue items like activity sync
        totalSynced: checkpoint.totalSynced
      }
    }
    
    res.send({ success: true, status })
  } catch (error) {
    logger.error('Failed to get history sync status', error)
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler

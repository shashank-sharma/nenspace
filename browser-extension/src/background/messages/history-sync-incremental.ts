import type { PlasmoMessaging } from "@plasmohq/messaging"
import { createLogger } from "~background/utils/logger"
import type { HistorySyncIncrementalRequest, HistorySyncIncrementalResponse } from "~lib/types/messages"
import { getHistorySyncService } from "~background/services"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:HistorySyncIncremental]')

const handler: PlasmoMessaging.MessageHandler<HistorySyncIncrementalRequest, HistorySyncIncrementalResponse> = async (req, res) => {
  logger.debug('Handling HISTORY_SYNC_INCREMENTAL message')
  
  try {
    await getHistorySyncService().syncIncrementalHistory()
    res.send({ success: true })
  } catch (error) {
    logger.error('Failed to start incremental history sync', error)
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler

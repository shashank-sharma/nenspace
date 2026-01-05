import type { PlasmoMessaging } from "@plasmohq/messaging"
import { createLogger } from "~background/utils/logger"
import type { HistorySyncFullRequest, HistorySyncFullResponse } from "~lib/types/messages"
import { getHistorySyncService } from "~background/services"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:HistorySyncFull]')

const handler: PlasmoMessaging.MessageHandler<HistorySyncFullRequest, HistorySyncFullResponse> = async (req, res) => {
  logger.debug('Handling HISTORY_SYNC_FULL message')
  
  try {
    await getHistorySyncService().syncFullHistory()
    res.send({ success: true })
  } catch (error) {
    logger.error('Failed to start full history sync', error)
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler

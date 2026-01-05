import type { PlasmoMessaging } from "@plasmohq/messaging"
import { BrowserAPI } from "~background/utils/browser-api"
import { createLogger } from "~background/utils/logger"
import type { RestoreTabRequest, RestoreTabResponse } from "~lib/types/messages"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:RestoreTab]')

const handler: PlasmoMessaging.MessageHandler<RestoreTabRequest, RestoreTabResponse> = async (req, res) => {
  logger.debug('Handling RESTORE_TAB message')
  
  try {
    // Note: Chrome doesn't provide a direct API to restore tabs
    // This would require maintaining a list of closed tabs
    // For now, we'll just open a new tab
    await BrowserAPI.tabs.create({})
    res.send({ success: true })
  } catch (error) {
    logger.error('Failed to restore tab', error)
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler











import type { PlasmoMessaging } from "@plasmohq/messaging"
import { BrowserAPI } from "~background/utils/browser-api"
import { createLogger } from "~background/utils/logger"
import type { NewTabRequest, NewTabResponse } from "~lib/types/messages"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:NewTab]')

const handler: PlasmoMessaging.MessageHandler<NewTabRequest, NewTabResponse> = async (req, res) => {
  logger.debug('Handling NEW_TAB message')
  
  try {
    await BrowserAPI.tabs.create({})
    res.send({ success: true })
  } catch (error) {
    logger.error('Failed to create new tab', error)
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler











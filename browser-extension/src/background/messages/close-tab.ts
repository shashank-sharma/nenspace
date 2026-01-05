import type { PlasmoMessaging } from "@plasmohq/messaging"
import { BrowserAPI } from "~background/utils/browser-api"
import { createLogger } from "~background/utils/logger"
import type { CloseTabRequest, CloseTabResponse } from "~lib/types/messages"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:CloseTab]')

const handler: PlasmoMessaging.MessageHandler<CloseTabRequest, CloseTabResponse> = async (req, res) => {
  logger.debug('Handling CLOSE_TAB message')
  
  try {
    const tabs = await BrowserAPI.tabs.query({ active: true, currentWindow: true })
    
    if (tabs.length === 0) {
      res.send({ success: false, error: 'No active tab found' })
      return
    }
    
    const activeTab = tabs[0]
    await BrowserAPI.tabs.remove(activeTab.id!)
    res.send({ success: true })
  } catch (error) {
    logger.error('Failed to close tab', error)
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler











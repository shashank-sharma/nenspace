import type { PlasmoMessaging } from "@plasmohq/messaging"
import { BrowserAPI } from "~background/utils/browser-api"
import { createLogger } from "~background/utils/logger"
import type { PreviousTabRequest, PreviousTabResponse } from "~lib/types/messages"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:PreviousTab]')

const handler: PlasmoMessaging.MessageHandler<PreviousTabRequest, PreviousTabResponse> = async (req, res) => {
  logger.debug('Handling PREVIOUS_TAB message')
  
  try {
    const tabs = await BrowserAPI.tabs.query({ currentWindow: true })
    
    if (tabs.length <= 1) {
      res.send({ success: false, error: 'No previous tab' })
      return
    }
    
    const currentTab = tabs.find(tab => tab.active)
    if (!currentTab) {
      res.send({ success: false, error: 'Current tab not found' })
      return
    }
    
    const currentIndex = tabs.indexOf(currentTab)
    const previousIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1
    const previousTab = tabs[previousIndex]
    
    await BrowserAPI.tabs.update(previousTab.id!, { active: true })
    res.send({ success: true })
  } catch (error) {
    logger.error('Failed to switch to previous tab', error)
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler











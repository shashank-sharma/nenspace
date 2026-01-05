/**
 * Get Tabs Message Handler (Plasmo Migration)
 * 
 * Type-safe message handler using @plasmohq/messaging.
 * Uses Plasmo's auto-discovery message handling system.
 */

import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { GetTabsRequest, GetTabsResponse } from "~lib/types/messages"
import { BrowserAPI } from "../utils/browser-api"
import { createLogger } from "../utils/logger"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[MessageHandler:GetTabs]')

const handler: PlasmoMessaging.MessageHandler<GetTabsRequest, GetTabsResponse> = async (req, res) => {
  logger.debug('Handling GET_TABS message')
  
  try {
    const tabs = await BrowserAPI.tabs.query()
    res.send({ success: true, tabs })
  } catch (error) {
    logger.error('Failed to query tabs', error)
    res.send({ 
      success: false, 
      error: getErrorMessage(error),
      tabs: []
    })
  }
}

export default handler



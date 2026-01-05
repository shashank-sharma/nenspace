/**
 * Switch Tab Message Handler (Plasmo Migration)
 * 
 * Type-safe message handler using @plasmohq/messaging.
 */

import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { SwitchTabRequest, SwitchTabResponse } from "~lib/types/messages"
import { BrowserAPI } from "../utils/browser-api"
import { createLogger } from "../utils/logger"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[MessageHandler:SwitchTab]')

const handler: PlasmoMessaging.MessageHandler<SwitchTabRequest, SwitchTabResponse> = async (req, res) => {
  // Extract tabId and windowId - check both req.body and req directly
  // Plasmo messaging may structure the request differently depending on version
  const body = req.body || req
  const { tabId, windowId } = body || {}
  
  logger.debug('Handling SWITCH_TAB message', { 
    tabId, 
    windowId, 
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    reqKeys: Object.keys(req)
  })
  
  // Validate with explicit type checks
  if (typeof tabId !== 'number' || tabId === null || tabId === undefined) {
    logger.error('Missing or invalid tabId', { 
      tabId, 
      tabIdType: typeof tabId,
      body: req.body,
      req: req
    })
    res.send({ success: false, error: 'Missing or invalid tabId' })
    return
  }
  
  if (typeof windowId !== 'number' || windowId === null || windowId === undefined) {
    logger.error('Missing or invalid windowId', { 
      windowId, 
      windowIdType: typeof windowId,
      body: req.body,
      req: req
    })
    res.send({ success: false, error: 'Missing or invalid windowId' })
    return
  }
  
  try {
    await Promise.all([
      BrowserAPI.tabs.update(tabId, { active: true }),
      BrowserAPI.windows.update(windowId, { focused: true })
    ])
    res.send({ success: true })
  } catch (error) {
    logger.error('Failed to switch tab', error)
    res.send({ 
      success: false, 
      error: getErrorMessage(error)
    })
  }
}

export default handler



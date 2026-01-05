/**
 * Get Health Status Message Handler (Plasmo Migration)
 * 
 * Type-safe message handler using @plasmohq/messaging.
 */

import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { GetHealthStatusRequest, GetHealthStatusResponse } from "~lib/types/messages"
import { createLogger } from "../utils/logger"
import { getHealthMonitor } from "~background/services"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[MessageHandler:GetHealthStatus]')

const handler: PlasmoMessaging.MessageHandler<GetHealthStatusRequest, GetHealthStatusResponse> = async (req, res) => {
  logger.debug('Handling GET_HEALTH_STATUS message')
  
  try {
    const health = getHealthMonitor().getStatus()
    res.send({ success: true, health })
  } catch (error) {
    logger.error('Failed to get health status', error)
    res.send({ 
      success: false, 
      error: getErrorMessage(error),
      health: {
        connected: false,
        error: getErrorMessage(error),
        lastChecked: null
      }
    })
  }
}

export default handler



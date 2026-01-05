import type { PlasmoMessaging } from "@plasmohq/messaging"
import { createLogger } from "~background/utils/logger"
import type { CheckHealthRequest, CheckHealthResponse } from "~lib/types/messages"
import { getHealthMonitor } from "~background/services"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:CheckHealth]')

const handler: PlasmoMessaging.MessageHandler<CheckHealthRequest, CheckHealthResponse> = async (req, res) => {
  logger.debug('Handling CHECK_HEALTH message')
  
  try {
    const healthMonitor = getHealthMonitor()
    await healthMonitor.checkHealth()
    const health = healthMonitor.getStatus()
    res.send({ success: true, health })
  } catch (error) {
    logger.error('Health check failed', error)
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler

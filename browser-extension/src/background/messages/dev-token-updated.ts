import type { PlasmoMessaging } from "@plasmohq/messaging"
import { createLogger } from "~background/utils/logger"
import type { DevTokenUpdatedRequest, DevTokenUpdatedResponse } from "~lib/types/messages"
import { getActivityTracker } from "~background/services"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:DevTokenUpdated]')

const handler: PlasmoMessaging.MessageHandler<DevTokenUpdatedRequest, DevTokenUpdatedResponse> = async (req, res) => {
  logger.info('Handling DEV_TOKEN_UPDATED message')
  
  try {
    // Reload authentication and dev token in activity tracker
    try {
      const tracker = getActivityTracker()
      await tracker.loadAuth()
      await tracker.loadDevToken()
      logger.info('Activity tracker authentication reloaded')
    } catch (trackerError) {
      logger.warn('ActivityTracker not available for auth reload', trackerError)
    }
    
    res.send({ success: true })
  } catch (error) {
    logger.error('Failed to handle dev token update', error)
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler


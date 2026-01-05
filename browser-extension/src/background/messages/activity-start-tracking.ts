import type { PlasmoMessaging } from "@plasmohq/messaging"
import { createLogger } from "~background/utils/logger"
import type { ActivityStartTrackingRequest, ActivityStartTrackingResponse } from "~lib/types/messages"
import { getActivityTracker } from "~background/services"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:ActivityStartTracking]')

const handler: PlasmoMessaging.MessageHandler<ActivityStartTrackingRequest, ActivityStartTrackingResponse> = async (req, res) => {
  logger.debug('Handling ACTIVITY_START_TRACKING message')
  
  try {
    await getActivityTracker().startTracking()
    res.send({ success: true })
  } catch (error) {
    logger.error('Failed to start activity tracking', error)
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler

import type { PlasmoMessaging } from "@plasmohq/messaging"
import { createLogger } from "~background/utils/logger"
import type { ActivityStopTrackingRequest, ActivityStopTrackingResponse } from "~lib/types/messages"
import { getActivityTracker } from "~background/services"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:ActivityStopTracking]')

const handler: PlasmoMessaging.MessageHandler<ActivityStopTrackingRequest, ActivityStopTrackingResponse> = async (req, res) => {
  logger.debug('Handling ACTIVITY_STOP_TRACKING message')
  
  try {
    await getActivityTracker().stopTracking()
    res.send({ success: true })
  } catch (error) {
    logger.error('Failed to stop activity tracking', error)
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler

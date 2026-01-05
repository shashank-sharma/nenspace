import type { PlasmoMessaging } from "@plasmohq/messaging"
import { createLogger } from "~background/utils/logger"
import type { ActivityUpdateSettingsRequest, ActivityUpdateSettingsResponse } from "~lib/types/messages"
import { getActivityTracker } from "~background/services"
import { settingsStorage } from "~lib/services/plasmo-storage.service"
import { getErrorMessage } from "~lib/utils/error-message.util"

const logger = createLogger('[Msg:ActivityUpdateSettings]')

const handler: PlasmoMessaging.MessageHandler<ActivityUpdateSettingsRequest, ActivityUpdateSettingsResponse> = async (req, res) => {
  logger.info('Handling ACTIVITY_UPDATE_SETTINGS message', { 
    requestBody: req.body,
    requestPayload: req.body?.payload
  })
  
  try {
    // Extract settings from request - handle both payload and direct body formats
    const settings = req.body?.payload?.settings || req.body?.settings
    
    if (!settings) {
      logger.error('No settings provided in request', { requestBody: req.body })
      res.send({ success: false, error: 'No settings provided' })
      return
    }
    
    logger.info('Extracted settings from request', { 
      settings,
      syncEnabled: settings.syncEnabled
    })
    
    // Always save to storage first (this is the source of truth)
    logger.info('Saving settings to storage first')
    const currentSettingsResult = await settingsStorage.getActivitySettings()
    const currentSettings = currentSettingsResult.success ? currentSettingsResult.data : {}
    const updatedSettings = { ...currentSettings, ...settings }
    await settingsStorage.saveActivitySettings(updatedSettings)
    logger.info('Settings saved to storage successfully', { updatedSettings })
    
    logger.info('Sending success response to frontend immediately')
    // Send response BEFORE updating activityTracker to avoid "out of scope" error
    res.send({ success: true })
    
    // Update activityTracker async after response is sent (non-blocking)
    // This prevents the "Promised response from onMessage listener went out of scope" error
    try {
      const tracker = getActivityTracker()
      if (typeof tracker.updateSettings === 'function') {
        // Fire and forget - don't await this
        tracker.updateSettings(settings).then(() => {
          logger.info('ActivityTracker updated successfully in background')
        }).catch(error => {
          logger.error('Failed to update ActivityTracker (settings already saved to storage)', error)
        })
      }
    } catch (trackerError) {
      logger.warn('ActivityTracker not available for updates', trackerError)
    }
  } catch (error) {
    logger.error('Failed to update activity settings', {
      error: getErrorMessage(error)
    })
    res.send({ success: false, error: getErrorMessage(error) })
  }
}

export default handler

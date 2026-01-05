/**
 * Background Script Configuration
 * Centralized configuration for the background service worker
 * Now uses environment utilities for better detection
 */

import { ENV_CONFIG } from '~lib/constants/api-endpoints'
import { isDev, getContext } from '~lib/utils/environment.util'

export const BackgroundConfig = {
  // Health monitoring (using environment variables)
  HEALTH_CHECK_INTERVAL_MS: ENV_CONFIG.HEALTH_CHECK_INTERVAL,
  HEALTH_CHECK_TIMEOUT_MS: 5000, // 5 seconds
  
  // Realtime connection (using environment variables)
  REALTIME_MAX_RECONNECT_ATTEMPTS: ENV_CONFIG.REALTIME_MAX_RETRIES,
  REALTIME_CONNECTION_TIMEOUT_MS: ENV_CONFIG.API_TIMEOUT,
  REALTIME_MAX_RETRY_ATTEMPTS: 3,
  REALTIME_RETRY_COOLDOWN_MS: 60000, // 1 minute
  
  // Notification defaults
  DEFAULT_NOTIFICATION_DURATION_MS: 3000,
  
  // Feature flags (enhanced with environment detection)
  ENABLE_DEBUG_MODE: ENV_CONFIG.ENABLE_DEBUG_MODE || isDev(),
  ENABLE_ANALYTICS: ENV_CONFIG.ENABLE_ANALYTICS,
  ENABLE_REALTIME: ENV_CONFIG.ENABLE_REALTIME,
  
  // Environment info
  IS_DEVELOPMENT: isDev(),
  CONTEXT: getContext(),
  
  // App info
  APP_NAME: ENV_CONFIG.APP_NAME,
  VERSION: ENV_CONFIG.VERSION,
  DEFAULT_BACKEND_URL: ENV_CONFIG.DEFAULT_BACKEND_URL,
  
  // Logging
  LOG_PREFIX: {
    BACKGROUND: '[Background]',
    REALTIME: '[Background:Realtime]',
    HEALTH: '[Background:Health]',
    MESSAGE: '[Background:Message]',
    ACTIVITY: '[Background:Activity]',
  }
} as const

export type BackgroundConfigType = typeof BackgroundConfig


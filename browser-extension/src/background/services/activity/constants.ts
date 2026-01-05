/**
 * Constants for activity tracking services
 */

// Constants for activity filtering
export const STUCK_ACTIVITY_THRESHOLD_MS = 1000 // 1 second - minimum age to consider an activity "stuck"
export const DEFAULT_MINIMUM_DURATION = 5 // 5 seconds - default minimum duration for activities

// Constants for batch operations
export const BATCH_SIZE_THRESHOLD = 10 // Trigger immediate sync when batch queue reaches this size
export const RESUME_THRESHOLD_MS = 60000 // 60 seconds - can resume recently ended activity within this window
export const SESSION_URL_RESUME_THRESHOLD_MS = 10000 // 10 seconds - stricter threshold for session+URL matching
export const AUTO_FINALIZE_MIN_TIMEOUT_MS = 30000 // 30 seconds - minimum timeout for auto-finalize

// Constants for cleanup operations
export const CLEANUP_ALARM_INTERVAL_MINUTES = 1440 // 24 hours
export const OFFLINE_QUEUE_CLEANUP_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
export const BATCH_QUEUE_CLEANUP_AGE_MS = 60 * 60 * 1000 // 1 hour

// Constants for queue management
export const MAX_QUEUE_SIZE = 1000 // Maximum number of activities in batch queue

// Constants for sync retry logic
export const MAX_SYNC_RETRIES = 3 // Maximum number of sync retry attempts
export const INITIAL_RETRY_DELAY_MS = 1000 // Initial delay before first retry (1 second)
export const RETRY_BACKOFF_MULTIPLIER = 2 // Exponential backoff multiplier (2x each retry)


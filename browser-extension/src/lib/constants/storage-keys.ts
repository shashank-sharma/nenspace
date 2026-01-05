/**
 * Storage Keys
 * 
 * Constants for Chrome storage keys.
 */

export const STORAGE_KEYS = {
    AUTH: 'nenspace_auth',
    THEME: 'nenspace_theme',
    BACKEND_URL: 'nenspace_backend_url',
    DEV_TOKEN: 'nenspace_dev_token',
    PROFILE_ID: 'nenspace_profile_id',
    ACTIVITY_SETTINGS: 'nenspace_activity_settings',
    ACTIVITY_QUEUE: 'nenspace_activity_queue',
    ACTIVITY_BATCH_QUEUE: 'nenspace_activity_batch_queue',
    ACTIVITY_CHECKPOINT: 'nenspace_activity_checkpoint',
    ACTIVITY_LAST_SYNC_TIME: 'nenspace_activity_last_sync_time',
    ACTIVITY_LAST_HEARTBEAT_TIME: 'nenspace_activity_last_heartbeat_time',
    HISTORY_SYNC_CHECKPOINT: 'nenspace_history_sync_checkpoint',
    HISTORY_SYNC_STATE: 'nenspace_history_sync_state',
    HISTORY_RETRY_QUEUE: 'nenspace_history_retry_queue',
} as const;


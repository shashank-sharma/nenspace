/**
 * Storage Types
 * 
 * Type definitions for Chrome storage operations.
 */

export interface StorageKeys {
    readonly AUTH: string;
    readonly THEME: string;
    readonly BACKEND_URL: string;
    readonly DEV_TOKEN: string;
    readonly PROFILE_ID: string;
    readonly ACTIVITY_SETTINGS: string;
    readonly ACTIVITY_QUEUE: string;
    readonly ACTIVITY_BATCH_QUEUE: string;
    readonly ACTIVITY_CHECKPOINT: string;
    readonly ACTIVITY_LAST_SYNC_TIME: string;
    readonly HISTORY_SYNC_CHECKPOINT: string;
    readonly HISTORY_SYNC_STATE: string;
    readonly HISTORY_RETRY_QUEUE: string;
}

export interface StorageChangeEvent {
    [key: string]: chrome.storage.StorageChange;
}

export type StorageArea = 'local' | 'sync' | 'managed';


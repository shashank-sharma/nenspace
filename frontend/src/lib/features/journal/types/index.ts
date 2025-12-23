export type EntryType = 'manual' | 'ai_reflection' | 'ai_expanded';
export type EntryColor = 'orange' | 'blue' | 'grey' | 'green' | 'purple' | 'pink' | 'teal' | 'yellow';

export interface StreamEntry {
    id: string;
    user: string;
    content: string;
    title?: string;
    entry_date: string; // ISO date string
    entry_type: EntryType;
    entry_color?: EntryColor;
    is_highlighted: boolean;
    ai_context?: Record<string, any>;
    parent_entry?: string;
    created: string;
    updated: string;
    // Version-based sync fields
    version?: number; // Incremental version (increment on each change)
    content_hash?: string; // SHA-256 hash of entry content (for change detection)
    last_synced_version?: number; // Version when last synced successfully
    sync_device_id?: string; // Which device last synced this entry
}

/**
 * Extended StreamEntry interface with offline metadata
 * 
 * Note: We use PocketBase-style IDs (15-character alphanumeric) directly.
 * New entries start with syncStatus: 'pending' and are created with CREATE.
 * Synced entries have syncStatus: 'synced' and are updated with UPDATE.
 */
export interface LocalStreamEntry extends StreamEntry {
    syncStatus?: 'synced' | 'pending' | 'failed';
    lastModified?: number; // Timestamp for conflict resolution
    isSyncing?: boolean; // Flag indicating active sync in progress
    lastSyncAttempt?: number; // Timestamp of last sync attempt (for retry logic)
    syncError?: string; // Last sync error message
    syncRetryCount?: number; // Number of retry attempts
}

/**
 * Stream sync state for version-based sync
 */
export interface StreamSyncState {
    id: string;
    user: string;
    device_id?: string;
    // Frontend State
    frontend_version: number;
    frontend_hash: string;
    frontend_entry_count: number;
    // Backend State
    backend_version: number;
    backend_hash: string;
    backend_entry_count: number;
    // Sync State
    sync_status: 'synced' | 'conflicted' | 'pending' | 'error';
    last_sync_time: string;
    // Conflict Details (only when sync_status = 'conflicted')
    conflict_type?: 'version_mismatch' | 'hash_mismatch' | 'entry_count_mismatch' | 'data_divergence';
    conflict_details?: {
        frontend_changes: number;
        backend_changes: number;
        conflicting_entry_ids: string[];
        conflict_summary: string;
    };
    // Resolution (only when sync_status = 'conflicted')
    resolution_status?: 'pending' | 'resolved' | 'cancelled';
    resolution_choice?: 'use_frontend' | 'use_backend' | 'merge' | 'manual';
    resolution_timestamp?: string;
    created: string;
    updated: string;
}

/**
 * Sync request payload
 */
export interface SyncRequest {
    user_id: string;
    device_id?: string;
    frontend_version: number;
    frontend_hash: string;
    frontend_entry_count: number;
    entries: StreamEntry[];
    deleted_entry_ids: string[];
}

/**
 * Sync response payload
 */
export interface SyncResponse {
    sync_status: 'synced' | 'conflicted';
    backend_version: number;
    backend_hash: string;
    backend_entry_count: number;
    // If synced:
    entries_to_update?: StreamEntry[];
    entries_to_add?: StreamEntry[];
    entries_to_delete?: string[];
    new_version?: number;
    // If conflicted:
    conflict_details?: {
        type: string;
        frontend_changes: number;
        backend_changes: number;
        conflicting_entry_ids: string[];
        summary: string;
    };
    resolution_required?: boolean;
}

/**
 * Entry conflict information for manual resolution
 */
export interface EntryConflict {
    entryId: string;
    localEntry: LocalStreamEntry;
    serverEntry: LocalStreamEntry;
    conflictType: 'content' | 'metadata' | 'both';
    detectedAt: number;
}

/**
 * Field-level diff for conflict resolution UI
 */
export interface FieldDiff {
    field: string;
    localValue: any;
    serverValue: any;
    isDifferent: boolean;
}

export interface StreamState {
    entries: LocalStreamEntry[];
    isLoading: boolean;
    error: string | null;
    selectedEntry: LocalStreamEntry | null;
    selectedDate: Date | null;
}

export interface EntryDensity {
    date: string; // ISO date string
    count: number;
    entries: LocalStreamEntry[];
}


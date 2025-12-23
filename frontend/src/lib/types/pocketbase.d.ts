/**
 * PocketBase Record Types
 * 
 * TypeScript types for PocketBase collections.
 * These types match the actual PocketBase schema.
 */

import type { RecordModel } from 'pocketbase';

/**
 * Device Record
 * 
 * Represents a user's device for multi-device sync tracking.
 */
export interface DeviceRecord extends RecordModel {
    /** User who owns this device (relation to users collection) */
    user: string;
    
    /** User-friendly device name */
    name: string;
    
    /** Device hostname */
    hostname?: string;
    
    /** Operating system */
    os?: string;
    
    /** Architecture */
    arch?: string;
    
    /** Whether device is currently online */
    is_online: boolean;
    
    /** Whether this is the currently active device */
    is_active: boolean;
    
    /** Whether device is public */
    is_public: boolean;
    
    /** Whether to sync events */
    sync_events: boolean;
    
    /** Last time device was online */
    last_online?: string;
    
    /** Last time device synced */
    last_sync?: string;
    
    /** Device type (optional) */
    type?: string;
}

/**
 * Stream Sync Record
 * 
 * Tracks sync state and conflicts for version-based sync.
 */
export interface StreamSyncRecord extends RecordModel {
    /** User who owns this sync state (relation to users collection) */
    user: string;
    
    /** Device identifier (relation to devices collection) */
    device_id?: string;
    
    /** Frontend version counter */
    frontend_version: number;
    
    /** SHA-256 hash of all frontend entries */
    frontend_hash: string;
    
    /** Number of entries in frontend */
    frontend_entry_count: number;
    
    /** Backend version counter */
    backend_version: number;
    
    /** SHA-256 hash of all backend entries */
    backend_hash: string;
    
    /** Number of entries in backend */
    backend_entry_count: number;
    
    /** Current sync status */
    sync_status: 'synced' | 'conflicted' | 'pending' | 'error';
    
    /** ISO timestamp of last sync */
    last_sync_time: string;
    
    /** Type of conflict (only when sync_status = 'conflicted') */
    conflict_type?: 'version_mismatch' | 'hash_mismatch' | 'entry_count_mismatch' | 'data_divergence';
    
    /** Conflict details (only when sync_status = 'conflicted') */
    conflict_details?: {
        frontend_changes: number;
        backend_changes: number;
        conflicting_entry_ids: string[];
        conflict_summary: string;
    };
    
    /** Resolution status (only when sync_status = 'conflicted') */
    resolution_status?: 'pending' | 'resolved' | 'cancelled';
    
    /** User's resolution choice (only when sync_status = 'conflicted') */
    resolution_choice?: 'use_frontend' | 'use_backend' | 'merge' | 'manual';
    
    /** When conflict was resolved (only when resolved) */
    resolution_timestamp?: string;
}

/**
 * Stream Entry Record
 * 
 * Journal entry with version-based sync fields.
 */
export interface StreamEntryRecord extends RecordModel {
    /** Entry ID */
    id: string;
    
    /** User who owns this entry (relation to users collection) */
    user: string;
    
    /** Entry content */
    content: string;
    
    /** Entry title (optional) */
    title?: string;
    
    /** Entry date (ISO date string) */
    entry_date: string;
    
    /** Type of entry */
    entry_type: 'manual' | 'ai_reflection' | 'ai_expanded';
    
    /** Entry color */
    entry_color?: 'orange' | 'blue' | 'grey' | 'green' | 'purple' | 'pink' | 'teal' | 'yellow';
    
    /** Whether entry is highlighted */
    is_highlighted: boolean;
    
    /** AI context data (optional) */
    ai_context?: Record<string, any>;
    
    /** Parent entry ID (for threaded entries) */
    parent_entry?: string;
    
    /** Creation timestamp (ISO datetime) */
    created: string;
    
    /** Last update timestamp (ISO datetime) */
    updated: string;
    
    /** Version number (increments on each change) */
    version?: number;
    
    /** SHA-256 hash of entry content */
    content_hash?: string;
    
    /** Version when last synced successfully */
    last_synced_version?: number;
    
    /** Device ID that last synced this entry (relation to devices collection) */
    sync_device_id?: string;
}


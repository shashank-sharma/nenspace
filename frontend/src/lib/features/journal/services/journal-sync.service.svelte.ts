/**
 * Journal Sync Service
 * 
 * Manages offline queue and automatic syncing for stream entries.
 * Supports bidirectional sync with conflict resolution.
 * 
 * Extends BaseSyncService to eliminate duplication
 * 
 * @example
 * ```typescript
 * import { JournalSyncService } from '$lib/features/journal/services/journal-sync.service.svelte';
 * 
 * // Queue an entry for syncing
 * await JournalSyncService.queueEntry(entry);
 * 
 * // Perform full bidirectional sync
 * await JournalSyncService.fullSync();
 * 
 * // Pull entries from server
 * const result = await JournalSyncService.pullFromServer();
 * ```
 */

import { BaseSyncService } from '$lib/services/base-sync.service.svelte';
import { JournalStorageService } from './journal-storage.service';
import { SettingsService } from '$lib/services/settings.service.svelte';
import { NetworkService } from '$lib/services/network.service.svelte';
import { authService } from '$lib/services/authService.svelte';
import type { LocalStreamEntry, EntryConflict } from '../types';
import { pb } from '$lib/config/pocketbase';
import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';
import { fetchAllPages } from '$lib/utils/pocketbase.util';
import { FilterBuilder } from '$lib/utils/pocketbase-filter.util';

// ========================================
// Constants
// ========================================

/** Delay before initializing periodic sync (ms) */
const SYNC_INIT_DELAY_MS = 1000;

/** Time threshold for considering server entry significantly newer (ms) */
const CONFLICT_THRESHOLD_MS = 60000; // 1 minute

/** Milliseconds per minute for interval calculations */
const MS_PER_MINUTE = 60 * 1000;

/** Max retry attempts for failed syncs */
const MAX_SYNC_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
const BASE_RETRY_DELAY_MS = 2000;

/** Timeout for ensureEntrySynced (ms) */
const SYNC_TIMEOUT_MS = 30000; // 30 seconds

// ========================================
// Types
// ========================================

interface PullResult {
    added: number;
    updated: number;
    conflicts: number;
    deleted: number;
}

interface ConflictResolutionResult {
    entry: LocalStreamEntry;
    isConflict: boolean;
}

// ========================================
// Service Implementation
// ========================================

class JournalSyncServiceImpl extends BaseSyncService<LocalStreamEntry> {
    protected storageService = JournalStorageService;
    protected eventName = 'journal-synced';
    
    // Private state
    #autoSyncInterval: NodeJS.Timeout | null = null;
    #lastPullSyncTime: number | null = null;
    #pullInProgress = false;
    #lastIntervalMinutes: number | null = null;
    #pendingDeletions = new Set<string>(); // Track entry IDs pending deletion on server
    #syncingEntries = new Map<string, Promise<LocalStreamEntry>>(); // Track entries currently being synced
    #conflictQueue: EntryConflict[] = []; // Queue of unresolved conflicts
    #syncBlocked = false; // Block sync while conflicts are being resolved

    // ========================================
    // Initialization
    // ========================================

    constructor() {
        super();
        if (browser) {
            // Setup periodic sync after initialization
            setTimeout(() => {
                this.#updatePeriodicSync();
            }, SYNC_INIT_DELAY_MS);
        }
    }

    // ========================================
    // Periodic Sync Management
    // ========================================

    /**
     * Update periodic sync based on current settings.
     * Call this when settings might have changed.
     */
    #updatePeriodicSync(): void {
        const settings = SettingsService.journal;
        this.autoSyncEnabled = settings.syncEnabled;
        
        // Only update if interval changed
        if (this.#lastIntervalMinutes === settings.autoSyncInterval) {
            return;
        }
        
        this.#lastIntervalMinutes = settings.autoSyncInterval;
        this.#setupPeriodicSync(settings.autoSyncInterval);
    }

    /**
     * Setup periodic auto-sync based on interval setting.
     * 
     * @param intervalMinutes - Sync interval in minutes
     */
    #setupPeriodicSync(intervalMinutes: number): void {
        // Clear existing interval
        if (this.#autoSyncInterval) {
            clearInterval(this.#autoSyncInterval);
            this.#autoSyncInterval = null;
        }

        // Only setup if sync is enabled and interval is valid
        const settings = SettingsService.journal;
        if (!settings.syncEnabled || intervalMinutes <= 0) {
            return;
        }

        const intervalMs = intervalMinutes * MS_PER_MINUTE;
        this.#autoSyncInterval = setInterval(() => {
            // Check settings again in case they changed
            const currentSettings = SettingsService.journal;
            if (currentSettings.syncEnabled && NetworkService.isOnline) {
                this.pullFromServer();
                this.syncPendingItems();
            }
        }, intervalMs);

    }

    /**
     * Check if sync is enabled before performing operations.
     * 
     * @returns True if sync is enabled, false otherwise
     */
    #isSyncEnabled(): boolean {
        return SettingsService.journal.syncEnabled;
    }

    // ========================================
    // Server Sync Operations
    // ========================================

    /**
     * Feature-specific: Sync entry to server.
     * Creates new entry if local-only, updates existing entry otherwise.
     * 
     * @param entry - Entry to sync to server
     * @returns Synced entry with updated metadata
     * @throws Error if sync is disabled
     */
    protected async syncToServer(entry: LocalStreamEntry): Promise<LocalStreamEntry> {
        if (!this.#isSyncEnabled()) {
            throw new Error('Sync is disabled');
        }

        // Mark as syncing
        const syncingEntry: LocalStreamEntry = {
            ...entry,
            isSyncing: true,
            lastSyncAttempt: Date.now(),
        };
        await JournalStorageService.saveEntry(syncingEntry);
        this.#emitEntrySyncEvent(entry.id, 'syncing');

        try {
            // Determine if this is a new entry (never synced) or existing entry (already synced)
            // Check if entry exists on server by trying to fetch it first
            let entryExistsOnServer = false;
            if (entry.id) {
                try {
                    await pb.collection('stream_entries').getOne(entry.id);
                    entryExistsOnServer = true;
                } catch (error) {
                    // Entry doesn't exist on server (404 or other error)
                    entryExistsOnServer = false;
                }
            }
            
            // If entry exists on server, it's an UPDATE. Otherwise, it's a CREATE.
            const isNewEntry = !entryExistsOnServer;
            const oldId = entry.id;

            if (isNewEntry) {
                // Create new entry on server - include id in payload (PocketBase accepts it)
                // Exclude sync metadata fields
                const { syncStatus, lastModified, isSyncing, lastSyncAttempt, syncError, syncRetryCount, ...entryData } = entry;
                // entryData.id is already included (PocketBase-style ID)
                
                const created = await pb.collection('stream_entries').create(entryData);
                const newId = created.id;
                
                // Update children that reference old ID if ID changed (shouldn't happen with PocketBase-style IDs, but handle it)
                if (oldId !== newId) {
                    await this.#updateChildrenParentReference(oldId, newId);
                    // Delete old local entry if ID changed
                    await JournalStorageService.deleteEntry(oldId);
                }
                
                // Save server entry with synced status (update existing local entry or create new one)
                // Merge server response with original entry to preserve all local fields
                const syncedEntry: LocalStreamEntry = {
                    ...entry, // Preserve original entry fields
                    ...(created as unknown as LocalStreamEntry), // Override with server response
                    syncStatus: 'synced',
                    lastModified: Date.now(),
                    isSyncing: false,
                    syncError: undefined,
                    syncRetryCount: 0,
                };
                await JournalStorageService.saveEntry(syncedEntry);
                this.#emitEntrySyncEvent(syncedEntry.id, 'synced');
                await this.updatePendingCount();
                
                return syncedEntry;
            } else {
                // Update existing entry on server
                const { syncStatus, lastModified, isSyncing, lastSyncAttempt, syncError, syncRetryCount, ...entryData } = entry;
                const updated = await pb.collection('stream_entries').update(entry.id, entryData);
                
                // Update local with synced status
                // Merge server response with original entry to preserve all local fields
                const syncedEntry: LocalStreamEntry = {
                    ...entry, // Preserve original entry fields
                    ...(updated as unknown as LocalStreamEntry), // Override with server response
                    syncStatus: 'synced',
                    lastModified: Date.now(),
                    isSyncing: false,
                    syncError: undefined,
                    syncRetryCount: 0,
                };
                await JournalStorageService.saveEntry(syncedEntry);
                this.#emitEntrySyncEvent(syncedEntry.id, 'synced');
                await this.updatePendingCount();
                
                return syncedEntry;
            }
        } catch (error) {
            // Mark as failed with error
            const retryCount = (entry.syncRetryCount || 0) + 1;
            const failedEntry: LocalStreamEntry = {
                ...entry,
                syncStatus: 'failed',
                isSyncing: false,
                syncError: error instanceof Error ? error.message : 'Sync failed',
                syncRetryCount: retryCount,
                lastModified: Date.now(),
            };
            await JournalStorageService.saveEntry(failedEntry);
            this.#emitEntrySyncEvent(entry.id, 'failed');
            await this.updatePendingCount(); // Update failed count immediately
            
            throw error;
        }
    }

    // ========================================
    // Helper Methods
    // ========================================

    /**
     * Emit sync event for a specific entry
     */
    #emitEntrySyncEvent(entryId: string, status: 'syncing' | 'synced' | 'failed'): void {
        if (browser) {
            window.dispatchEvent(new CustomEvent('journal-entry-sync-status', {
                detail: { entryId, status }
            }));
        }
    }

    /**
     * Calculate exponential backoff delay
     */
    #calculateBackoffDelay(retryCount: number): number {
        return Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, retryCount), 30000); // Max 30s
    }

    /**
     * Update children that reference an old parent ID to use the new parent ID.
     * This fixes broken references when a parent entry syncs and gets a new ID.
     * 
     * @param oldParentId - The old parent ID
     * @param newParentId - The new parent ID (backend ID)
     */
    async #updateChildrenParentReference(oldParentId: string, newParentId: string): Promise<void> {
        const allEntries = await JournalStorageService.getAllEntries();
        const childrenToUpdate = allEntries.filter(
            e => e.parent_entry === oldParentId
        );
        
        if (childrenToUpdate.length === 0) {
            return;
        }
        
        for (const child of childrenToUpdate) {
            const updated: LocalStreamEntry = {
                ...child,
                parent_entry: newParentId,
                lastModified: Date.now(),
            };
            await JournalStorageService.saveEntry(updated);
            
            // Re-queue for sync if it was synced (parent_entry changed)
            if (child.syncStatus === 'synced') {
                updated.syncStatus = 'pending';
                await JournalStorageService.saveEntry(updated);
                await this.queueItem(updated);
            }
        }
    }

    // ========================================
    // Eager Sync Methods
    // ========================================

    /**
     * Ensure an entry is synced to the server.
     * Waits for sync completion if already in progress, or initiates sync if needed.
     * 
     * @param entryId - ID of entry to ensure is synced
     * @param timeoutMs - Max time to wait for sync (default: 30s)
     * @returns Synced entry
     * @throws Error if sync fails or times out
     */
    async ensureEntrySynced(entryId: string, timeoutMs: number = SYNC_TIMEOUT_MS): Promise<LocalStreamEntry> {
        // Check if already syncing
        const existingSyncPromise = this.#syncingEntries.get(entryId);
        if (existingSyncPromise) {
            return Promise.race([
                existingSyncPromise,
                this.#createTimeoutPromise(timeoutMs, entryId)
            ]);
        }

        // Get entry
        const entry = await JournalStorageService.getEntry(entryId);
        if (!entry) {
            throw new Error(`Entry ${entryId} not found`);
        }

        // Check if already synced
        if (entry.syncStatus === 'synced') {
            return entry;
        }

        // Check network
        if (!NetworkService.isOnline) {
            throw new Error('Cannot sync while offline');
        }

        // Check if sync is enabled
        if (!this.#isSyncEnabled()) {
            throw new Error('Sync is disabled');
        }

        // Initiate sync
        const syncPromise = this.#syncEntryWithRetry(entry);
        this.#syncingEntries.set(entryId, syncPromise);

        try {
            const synced = await Promise.race([
                syncPromise,
                this.#createTimeoutPromise(timeoutMs, entryId)
            ]);
            return synced;
        } finally {
            this.#syncingEntries.delete(entryId);
        }
    }

    /**
     * Sync entry with exponential backoff retry
     */
    async #syncEntryWithRetry(entry: LocalStreamEntry): Promise<LocalStreamEntry> {
        let lastError: Error | null = null;
        const maxRetries = MAX_SYNC_RETRIES;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const synced = await this.syncToServer(entry);
                return synced;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`[JournalSync] Sync attempt ${attempt + 1}/${maxRetries + 1} failed:`, lastError.message);

                if (attempt < maxRetries) {
                    const delay = this.#calculateBackoffDelay(attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw lastError;
                }
            }
        }

        throw lastError || new Error('Sync failed after all retries');
    }

    /**
     * Create timeout promise for sync operations
     */
    #createTimeoutPromise(timeoutMs: number, entryId: string): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Sync timeout for entry ${entryId} after ${timeoutMs}ms`));
            }, timeoutMs);
        });
    }

    // ========================================
    // Pagination Helpers
    // ========================================

    /**
     * Fetch all server entries for a user with pagination.
     * Uses shared PocketBase utility for consistent pagination handling.
     * 
     * @param userId - User ID to fetch entries for
     * @returns Array of all server entries
     * @throws Error if fetch fails
     */
    async #fetchAllServerEntries(userId: string): Promise<LocalStreamEntry[]> {
        const filter = FilterBuilder.create()
            .equals('user', userId)
            .build();
        
        return fetchAllPages<LocalStreamEntry>({
            collection: 'stream_entries',
            filter,
            sort: '-updated',
            transform: (item) => item as unknown as LocalStreamEntry,
        });
    }

    // ========================================
    // Conflict Resolution
    // ========================================

    /**
     * Detect and queue conflicts between server and local entry.
     * Instead of auto-resolving, emit event for user resolution.
     * 
     * @param serverEntry - Entry from server
     * @param localEntry - Entry from local storage
     * @returns Resolution result - if conflict detected, queues it and returns local entry
     */
    #resolveConflict(serverEntry: LocalStreamEntry, localEntry: LocalStreamEntry): ConflictResolutionResult {
        const serverModified = new Date(serverEntry.updated).getTime();
        const localModified = localEntry.lastModified || new Date(localEntry.updated).getTime();

        // Check if there are actual content differences
        const hasContentDiff = 
            serverEntry.content !== localEntry.content ||
            serverEntry.title !== localEntry.title ||
            serverEntry.entry_color !== localEntry.entry_color ||
            serverEntry.is_highlighted !== localEntry.is_highlighted;

        if (localEntry.syncStatus === 'pending' || localEntry.syncStatus === 'failed') {
            // Local has pending changes - check if server is newer AND different
            if (serverModified > localModified && hasContentDiff) {
                const serverIsMuchNewer = serverModified - localModified > CONFLICT_THRESHOLD_MS;
                
                if (serverIsMuchNewer) {
                    // Real conflict detected - queue for user resolution
                    const conflictType = serverEntry.content !== localEntry.content ? 'content' : 'metadata';
                    const conflict: EntryConflict = {
                        entryId: localEntry.id,
                        localEntry,
                        serverEntry,
                        conflictType,
                        detectedAt: Date.now()
                    };
                    
                    this.#conflictQueue.push(conflict);
                    this.#syncBlocked = true;
                    
                    // Emit event for UI
                    this.#emitConflictDetected(conflict);
                    
                    return { entry: localEntry, isConflict: true };
                } else {
                    // Times are close - keep local changes, will sync on push
                    return { entry: localEntry, isConflict: false };
                }
            } else if (!hasContentDiff && serverModified >= localModified) {
                // No content diff and server is same or newer - server already has our changes, mark as synced
                const synced: LocalStreamEntry = {
                    ...serverEntry,
                    syncStatus: 'synced',
                    lastModified: serverModified,
                };
                return { entry: synced, isConflict: false };
            } else {
                // Local is newer or same, or no content diff - keep local, will sync on push
                return { entry: localEntry, isConflict: false };
            }
        } else {
            // Local is synced - accept server version if newer
            if (serverModified > localModified) {
                const merged: LocalStreamEntry = {
                    ...serverEntry,
                    syncStatus: 'synced',
                    lastModified: serverModified,
                };
                return { entry: merged, isConflict: false };
            } else {
                // Local is newer or same - keep local
                return { entry: localEntry, isConflict: false };
            }
        }
    }

    /**
     * Emit conflict detected event
     */
    #emitConflictDetected(conflict: EntryConflict): void {
        if (browser) {
            window.dispatchEvent(new CustomEvent('journal-conflict-detected', {
                detail: conflict
            }));
        }
    }

    /**
     * Resolve a conflict with user's choice
     * 
     * @param entryId - ID of conflicted entry
     * @param resolution - User's resolution choice
     */
    async resolveUserConflict(entryId: string, resolution: 'keep_local' | 'use_server' | 'manual'): Promise<void> {
        // Find conflict in queue
        const conflictIndex = this.#conflictQueue.findIndex(c => c.entryId === entryId);
        if (conflictIndex === -1) {
            console.warn(`[JournalSync] No conflict found for entry ${entryId}`);
            return;
        }

        const conflict = this.#conflictQueue[conflictIndex];
        
        try {
            if (resolution === 'keep_local') {
                // Keep local, mark as pending to sync
                const localEntry: LocalStreamEntry = {
                    ...conflict.localEntry,
                    syncStatus: 'pending',
                    lastModified: Date.now(),
                };
                await JournalStorageService.saveEntry(localEntry);
                toast.success('Keeping your local changes');
            } else if (resolution === 'use_server') {
                // Use server version
                const serverEntry: LocalStreamEntry = {
                    ...conflict.serverEntry,
                    syncStatus: 'synced',
                    lastModified: Date.now(),
                };
                await JournalStorageService.saveEntry(serverEntry);
                toast.success('Using server version');
            } else if (resolution === 'manual') {
                // Manual merge - for now treat as keep_local
                // In full implementation, this would handle custom merged content
                const localEntry: LocalStreamEntry = {
                    ...conflict.localEntry,
                    syncStatus: 'pending',
                    lastModified: Date.now(),
                };
                await JournalStorageService.saveEntry(localEntry);
                toast.success('Manual merge applied');
            }

            // Remove from queue
            this.#conflictQueue.splice(conflictIndex, 1);

            // Unblock sync if no more conflicts
            if (this.#conflictQueue.length === 0) {
                this.#syncBlocked = false;
                
                // Resume sync
                if (NetworkService.isOnline && this.#isSyncEnabled()) {
                    await this.syncPendingItems();
                }
            } else {
                // Emit next conflict
                const nextConflict = this.#conflictQueue[0];
                this.#emitConflictDetected(nextConflict);
            }
        } catch (error) {
            console.error('[JournalSync] Failed to resolve conflict:', error);
            toast.error('Failed to resolve conflict');
            throw error;
        }
    }

    /**
     * Get pending conflicts
     */
    getPendingConflicts(): EntryConflict[] {
        return [...this.#conflictQueue];
    }

    /**
     * Check if sync is blocked by conflicts
     */
    isSyncBlocked(): boolean {
        return this.#syncBlocked;
    }


    // ========================================
    // Public Sync Methods
    // ========================================

    /**
     * Pull entries from server and merge with local entries.
     * 
     * Performs bidirectional merge with conflict resolution:
     * - Adds entries that exist only on server
     * - Updates entries that exist in both (with conflict resolution)
     * - Marks local-only entries as pending for sync
     * - Removes local entries that were deleted on server
     * - Deletes server entries that were deleted locally
     * 
     * @returns Result object with counts of added, updated, conflicted, and deleted entries
     * @throws Error if pull fails
     */
    async pullFromServer(): Promise<PullResult> {
        // Update periodic sync in case settings changed
        this.#updatePeriodicSync();
        
        if (!this.#isSyncEnabled()) {
            return { added: 0, updated: 0, conflicts: 0, deleted: 0 };
        }

        if (!NetworkService.isOnline) {
            return { added: 0, updated: 0, conflicts: 0, deleted: 0 };
        }

        if (this.#syncBlocked) {
            return { added: 0, updated: 0, conflicts: 0, deleted: 0 };
        }

        if (this.#pullInProgress) {
            return { added: 0, updated: 0, conflicts: 0, deleted: 0 };
        }

        const userId = authService.user?.id;
        if (!userId) {
            return { added: 0, updated: 0, conflicts: 0, deleted: 0 };
        }

        this.#pullInProgress = true;
        const result: PullResult = { added: 0, updated: 0, conflicts: 0, deleted: 0 };

        try {

            // Fetch all entries from server (with pagination)
            const allServerEntries = await this.#fetchAllServerEntries(userId);

            // Get all local entries
            const localEntries = await JournalStorageService.getAllEntries();
            const localMap = new Map<string, LocalStreamEntry>();
            localEntries.forEach(entry => {
                localMap.set(entry.id, entry);
            });

            const serverEntryIds = new Set(allServerEntries.map(e => e.id));

            // Process server entries
            for (const serverEntry of allServerEntries) {
                const localEntry = localMap.get(serverEntry.id);

                // If entry is pending deletion, delete from server
                if (this.#pendingDeletions.has(serverEntry.id)) {
                    try {
                        await pb.collection('stream_entries').delete(serverEntry.id);
                        this.#pendingDeletions.delete(serverEntry.id);
                    } catch (error) {
                        console.error(`[JournalSync] Failed to delete entry from server: ${serverEntry.id}`, error);
                    }
                    continue;
                }

                if (!localEntry) {
                    // Entry exists on server but not locally - add it
                    const newEntry: LocalStreamEntry = {
                        ...serverEntry,
                        syncStatus: 'synced',
                        lastModified: new Date(serverEntry.updated).getTime(),
                    };
                    await JournalStorageService.saveEntry(newEntry);
                    result.added++;
                } else {
                    // Entry exists in both - resolve conflict
                    const resolution = this.#resolveConflict(serverEntry, localEntry);
                    await JournalStorageService.saveEntry(resolution.entry);
                    
                    if (resolution.isConflict) {
                        result.conflicts++;
                    } else {
                        result.updated++;
                    }
                }
            }

            // Check for local entries that don't exist on server
            for (const localEntry of localEntries) {
                if (!serverEntryIds.has(localEntry.id)) {
                    // Entry exists locally but not on server
                    if (localEntry.syncStatus === 'synced') {
                        // Was synced but deleted on server - remove locally
                        await JournalStorageService.deleteEntry(localEntry.id);
                        result.deleted++;
                    } else {
                    // Entry only exists locally - ensure it's marked as pending
                    if (localEntry.syncStatus !== 'pending' && localEntry.syncStatus !== 'failed') {
                        const pending: LocalStreamEntry = {
                            ...localEntry,
                            syncStatus: 'pending',
                            lastModified: Date.now(),
                        };
                        await JournalStorageService.saveEntry(pending);
                    }
                }
            }
            }

            // Process pending deletions
            await this.#syncPendingDeletions();

            this.#lastPullSyncTime = Date.now();
            this._syncStatus.lastSyncTime = Date.now();

            console.log(
                `[JournalSync] Pull completed: ${result.added} added, ${result.updated} updated, ${result.conflicts} conflicts, ${result.deleted} deleted`
            );

            // Dispatch event for UI refresh
            if (browser) {
                window.dispatchEvent(new CustomEvent(this.eventName));
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[JournalSync] Failed to pull from server:', errorMessage, error);
            toast.error('Failed to sync entries from server');
            throw error;
        } finally {
            this.#pullInProgress = false;
            await this.updatePendingCount();
        }
    }

    /**
     * Perform full bidirectional sync.
     * 
     * First pulls entries from server, then pushes pending local changes, then syncs deletions.
     * 
     * @throws Error if sync fails
     */
    async fullSync(): Promise<void> {
        // Update periodic sync in case settings changed
        this.#updatePeriodicSync();
        
        if (!this.#isSyncEnabled()) {
            return;
        }

        if (!NetworkService.isOnline) {
            return;
        }

        try {
            // First pull from server (handles deletions from server)
            await this.pullFromServer();
            // Then push pending local changes
            await this.syncPendingItems();
            // Finally sync pending deletions
            await this.#syncPendingDeletions();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[JournalSync] Full sync failed:', errorMessage, error);
            throw error;
        }
    }

    /**
     * Hard refresh: Clear all local entries and pull from server as source of truth.
     * 
     * WARNING: This will discard any local changes that haven't been synced.
     * 
     * @returns Result object with count of entries loaded
     * @throws Error if refresh fails or user is not authenticated
     */
    async hardRefresh(): Promise<{ added: number }> {
        if (!this.#isSyncEnabled()) {
            return { added: 0 };
        }

        if (!NetworkService.isOnline) {
            throw new Error('Cannot refresh while offline');
        }

        if (this.#pullInProgress) {
            return { added: 0 };
        }

        const userId = authService.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        this.#pullInProgress = true;

        try {

            // Clear all local entries
            await JournalStorageService.clearAllEntries();

            // Fetch all entries from server
            const allServerEntries = await this.#fetchAllServerEntries(userId);

            // Save all server entries as synced
            for (const serverEntry of allServerEntries) {
                const syncedEntry: LocalStreamEntry = {
                    ...serverEntry,
                    syncStatus: 'synced',
                    lastModified: new Date(serverEntry.updated).getTime(),
                };
                await JournalStorageService.saveEntry(syncedEntry);
            }

            this.#lastPullSyncTime = Date.now();
            this._syncStatus.lastSyncTime = Date.now();


            // Dispatch event for UI refresh
            if (browser) {
                window.dispatchEvent(new CustomEvent(this.eventName));
            }

            await this.updatePendingCount();

            return { added: allServerEntries.length };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[JournalSync] Failed to hard refresh:', errorMessage, error);
            toast.error('Failed to refresh from server');
            throw error;
        } finally {
            this.#pullInProgress = false;
        }
    }

    /**
     * Override syncPendingItems to respect sync enabled setting.
     * 
     * @throws Error if sync fails
     */
    async syncPendingItems(): Promise<void> {
        // Update periodic sync in case settings changed
        this.#updatePeriodicSync();
        
        if (!this.#isSyncEnabled()) {
            return;
        }
        return super.syncPendingItems();
    }

    /**
     * Override queueItem to respect sync enabled setting.
     * 
     * If sync is disabled, saves entry locally without marking as pending.
     * 
     * @param item - Entry to queue for syncing
     * @throws Error if save fails
     */
    async queueItem(item: LocalStreamEntry): Promise<void> {
        if (!this.#isSyncEnabled()) {
            // Still save locally but don't mark as pending
            const localOnly: LocalStreamEntry = {
                ...item,
                syncStatus: undefined,
                lastModified: Date.now(),
            };
            await JournalStorageService.saveEntry(localOnly);
            return;
        }
        return super.queueItem(item);
    }

    // ========================================
    // Getters
    // ========================================

    /**
     * Get last pull sync time.
     * 
     * @returns Timestamp of last pull sync, or null if never synced
     */
    get lastPullSyncTime(): number | null {
        return this.#lastPullSyncTime;
    }

    // ========================================
    // Base Class Overrides
    // ========================================

    /**
     * Feature-specific: Get human-readable description for an entry.
     * 
     * @param entry - Entry to describe
     * @returns Human-readable description
     */
    protected getItemDescription(entry: LocalStreamEntry): string {
        if (entry.title) {
            return `Entry "${entry.title}"`;
        }
        if (entry.content) {
            return `Entry "${entry.content.substring(0, 30)}"`;
        }
        return `Entry (ID: ${entry.id})`;
    }

    // ========================================
    // Deletion Handling
    // ========================================

    /**
     * Sync pending deletions to server.
     * 
     * @private
     */
    async #syncPendingDeletions(): Promise<void> {
        if (this.#pendingDeletions.size === 0 || !NetworkService.isOnline) {
            return;
        }

        const deletionsToProcess = Array.from(this.#pendingDeletions);
        let successCount = 0;
        let failCount = 0;

        for (const entryId of deletionsToProcess) {
            try {
                await pb.collection('stream_entries').delete(entryId);
                this.#pendingDeletions.delete(entryId);
                successCount++;
            } catch (error) {
                // If entry doesn't exist on server, that's fine - remove from queue
                if (error instanceof Error && error.message.includes('404')) {
                    this.#pendingDeletions.delete(entryId);
                    successCount++;
                } else {
                    failCount++;
                    console.error(`[JournalSync] Failed to delete entry from server: ${entryId}`, error);
                }
            }
        }

    }

    /**
     * Queue an entry for deletion (both locally and on server).
     * 
     * Handles cascade deletion for ALL descendant entries (children, grandchildren, etc.).
     * This ensures that when you delete any entry, all its descendants are also deleted.
     * 
     * Note: PocketBase's cascade_delete only works when deleting the parent entry.
     * For child entries, we need to explicitly delete all descendants.
     * 
     * @param entryId - ID of entry to delete
     * @param cascade - Whether to also delete all descendant entries (default: true)
     * @throws Error if deletion fails
     */
    async queueEntryDeletion(entryId: string, cascade: boolean = true): Promise<void> {
        const entry = await JournalStorageService.getEntry(entryId);
        if (!entry) {
            return;
        }

        // Collect all entries to delete (entry + all descendants if cascade)
        const entriesToDelete: LocalStreamEntry[] = [entry];
        
        if (cascade) {
            // Find all descendant entries (children, grandchildren, etc.)
            const descendants = await this.#findAllDescendants(entryId);
            entriesToDelete.push(...descendants);
        }

        // Delete all entries locally first
        for (const entryToDelete of entriesToDelete) {
            await JournalStorageService.deleteEntry(entryToDelete.id);
        }

        // Queue all synced entries for server deletion
        const syncedEntriesToDelete = entriesToDelete.filter(
            e => e.syncStatus === 'synced'
        );

        for (const syncedEntry of syncedEntriesToDelete) {
            this.#pendingDeletions.add(syncedEntry.id);
        }

        if (syncedEntriesToDelete.length > 0) {
            // Try immediate deletion if online
            if (NetworkService.isOnline) {
                await this.#syncPendingDeletions();
            }
        }
    }

    /**
     * Find all descendant entries (children, grandchildren, etc.) of an entry.
     * 
     * This recursively finds all entries in the subtree starting from the given entry.
     * 
     * @private
     * @param entryId - ID of the entry to find descendants for
     * @returns Array of all descendant entries
     */
    async #findAllDescendants(entryId: string): Promise<LocalStreamEntry[]> {
        const descendants: LocalStreamEntry[] = [];
        const visited = new Set<string>();
        
        async function collectDescendants(parentId: string) {
            if (visited.has(parentId)) {
                return; // Prevent infinite loops
            }
            visited.add(parentId);
            
            const children = await JournalStorageService.getChildEntries(parentId);
            
            for (const child of children) {
                descendants.push(child);
                // Recursively collect children of children
                await collectDescendants(child.id);
            }
        }
        
        await collectDescendants(entryId);
        return descendants;
    }

    // ========================================
    // Public API
    // ========================================

    /**
     * Queue an entry for syncing.
     * 
     * This is a convenience method that calls the base class queueItem method.
     * 
     * @param entry - Entry to queue for syncing
     * @throws Error if queue fails
     */
    async queueEntry(entry: LocalStreamEntry): Promise<void> {
        return this.queueItem(entry);
    }

    // ========================================
    // Cleanup
    // ========================================

    /**
     * Cleanup resources on destroy.
     * 
     * Clears periodic sync interval to prevent memory leaks.
     */
    destroy(): void {
        if (this.#autoSyncInterval) {
            clearInterval(this.#autoSyncInterval);
            this.#autoSyncInterval = null;
        }
    }
}

// Export singleton instance
export const JournalSyncService = new JournalSyncServiceImpl();


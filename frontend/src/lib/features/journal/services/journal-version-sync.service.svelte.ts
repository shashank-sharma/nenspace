/**
 * Journal Version-Based Sync Service
 * 
 * Implements version-based sync with hash-based conflict detection.
 * Uses a single sync endpoint for all operations.
 * 
 * Architecture:
 * - Local-first: All operations happen locally immediately
 * - Periodic sync: Syncs happen on interval or manual trigger
 * - Version tracking: Each entry has a version number
 * - Hash-based: Content hashes detect changes
 * - Conflict blocking: Conflicts block sync until resolved
 * 
 * @example
 * ```typescript
 * import { JournalVersionSyncService } from '$lib/features/journal/services/journal-version-sync.service.svelte';
 * 
 * // Perform sync (handles all operations)
 * const result = await JournalVersionSyncService.sync();
 * 
 * // Check for conflicts
 * if (result.sync_status === 'conflicted') {
 *   // Show conflict resolution UI
 * }
 * ```
 */

import { JournalStorageService } from './journal-storage.service';
import { JournalSyncStateService } from './journal-sync-state.service';
import { SettingsService } from '$lib/services/settings.service.svelte';
import { NetworkService } from '$lib/services/network.service.svelte';
import { authService } from '$lib/services/authService.svelte';
import type { LocalStreamEntry, StreamSyncState, SyncRequest, SyncResponse } from '../types';
import { pb } from '$lib/config/pocketbase';
import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';
import {
    calculateEntryHash,
    calculateFrontendHash,
    prepareEntryForSync,
    getEntryVersion,
    incrementVersion,
} from '../utils/sync-hash.util';
import {
    calculateFrontendHashOptimized,
    calculateEntryHashCached,
} from '../utils/sync-hash-optimized.util';
import { getOrCreateDeviceId } from '../utils/device-id.util';
import { DeviceManagementService } from '$lib/services/device-management.service.svelte';

// ========================================
// Constants
// ========================================

/** Delay before initializing periodic sync (ms) */
const SYNC_INIT_DELAY_MS = 1000;

/** Milliseconds per minute for interval calculations */
const MS_PER_MINUTE = 60 * 1000;

/** Sync endpoint path - uses PocketBase custom endpoint or collection */
const SYNC_ENDPOINT = '/api/collections/stream_sync/records';

// ========================================
// Types
// ========================================

export interface SyncResult {
    sync_status: 'synced' | 'conflicted' | 'error';
    added: number;
    updated: number;
    deleted: number;
    conflicts?: number;
    error?: string;
}

// ========================================
// Service Implementation
// ========================================

class JournalVersionSyncServiceImpl {
    // Private state
    #autoSyncInterval: NodeJS.Timeout | null = null;
    #syncInProgress = false;
    #lastIntervalMinutes: number | null = null;
    #currentSyncState: StreamSyncState | null = null;

    // ========================================
    // Initialization
    // ========================================

    constructor() {
        if (browser) {
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
     */
    #updatePeriodicSync(): void {
        const settings = SettingsService.journal;

        // Only update if interval changed
        if (this.#lastIntervalMinutes === settings.autoSyncInterval) {
            return;
        }

        this.#lastIntervalMinutes = settings.autoSyncInterval;
        this.#setupPeriodicSync(settings.autoSyncInterval);
    }

    /**
     * Setup periodic auto-sync based on interval setting.
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
            const currentSettings = SettingsService.journal;
            if (currentSettings.syncEnabled && NetworkService.isOnline) {
                // Check for conflicts before syncing
                this.#checkAndSync();
            }
        }, intervalMs);

        console.log(`[JournalVersionSync] Periodic sync enabled: every ${intervalMinutes} minutes`);
    }

    /**
     * Check for conflicts and sync if none exist.
     */
    async #checkAndSync(): Promise<void> {
        const userId = authService.user?.id;
        if (!userId) return;

        const hasConflict = await JournalSyncStateService.hasPendingConflict(userId);
        if (hasConflict) {
            console.log('[JournalVersionSync] Conflict pending, skipping sync');
            return;
        }

        await this.sync();
    }

    /**
     * Check if sync is enabled.
     */
    #isSyncEnabled(): boolean {
        return SettingsService.journal.syncEnabled;
    }

    // ========================================
    // Sync State Management
    // ========================================

    /**
     * Get or initialize sync state for current user.
     */
    async #getOrInitSyncState(): Promise<StreamSyncState> {
        const userId = authService.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        let syncState = await JournalSyncStateService.getSyncState(userId);

        if (!syncState) {
            // Initialize new sync state
            const now = new Date().toISOString();
            const deviceId = await getOrCreateDeviceId();
            syncState = {
                id: userId, // Use user ID as primary key
                user: userId,
                device_id: deviceId,
                frontend_version: 0,
                frontend_hash: '',
                frontend_entry_count: 0,
                backend_version: 0,
                backend_hash: '',
                backend_entry_count: 0,
                sync_status: 'synced',
                last_sync_time: now,
                created: now,
                updated: now,
            };
            await JournalSyncStateService.saveSyncState(syncState);
        }

        this.#currentSyncState = syncState;
        return syncState;
    }

    /**
     * Update local sync state after successful sync.
     */
    async #updateLocalSyncState(
        backendVersion: number,
        backendHash: string,
        backendEntryCount: number
    ): Promise<void> {
        const userId = authService.user?.id;
        if (!userId) return;

        const entries = await JournalStorageService.getAllEntries();
        const frontendHash = await calculateFrontendHash(entries);

        await JournalSyncStateService.updateSyncState(userId, {
            frontend_version: backendVersion,
            frontend_hash: frontendHash,
            frontend_entry_count: entries.length,
            backend_version: backendVersion,
            backend_hash: backendHash,
            backend_entry_count: backendEntryCount,
            sync_status: 'synced',
            last_sync_time: new Date().toISOString(),
        });
    }

    // ========================================
    // Entry Version Management
    // ========================================

    /**
     * Prepare entry for save by updating version and hash.
     * Call this before saving any entry locally.
     */
    async prepareEntryForSave(entry: LocalStreamEntry): Promise<LocalStreamEntry> {
        return prepareEntryForSync(entry);
    }

    // ========================================
    // Main Sync Method
    // ========================================

    /**
     * Perform version-based sync.
     * 
     * This is the single entry point for all sync operations.
     * Handles conflict detection and blocking.
     * 
     * @returns Sync result with status and counts
     * @throws Error if sync fails
     */
    async sync(): Promise<SyncResult> {
        // Check if sync is enabled
        if (!this.#isSyncEnabled()) {
            console.log('[JournalVersionSync] Sync disabled');
            return {
                sync_status: 'error',
                added: 0,
                updated: 0,
                deleted: 0,
                error: 'Sync is disabled',
            };
        }

        // Check for pending conflicts
        const userId = authService.user?.id;
        if (!userId) {
            return {
                sync_status: 'error',
                added: 0,
                updated: 0,
                deleted: 0,
                error: 'User not authenticated',
            };
        }

        const hasConflict = await JournalSyncStateService.hasPendingConflict(userId);
        if (hasConflict) {
            console.log('[JournalVersionSync] Conflict pending, sync blocked');
            toast.error('Please resolve conflicts before syncing');
            return {
                sync_status: 'conflicted',
                added: 0,
                updated: 0,
                deleted: 0,
                conflicts: 1,
            };
        }

        // Check network
        if (!NetworkService.isOnline) {
            console.log('[JournalVersionSync] Offline, cannot sync');
            return {
                sync_status: 'error',
                added: 0,
                updated: 0,
                deleted: 0,
                error: 'Offline',
            };
        }

        // Prevent concurrent syncs
        if (this.#syncInProgress) {
            console.log('[JournalVersionSync] Sync already in progress');
            return {
                sync_status: 'error',
                added: 0,
                updated: 0,
                deleted: 0,
                error: 'Sync in progress',
            };
        }

        this.#syncInProgress = true;
        const startTime = Date.now();

        try {
            // Get or initialize sync state
            const syncState = await this.#getOrInitSyncState();

            // Get all local entries
            const localEntries = await JournalStorageService.getAllEntries();

            // Calculate frontend state (using optimized version for better performance)
            // For < 1000 entries, both are fast. For larger datasets, optimized is much faster.
            const frontendHash = localEntries.length > 1000
                ? await calculateFrontendHashOptimized(localEntries)
                : await calculateFrontendHash(localEntries);
            const frontendVersion = syncState.frontend_version;
            const frontendEntryCount = localEntries.length;

            // Prepare entries for sync (ensure versions and hashes are up to date)
            // Use cached hash calculation for better performance
            const entriesToSync = await Promise.all(
                localEntries.map(async (entry) => {
                    // Only recalculate hash if entry changed
                    const currentVersion = getEntryVersion(entry);
                    const lastSyncedVersion = entry.last_synced_version || 0;
                    
                    if (currentVersion > lastSyncedVersion || !entry.content_hash) {
                        // Entry changed, recalculate hash
                        const contentHash = await calculateEntryHashCached(entry);
                        const newVersion = incrementVersion(currentVersion - 1);
                        return {
                            ...entry,
                            version: newVersion,
                            content_hash: contentHash,
                        };
                    }
                    
                    // Entry unchanged, use existing hash
                    return entry;
                })
            );

            // Track deleted entries (entries that were synced but no longer exist locally)
            // This is a simplified approach - in production, you'd track deletions separately
            const deletedEntryIds: string[] = [];
            // TODO: Implement proper deletion tracking

            // Get or create device ID
            const deviceId = await getOrCreateDeviceId();

            // Build sync request
            const syncRequest: SyncRequest = {
                user_id: userId,
                device_id: deviceId,
                frontend_version: frontendVersion,
                frontend_hash: frontendHash,
                frontend_entry_count: frontendEntryCount,
                entries: entriesToSync.map(e => {
                    // Remove local-only fields for sync
                    const { syncStatus, lastModified, ...entry } = e;
                    return entry;
                }),
                deleted_entry_ids: deletedEntryIds,
            };

            console.log('[JournalVersionSync] Sending sync request', {
                frontend_version: frontendVersion,
                frontend_hash: frontendHash.substring(0, 8) + '...',
                entry_count: frontendEntryCount,
            });

            // Call sync endpoint
            // TODO: Replace with custom backend endpoint when available
            // For now, we'll use PocketBase's HTTP API directly
            // The backend should implement POST /api/streams/sync endpoint
            const syncUrl = `${pb.baseUrl}/api/streams/sync`;
            
            const response = await fetch(syncUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
                },
                body: JSON.stringify(syncRequest),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Sync failed: ${response.status} ${errorText}`);
            }

            const syncResponse: SyncResponse = await response.json();

            // Handle sync response
            if (syncResponse.sync_status === 'conflicted') {
                // Store conflict in sync state
                await JournalSyncStateService.updateSyncState(userId, {
                    sync_status: 'conflicted',
                    conflict_type: syncResponse.conflict_details?.type as any,
                    conflict_details: syncResponse.conflict_details,
                    resolution_status: 'pending',
                    last_sync_time: new Date().toISOString(),
                });

                console.log('[JournalVersionSync] Conflict detected', syncResponse.conflict_details);
                toast.error('Sync conflict detected. Please resolve before continuing.');

                // Dispatch conflict event
                if (browser) {
                    window.dispatchEvent(new CustomEvent('journal-sync-conflicted', {
                        detail: syncResponse.conflict_details,
                    }));
                }

                return {
                    sync_status: 'conflicted',
                    added: 0,
                    updated: 0,
                    deleted: 0,
                    conflicts: syncResponse.conflict_details?.conflicting_entry_ids.length || 0,
                };
            }

            // Sync successful - apply changes
            let added = 0;
            let updated = 0;
            let deleted = 0;

            // Add new entries
            if (syncResponse.entries_to_add) {
                for (const entry of syncResponse.entries_to_add) {
                    const localEntry: LocalStreamEntry = {
                        ...entry,
                        syncStatus: 'synced',
                        lastModified: Date.now(),
                    };
                    await JournalStorageService.saveEntry(localEntry);
                    added++;
                }
            }

            // Update existing entries
            if (syncResponse.entries_to_update) {
                for (const entry of syncResponse.entries_to_update) {
                    const localEntry: LocalStreamEntry = {
                        ...entry,
                        syncStatus: 'synced',
                        lastModified: Date.now(),
                    };
                    await JournalStorageService.saveEntry(localEntry);
                    updated++;
                }
            }

            // Delete entries
            if (syncResponse.entries_to_delete) {
                for (const entryId of syncResponse.entries_to_delete) {
                    await JournalStorageService.deleteEntry(entryId);
                    deleted++;
                }
            }

            // Update sync state
            await this.#updateLocalSyncState(
                syncResponse.new_version || syncResponse.backend_version,
                syncResponse.backend_hash,
                syncResponse.backend_entry_count
            );

            // Update device's last_sync timestamp
            await DeviceManagementService.updateLastSync(deviceId);

            const duration = Date.now() - startTime;
            console.log(
                `[JournalVersionSync] Sync completed in ${duration}ms: ${added} added, ${updated} updated, ${deleted} deleted`
            );

            // Dispatch success event
            if (browser) {
                window.dispatchEvent(new CustomEvent('journal-synced'));
            }

            return {
                sync_status: 'synced',
                added,
                updated,
                deleted,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[JournalVersionSync] Sync failed:', errorMessage, error);
            toast.error('Failed to sync entries');

            return {
                sync_status: 'error',
                added: 0,
                updated: 0,
                deleted: 0,
                error: errorMessage,
            };
        } finally {
            this.#syncInProgress = false;
            this.#updatePeriodicSync();
        }
    }

    // ========================================
    // Conflict Resolution
    // ========================================

    /**
     * Get current conflict state.
     */
    async getConflictState(): Promise<StreamSyncState | null> {
        const userId = authService.user?.id;
        if (!userId) return null;

        const state = await JournalSyncStateService.getSyncState(userId);
        if (state?.sync_status === 'conflicted') {
            return state;
        }
        return null;
    }

    /**
     * Resolve conflict by choosing a resolution strategy.
     * 
     * @param resolution - Resolution choice
     * @returns Updated sync result
     */
    async resolveConflict(
        resolution: 'use_frontend' | 'use_backend' | 'merge' | 'manual'
    ): Promise<SyncResult> {
        const userId = authService.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        // Update resolution status
        await JournalSyncStateService.updateSyncState(userId, {
            resolution_status: 'resolved',
            resolution_choice: resolution,
            resolution_timestamp: new Date().toISOString(),
        });

        // Apply resolution based on choice
        // TODO: Implement resolution logic based on choice
        // For now, just clear conflict and retry sync
        await JournalSyncStateService.updateSyncState(userId, {
            sync_status: 'synced',
            resolution_status: undefined,
        });

        // Retry sync
        return this.sync();
    }

    // ========================================
    // Public API
    // ========================================

    /**
     * Save an entry locally and prepare for sync.
     * 
     * This is the main method to use when creating/updating entries.
     * It updates version and hash automatically.
     * 
     * @param entry - Entry to save
     */
    async saveEntry(entry: LocalStreamEntry): Promise<void> {
        // Prepare entry (update version and hash)
        const prepared = await this.prepareEntryForSave(entry);

        // Save locally
        await JournalStorageService.saveEntry(prepared);

        // Trigger sync if online and no conflicts
        if (NetworkService.isOnline && this.#isSyncEnabled()) {
            const userId = authService.user?.id;
            if (userId) {
                const hasConflict = await JournalSyncStateService.hasPendingConflict(userId);
                if (!hasConflict) {
                    // Trigger sync in background (don't wait)
                    this.sync().catch(error => {
                        console.error('[JournalVersionSync] Background sync failed:', error);
                    });
                }
            }
        }
    }

    /**
     * Delete an entry locally and prepare for sync.
     * 
     * @param entryId - ID of entry to delete
     * @param cascade - Whether to delete child entries (default: true)
     */
    async deleteEntry(entryId: string, cascade: boolean = true): Promise<void> {
        // Delete locally
        await JournalStorageService.deleteEntry(entryId);

        // Delete children if cascade
        if (cascade) {
            const children = await JournalStorageService.getChildEntries(entryId);
            for (const child of children) {
                await this.deleteEntry(child.id, true);
            }
        }

        // Trigger sync if online and no conflicts
        if (NetworkService.isOnline && this.#isSyncEnabled()) {
            const userId = authService.user?.id;
            if (userId) {
                const hasConflict = await JournalSyncStateService.hasPendingConflict(userId);
                if (!hasConflict) {
                    // Trigger sync in background
                    this.sync().catch(error => {
                        console.error('[JournalVersionSync] Background sync failed:', error);
                    });
                }
            }
        }
    }

    /**
     * Get sync status.
     */
    async getSyncStatus(): Promise<{
        hasConflict: boolean;
        lastSyncTime: string | null;
        frontendVersion: number;
        backendVersion: number;
    }> {
        const userId = authService.user?.id;
        if (!userId) {
            return {
                hasConflict: false,
                lastSyncTime: null,
                frontendVersion: 0,
                backendVersion: 0,
            };
        }

        const state = await JournalSyncStateService.getSyncState(userId);
        if (!state) {
            return {
                hasConflict: false,
                lastSyncTime: null,
                frontendVersion: 0,
                backendVersion: 0,
            };
        }

        return {
            hasConflict: state.sync_status === 'conflicted',
            lastSyncTime: state.last_sync_time,
            frontendVersion: state.frontend_version,
            backendVersion: state.backend_version,
        };
    }

    // ========================================
    // Cleanup
    // ========================================

    /**
     * Cleanup resources on destroy.
     */
    destroy(): void {
        if (this.#autoSyncInterval) {
            clearInterval(this.#autoSyncInterval);
            this.#autoSyncInterval = null;
        }
    }
}

// Export singleton instance
export const JournalVersionSyncService = new JournalVersionSyncServiceImpl();


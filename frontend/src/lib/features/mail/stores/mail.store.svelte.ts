/**
 * Mail Store - Svelte 5 Runes
 * Modern reactive state management for mail authentication and sync status
 */

import { browser } from '$app/environment';
import { pb } from '$lib/config/pocketbase';
import { MailService } from '../services/mail.service';
import type { SyncStatus } from '../types';

class MailStore {
    // Reactive state using $state rune
    isAuthenticated = $state(false);
    isLoading = $state(false);
    isAuthenticating = $state(false);
    syncStatus = $state<SyncStatus | null>(null);
    lastChecked = $state<number | null>(null);
    error = $state<string | null>(null);

    // Derived state
    get syncAvailable() {
        return this.isAuthenticated && this.syncStatus !== null;
    }

    get isSyncing() {
        return this.syncStatus?.status === 'in_progress' || this.syncStatus?.status === 'in-progress';
    }

    constructor() {
        // Don't auto-initialize - wait for explicit initialization
        // This prevents API calls before user is authenticated
    }

    /**
     * Initialize the store by checking authentication status
     */
    async initialize() {
        if (this.isLoading) {
            return;
        }

        this.error = null;

        try {
            await this.checkStatus(true);
        } catch (error) {
            console.error('Failed to initialize mail store:', error);
            this.error = error instanceof Error ? error.message : 'Failed to initialize';
        }
    }

    /**
     * Check the current sync status and authentication
     */
    async checkStatus(forceRefresh = false): Promise<SyncStatus | null> {
        if (!forceRefresh && this.isLoading) {
            return this.syncStatus;
        }

        this.isLoading = true;
        this.error = null;

        try {
            const status = await MailService.checkStatus();
            
            if (status) {
                // Use updateSyncStatus to preserve existing message_count if API doesn't return it
                // This ensures we don't lose data when refreshing status
                this.updateSyncStatus(status);
                this.isAuthenticated = true;
                this.lastChecked = Date.now();
            } else {
                this.isAuthenticated = false;
                this.syncStatus = null;
            }

            return status;
        } catch (error) {
            // 404 and 401 mean not authenticated, which is fine
            if (error && typeof error === 'object' && 'status' in error && (error.status === 404 || error.status === 401)) {
                this.isAuthenticated = false;
                this.syncStatus = null;
                return null;
            }

            this.error = error instanceof Error ? error.message : 'Failed to check status';
            console.error('Failed to check mail status:', error);
            return null;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Start the OAuth authentication flow
     */
    async startAuth(): Promise<string | null> {
        if (this.isAuthenticating) {
            return null;
        }

        this.isAuthenticating = true;
        this.error = null;

        try {
            const authUrl = await MailService.startAuth();
            if (!authUrl) {
                throw new Error('No authentication URL received');
            }
            // Keep isAuthenticating true - it will be reset in completeAuth or on error
            return authUrl;
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Failed to start authentication';
            this.isAuthenticating = false; // Reset on error
            console.error('Failed to start auth:', error);
            return null;
        }
    }

    /**
     * Complete OAuth authentication flow
     */
    async completeAuth(code: string, mailSyncId?: string): Promise<boolean> {
        this.error = null;

        try {
            await MailService.completeAuth(code, mailSyncId);
            // Check status after successful auth
            await this.checkStatus(true);
            // Reset authenticating state after successful completion
            this.isAuthenticating = false;
            return true;
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Failed to complete authentication';
            this.isAuthenticating = false;
            console.error('Failed to complete auth:', error);
            return false;
        }
    }

    /**
     * Trigger a mail synchronization
     */
    async syncMails(): Promise<void> {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        if (this.isSyncing) {
            return;
        }

        this.error = null;

        try {
            await MailService.syncMails();
            // Status will be updated via realtime subscription
            await this.checkStatus(true);
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Failed to sync mails';
            throw error;
        }
    }

    /**
     * Update sync status (called from realtime subscriptions)
     */
    updateSyncStatus(status: SyncStatus) {
        // Preserve existing message_count if new status doesn't have it
        // Realtime events might not include message_count, so we keep the existing value
        const existingMessageCount = this.syncStatus?.message_count;
        
        // Parse status if it contains error message (format: "failed: <message>")
        if (status.status && status.status.startsWith('failed:')) {
            const parts = status.status.split(':');
            status.status = 'failed';
            if (parts.length > 1) {
                status.error_message = parts.slice(1).join(':').trim();
            }
            // Check if error indicates re-authentication is needed
            if (status.error_message && (
                status.error_message.toLowerCase().includes('re-authenticate') ||
                status.error_message.toLowerCase().includes('token expired') ||
                status.error_message.toLowerCase().includes('inactive')
            )) {
                status.needs_reauth = true;
            }
        } else if (status.status === 'inactive') {
            // Status is already "inactive", set needs reauth
            status.needs_reauth = true;
            if (!status.error_message) {
                status.error_message = 'Token expired - re-authentication required';
            }
        }
        
        // Preserve message_count if not provided in the update
        if (status.message_count === undefined && existingMessageCount !== undefined) {
            status.message_count = existingMessageCount;
        }
        
        this.syncStatus = status;
        this.lastChecked = Date.now();
    }

    /**
     * Reset the store to initial state
     */
    reset() {
        this.isAuthenticated = false;
        this.isLoading = false;
        this.isAuthenticating = false;
        this.syncStatus = null;
        this.lastChecked = null;
        this.error = null;
    }
}

// Export singleton instance
export const mailStore = new MailStore();


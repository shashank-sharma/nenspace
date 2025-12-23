/**
 * Mail Service - Svelte 5 Runes
 * Service layer for mail operations with reactive state management
 */

import { browser } from '$app/environment';
import { pb } from '$lib/config/pocketbase';
import { NetworkService } from '$lib/services/network.service.svelte';
import { FilterBuilder, withErrorHandling } from '$lib/utils';
import type { MailMessage, SyncStatus } from '../types';
import type { RecordModel } from 'pocketbase';

function convertToMailMessage(record: RecordModel): MailMessage {
    return {
        id: record.id,
        message_id: record.message_id,
        thread_id: record.thread_id,
        from: record.from,
        to: record.to,
        subject: record.subject,
        snippet: record.snippet,
        body: record.body,
        is_unread: record.is_unread,
        is_important: record.is_important,
        is_starred: record.is_starred,
        is_spam: record.is_spam,
        is_inbox: record.is_inbox,
        is_trash: record.is_trash,
        is_draft: record.is_draft,
        is_sent: record.is_sent,
        internal_date: record.internal_date,
        received_date: record.received_date,
        created: record.created,
        updated: record.updated
    };
}

class MailServiceImpl {
    // Cache for messages (optional, can be enhanced)
    // Note: Not using $state here since this is a .ts file, not .svelte.ts
    #cache = new Map<string, MailMessage>();

    /**
     * Fetch mail messages with pagination and filtering
     */
    async fetchMails(
        page: number = 1,
        perPage: number = 20,
        options?: {
            searchQuery?: string;
            isUnread?: boolean;
            isStarred?: boolean;
            isInbox?: boolean;
            isTrash?: boolean;
        }
    ): Promise<{
        items: MailMessage[];
        totalItems: number;
        page: number;
        perPage: number;
    } | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const filterBuilder = FilterBuilder.create();

            // Add search query filter
            if (options?.searchQuery?.trim()) {
                const searchTerm = options.searchQuery.trim();
                // Escape the search term for use in filter strings
                const escapedTerm = searchTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                filterBuilder.or(
                    `subject ~ "${escapedTerm}"`,
                    `from ~ "${escapedTerm}"`,
                    `snippet ~ "${escapedTerm}"`
                );
            }

            // Add boolean filters
            if (options?.isUnread !== undefined) {
                filterBuilder.equals('is_unread', options.isUnread);
            }

            if (options?.isStarred !== undefined) {
                filterBuilder.equals('is_starred', options.isStarred);
            }

            if (options?.isInbox !== undefined) {
                filterBuilder.equals('is_inbox', options.isInbox);
            }

            if (options?.isTrash !== undefined) {
                filterBuilder.equals('is_trash', options.isTrash);
            }

            const filter = filterBuilder.build();

            const response = await pb.collection('mail_messages').getList(page, perPage, {
                sort: '-received_date',
                filter: filter || undefined
            });

            const items = response.items.map(convertToMailMessage);
            
            // Update cache
            items.forEach((item) => {
                this.#cache.set(item.id, item);
            });

            return {
                items,
                totalItems: response.totalItems,
                page: response.page,
                perPage: response.perPage
            };
        } catch (error) {
            console.error('Failed to fetch emails:', error);
            // Return null on error - store will handle error state
            return null;
        }
    }

    /**
     * Get messages with pagination
     */
    async getMessages(
        page: number,
        perPage: number,
        options?: {
            searchQuery?: string;
            isUnread?: boolean;
            isStarred?: boolean;
            isInbox?: boolean;
            isTrash?: boolean;
        }
    ): Promise<{
        items: MailMessage[];
        totalItems: number;
        page: number;
        perPage: number;
    } | null> {
        return this.fetchMails(page, perPage, options);
    }

    /**
     * Get a single mail message with full details including body
     */
    async getMailById(id: string): Promise<MailMessage | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const record = await pb.collection('mail_messages').getOne(id);
            const mail = convertToMailMessage(record);
            
            // Update cache
            this.#cache.set(mail.id, mail);
            
            return mail;
        } catch (error) {
            console.error('Failed to fetch mail by ID:', error);
            return null;
        }
    }

    /**
     * Mark a message as read
     */
    async markAsRead(id: string): Promise<void> {
        const result = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                await pb.collection('mail_messages').update(id, {
                    is_unread: false
                });

                // Update cache
                const cached = this.#cache.get(id);
                if (cached) {
                    this.#cache.set(id, { ...cached, is_unread: false });
                }
            },
            {
                errorMessage: 'Failed to mark message as read',
                successMessage: 'Message marked as read',
                showToast: false, // Let store handle toasts
                logErrors: true
            }
        );
        if (result === null) {
            throw new Error('Failed to mark message as read');
        }
    }

    /**
     * Toggle star status
     */
    async toggleStar(id: string, isStarred: boolean): Promise<void> {
        const result = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                await pb.collection('mail_messages').update(id, {
                    is_starred: isStarred
                });

                // Update cache
                const cached = this.#cache.get(id);
                if (cached) {
                    this.#cache.set(id, { ...cached, is_starred: isStarred });
                }
            },
            {
                errorMessage: 'Failed to update star status',
                successMessage: isStarred ? 'Message starred' : 'Message unstarred',
                showToast: false, // Let store handle toasts
                logErrors: true
            }
        );
        if (result === null) {
            throw new Error('Failed to update star status');
        }
    }

    /**
     * Move message to trash
     */
    async moveToTrash(id: string): Promise<void> {
        const result = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                await pb.collection('mail_messages').update(id, {
                    is_trash: true,
                    is_inbox: false
                });

                // Update cache
                const cached = this.#cache.get(id);
                if (cached) {
                    this.#cache.set(id, { ...cached, is_trash: true, is_inbox: false });
                }
            },
            {
                errorMessage: 'Failed to move message to trash',
                successMessage: 'Message moved to trash',
                showToast: false, // Let store handle toasts
                logErrors: true
            }
        );
        if (result === null) {
            throw new Error('Failed to move message to trash');
        }
    }

    /**
     * Archive message (remove from inbox)
     */
    async moveToArchive(id: string): Promise<void> {
        const result = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                await pb.collection('mail_messages').update(id, {
                    is_inbox: false
                });

                // Update cache
                const cached = this.#cache.get(id);
                if (cached) {
                    this.#cache.set(id, { ...cached, is_inbox: false });
                }
            },
            {
                errorMessage: 'Failed to archive message',
                successMessage: 'Message archived',
                showToast: false, // Let store handle toasts
                logErrors: true
            }
        );
        if (result === null) {
            throw new Error('Failed to archive message');
        }
    }

    /**
     * Update message with partial data
     */
    async updateMessage(id: string, data: Partial<MailMessage>): Promise<void> {
        await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                await pb.collection('mail_messages').update(id, data);

                // Update cache
                const cached = this.#cache.get(id);
                if (cached) {
                    this.#cache.set(id, { ...cached, ...data });
                }
            },
            {
                errorMessage: 'Failed to update message',
                logErrors: true
            }
        );
    }

    /**
     * Get sync status from API
     */
    async getSyncStatus(): Promise<SyncStatus | null> {
        try {
            const record = await pb.collection('mail_sync').getFirstListItem('');
            return {
                id: record.id,
                last_synced: record.last_synced,
                message_count: record.message_count || 0,
                status: record.sync_status || record.status || 'unknown'
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Check sync status via API endpoint
     */
    async checkStatus(): Promise<SyncStatus | null> {
        if (!NetworkService.isOnline) {
            throw new Error('Network is offline');
        }

        try {
            const response = await pb.send('/api/mail/sync/status', {
                method: 'GET'
            }) as any;
            
            // Backend RespondSuccess wraps in: { success: true, data: { id, status, last_synced, message_count } }
            // PocketBase's pb.send may or may not unwrap it, so check both
            let statusData = response;
            
            if (response && typeof response === 'object' && 'data' in response) {
                statusData = response.data;
            }
            
            if (!statusData || typeof statusData !== 'object' || !statusData.id) {
                return null;
            }
            
            return {
                id: statusData.id,
                status: statusData.status || 'unknown',
                last_synced: statusData.last_synced || new Date().toISOString(),
                message_count: statusData.message_count || 0,
                error_message: statusData.error_message,
                is_active: statusData.is_active !== undefined ? statusData.is_active : true,
                needs_reauth: statusData.needs_reauth || false
            };
        } catch (error) {
            // 404 means not authenticated, which is expected and not an error
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
                return null;
            }
            console.error('Failed to check sync status:', error);
            throw error;
        }
    }

    /**
     * Start OAuth authentication flow
     */
    async startAuth(): Promise<string | null> {
        if (!NetworkService.isOnline) {
            throw new Error('Network is offline');
        }

        try {
            const response = await pb.send('/api/mail/auth/redirect', {
                method: 'GET'
            }) as any;
            
            // Handle PocketBase response structure: { data: { url: string }, success: true }
            // pb.send may unwrap it, so check both structures
            const url = response?.data?.url || response?.url;
            
            if (!url || typeof url !== 'string') {
                console.error('Invalid response structure:', response);
                throw new Error('No auth URL received from server');
            }
            
            return url;
        } catch (error) {
            console.error('Failed to start authentication:', error);
            throw error;
        }
    }

    /**
     * Complete OAuth authentication flow
     */
    async completeAuth(code: string, mailSyncId?: string): Promise<void> {
        if (!NetworkService.isOnline) {
            throw new Error('Network is offline');
        }

        if (!code) {
            throw new Error('Authorization code is required');
        }

        try {
            const body: any = { code, provider: 'google' };
            if (mailSyncId) {
                body.mail_sync_id = mailSyncId;
            }
            await pb.send('/api/mail/auth/callback', {
                method: 'POST',
                body
            });
        } catch (error) {
            console.error('Failed to complete authentication:', error);
            throw error;
        }
    }

    /**
     * Get inactive mail syncs for the user
     */
    async getInactiveSyncs(): Promise<Array<{ id: string; provider: string; sync_status: string; last_synced: string; created: string }>> {
        if (!NetworkService.isOnline) {
            throw new Error('Network is offline');
        }

        try {
            const response = await pb.send('/api/mail/sync/inactive', {
                method: 'GET'
            }) as any;
            
            let data = response;
            if (response && typeof response === 'object' && 'data' in response) {
                data = response.data;
            }
            
            return data?.syncs || [];
        } catch (error) {
            console.error('Failed to get inactive syncs:', error);
            // 404 means no inactive syncs, which is fine
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
                return [];
            }
            throw error;
        }
    }

    /**
     * Trigger mail synchronization
     */
    async syncMails(): Promise<void> {
        await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                await pb.send('/api/mail/sync', { method: 'POST' });
            },
            {
                errorMessage: 'Failed to sync emails',
                successMessage: 'Email sync started',
                showToast: false, // Let store handle toasts
                logErrors: true
            }
        );
    }

    /**
     * Get cached message by ID
     */
    getCachedMessage(id: string): MailMessage | undefined {
        return this.#cache.get(id);
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.#cache.clear();
    }
}

// Export singleton instance
export const MailService = new MailServiceImpl();
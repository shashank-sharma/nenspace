/**
 * Mail Messages Store - Svelte 5 Runes
 * Modern reactive state management for mail messages
 */

import { browser } from '$app/environment';
import { pb } from '$lib/config/pocketbase';
import { MailService } from '../services/mail.service';
import type { MailMessage } from '../types';

export interface MailFilter {
    searchQuery?: string;
    isUnread?: boolean;
    isStarred?: boolean;
    isImportant?: boolean;
    isInbox?: boolean;
    isTrash?: boolean;
    isDraft?: boolean;
    isSent?: boolean;
}

export interface MailSortOptions {
    field: 'received_date' | 'subject' | 'from';
    order: 'asc' | 'desc';
}

class MailMessagesStore {
    // Reactive state using $state rune
    messages = $state<MailMessage[]>([]);
    selectedMail = $state<MailMessage | null>(null);
    isLoading = $state(false);
    isRefreshing = $state(false);
    totalItems = $state(0);
    page = $state(1);
    perPage = $state(20);
    error = $state<string | null>(null);
    hasAttemptedFetch = $state(false); // Track if we've attempted to fetch at least once
    hasMorePages = $state(true); // Track if there are more pages to load

    // Filter and sort state
    filter = $state<MailFilter>({});
    sortOptions = $state<MailSortOptions>({
        field: 'received_date',
        order: 'desc'
    });

    // Derived state
    get unreadCount() {
        return this.messages.filter((m) => m.is_unread).length;
    }

    get starredCount() {
        return this.messages.filter((m) => m.is_starred).length;
    }

    get hasMessages() {
        return this.messages.length > 0;
    }

    get filteredMessages() {
        // Server-side filtering is now handled in fetchMails
        // This getter only handles client-side sorting and additional filters
        let result = [...this.messages];

        // Apply additional client-side filters that aren't handled server-side
        if (this.filter.isImportant !== undefined) {
            result = result.filter((m) => m.is_important === this.filter.isImportant);
        }

        if (this.filter.isDraft !== undefined) {
            result = result.filter((m) => m.is_draft === this.filter.isDraft);
        }

        if (this.filter.isSent !== undefined) {
            result = result.filter((m) => m.is_sent === this.filter.isSent);
        }

        // Apply sorting (client-side sorting for now, can be moved to server later)
        result.sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;

            switch (this.sortOptions.field) {
                case 'received_date':
                    aValue = new Date(a.received_date).getTime();
                    bValue = new Date(b.received_date).getTime();
                    break;
                case 'subject':
                    aValue = a.subject.toLowerCase();
                    bValue = b.subject.toLowerCase();
                    break;
                case 'from':
                    aValue = a.from.toLowerCase();
                    bValue = b.from.toLowerCase();
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) {
                return this.sortOptions.order === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return this.sortOptions.order === 'asc' ? 1 : -1;
            }
            return 0;
        });

        return result;
    }

    /**
     * Fetch mail messages with pagination
     */
    async fetchMails(reset = false): Promise<void> {
        if (this.isLoading && !reset) {
            return;
        }

        if (!this.hasMorePages && !reset && this.hasAttemptedFetch) {
            return;
        }

        if (reset) {
            this.page = 1;
            this.messages = [];
            this.hasMorePages = true;
        }

        this.isLoading = true;
        this.error = null;
        this.hasAttemptedFetch = true;

        try {
            const options = {
                searchQuery: this.filter.searchQuery,
                isUnread: this.filter.isUnread,
                isStarred: this.filter.isStarred,
                isInbox: this.filter.isInbox,
                isTrash: this.filter.isTrash,
            };

            const result = await MailService.getMessages(this.page, this.perPage, options);

            if (!result) {
                this.error = 'Failed to fetch mails';
                this.hasMorePages = false;
                this.isLoading = false;
                return;
            }

            if (result.items.length === 0) {
                this.hasMorePages = false;
                if (reset) {
                    this.messages = [];
                }
                this.isLoading = false;
                return;
            }

            if (reset) {
                this.messages = result.items;
            } else {
                this.messages = [...this.messages, ...result.items];
            }

            this.totalItems = result.totalItems;

            const totalPages = Math.ceil(result.totalItems / this.perPage);
            this.hasMorePages = this.page < totalPages;

            if (this.hasMorePages && result.items.length > 0) {
                this.page = this.page + 1;
            } else {
                this.hasMorePages = false;
            }
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Failed to fetch mails';
            this.hasMorePages = false;
            console.error('Failed to fetch mails:', error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Refresh mail messages (force reload)
     */
    async refreshMails(): Promise<void> {
        this.isRefreshing = true;
        try {
            await this.fetchMails(true);
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Search mail messages (server-side search)
     */
    async searchMails(query: string): Promise<void> {
        // Prevent search if already loading
        if (this.isLoading) {
            return;
        }
        
        this.filter = { ...this.filter, searchQuery: query };
        // Trigger server-side search by fetching with new filter
        await this.fetchMails(true);
    }

    /**
     * Select a mail message
     */
    async selectMail(mail: MailMessage | null) {
        if (!mail) {
            this.selectedMail = null;
            return;
        }

        // Set the mail immediately for UI responsiveness
        this.selectedMail = mail;
        
        // Auto-mark as read when selected
        if (mail.is_unread) {
            this.markAsRead(mail.id);
        }

        // Fetch full mail details with body if not already loaded
        // Check if body is missing or empty
        if (!mail.body || mail.body.trim() === '') {
            try {
                const fullMail = await MailService.getMailById(mail.id);
                if (fullMail && fullMail.body) {
                    // Update the selected mail with the full body
                    this.selectedMail = { ...this.selectedMail, body: fullMail.body };
                    // Also update in the messages array
                    this.messages = this.messages.map((m) =>
                        m.id === mail.id ? { ...m, body: fullMail.body } : m
                    );
                }
            } catch (error) {
                console.error('Failed to fetch full mail details:', error);
            }
        }
    }

    /**
     * Mark a message as read
     */
    async markAsRead(id: string): Promise<void> {
        try {
            await MailService.markAsRead(id);
            // Update local state
            this.messages = this.messages.map((m) =>
                m.id === id ? { ...m, is_unread: false } : m
            );
            if (this.selectedMail?.id === id) {
                this.selectedMail = { ...this.selectedMail, is_unread: false };
            }
        } catch (error) {
            console.error('Failed to mark as read:', error);
            // Error already handled by service layer
        }
    }

    /**
     * Toggle star status
     */
    async toggleStar(id: string): Promise<void> {
        const message = this.messages.find((m) => m.id === id);
        if (!message) return;

        const newStarred = !message.is_starred;

        try {
            await MailService.toggleStar(id, newStarred);
            // Update local state
            this.messages = this.messages.map((m) =>
                m.id === id ? { ...m, is_starred: newStarred } : m
            );
            if (this.selectedMail?.id === id) {
                this.selectedMail = { ...this.selectedMail, is_starred: newStarred };
            }
        } catch (error) {
            console.error('Failed to toggle star:', error);
            // Error already handled by service layer
        }
    }

    /**
     * Move message to trash
     */
    async moveToTrash(id: string): Promise<void> {
        try {
            await MailService.moveToTrash(id);
            // Update local state
            this.messages = this.messages.map((m) =>
                m.id === id ? { ...m, is_trash: true, is_inbox: false } : m
            );
            if (this.selectedMail?.id === id) {
                this.selectMail(null);
            }
        } catch (error) {
            console.error('Failed to move to trash:', error);
            // Error already handled by service layer
        }
    }

    /**
     * Archive message (remove from inbox)
     */
    async moveToArchive(id: string): Promise<void> {
        try {
            await MailService.moveToArchive(id);
            // Update local state
            this.messages = this.messages.map((m) =>
                m.id === id ? { ...m, is_inbox: false } : m
            );
            if (this.selectedMail?.id === id) {
                this.selectMail(null);
            }
        } catch (error) {
            console.error('Failed to archive:', error);
            // Error already handled by service layer
        }
    }

    /**
     * Update filter
     */
    setFilter(filter: Partial<MailFilter>) {
        this.filter = { ...this.filter, ...filter };
    }

    /**
     * Clear filter
     */
    clearFilter() {
        this.filter = {};
    }

    /**
     * Set sort options
     */
    setSortOptions(options: Partial<MailSortOptions>) {
        this.sortOptions = { ...this.sortOptions, ...options };
    }

    /**
     * Add or update message (from realtime subscription)
     */
    upsertMessage(message: MailMessage) {
        const index = this.messages.findIndex((m) => m.id === message.id);
        if (index >= 0) {
            this.messages[index] = message;
        } else {
            // New message added - increment totalItems if we're tracking it
            this.messages = [message, ...this.messages];
            // Only increment if we have a valid totalItems count (not 0 or uninitialized)
            if (this.totalItems > 0) {
                this.totalItems = this.totalItems + 1;
            }
        }
    }

    /**
     * Remove message (from realtime subscription)
     */
    removeMessage(id: string) {
        const wasPresent = this.messages.some((m) => m.id === id);
        this.messages = this.messages.filter((m) => m.id !== id);
        
        // Decrement totalItems if message was actually removed and we're tracking it
        if (wasPresent && this.totalItems > 0) {
            this.totalItems = Math.max(0, this.totalItems - 1);
        }
        
        if (this.selectedMail?.id === id) {
            this.selectMail(null);
        }
    }

    /**
     * Reset the store to initial state
     */
    reset() {
        this.messages = [];
        this.selectedMail = null;
        this.isLoading = false;
        this.isRefreshing = false;
        this.totalItems = 0;
        this.page = 1;
        this.error = null;
        this.hasAttemptedFetch = false;
        this.hasMorePages = true;
        this.filter = {};
        this.sortOptions = {
            field: 'received_date',
            order: 'desc'
        };
    }
}

// Export singleton instance
export const mailMessagesStore = new MailMessagesStore();


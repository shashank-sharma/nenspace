/**
 * Calendar Store - Svelte 5 Runes
 * Modern reactive state management for calendar feature
 */

import { browser } from '$app/environment';
import { CalendarService } from '../services/calendar.service';
import type { CalendarEvent, CalendarSync } from '../types';

class CalendarStore {
    // Reactive state using $state rune
    events = $state<CalendarEvent[]>([]);
    calendars = $state<CalendarSync[]>([]);
    isLoading = $state(false);
    error = $state<string | null>(null);
    syncStatus = $state<CalendarSync | null>(null);
    lastChecked = $state<number | null>(null);
    private checkStatusPromise: Promise<CalendarSync | null> | null = null; // Prevent concurrent calls
    
    // Derived state
    get hasCalendars() {
        return this.calendars.length > 0;
    }
    
    get isSyncing() {
        return this.syncStatus?.in_progress === true || this.syncStatus?.sync_status === 'syncing';
    }
    
    get syncAvailable() {
        return this.hasCalendars && this.syncStatus !== null;
    }
    
    get upcomingEvents() {
        const now = new Date();
        return this.events
            .filter(event => new Date(event.start) > now)
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
            .slice(0, 5);
    }
    
    async fetchCalendars(): Promise<CalendarSync[]> {
        this.isLoading = true;
        this.error = null;
        
        try {
            const calendars = await CalendarService.getCalendars();
            this.calendars = calendars;
            
            // Update sync status from first active calendar
            if (calendars.length > 0) {
                const activeSync = calendars.find(c => c.is_active);
                if (activeSync) {
                    this.updateSyncStatus(activeSync);
                }
            } else {
                this.syncStatus = null;
            }
            
            return calendars;
        } catch (error) {
            console.error('Failed to fetch calendars:', error);
            this.error = error instanceof Error ? error.message : 'Failed to fetch calendars';
            return [];
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Check the current sync status
     */
    async checkStatus(forceRefresh = false): Promise<CalendarSync | null> {
        // If there's already a pending request, return it instead of making a new one
        if (this.checkStatusPromise && !forceRefresh) {
            return this.checkStatusPromise;
        }

        if (!forceRefresh && this.isLoading) {
            return this.syncStatus;
        }

        this.isLoading = true;
        this.error = null;

        // Create promise and store it to prevent concurrent calls
        this.checkStatusPromise = (async () => {
            try {
                const status = await CalendarService.checkStatus(forceRefresh);
                
                if (status) {
                    this.updateSyncStatus(status);
                    this.lastChecked = Date.now();
                } else {
                    this.syncStatus = null;
                }

                return status;
            } catch (error) {
                // Ignore auto-cancellation errors (these happen when requests are cancelled)
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('autocancelled') || errorMessage.includes('aborted')) {
                    // Return current status if request was cancelled
                    return this.syncStatus;
                }

                // 404 and 401 mean not authenticated, which is fine
                if (error && typeof error === 'object' && 'status' in error && (error.status === 404 || error.status === 401)) {
                    this.syncStatus = null;
                    return null;
                }

                this.error = error instanceof Error ? error.message : 'Failed to check status';
                // Only log non-cancellation errors
                if (!errorMessage.includes('autocancelled') && !errorMessage.includes('aborted')) {
                    console.error('Failed to check calendar status:', error);
                }
                return null;
            } finally {
                this.isLoading = false;
                this.checkStatusPromise = null; // Clear promise after completion
            }
        })();

        return this.checkStatusPromise;
    }
    
    /**
     * Update sync status (called from realtime subscriptions)
     */
    updateSyncStatus(status: CalendarSync) {
        // Parse status if it contains error message (format: "failed: <message>")
        if (status.sync_status && status.sync_status.startsWith('failed:')) {
            const parts = status.sync_status.split(':');
            status.sync_status = 'failed';
        }
        
        this.syncStatus = status;
        this.lastChecked = Date.now();
        
        // Also update in calendars array if it exists there
        const index = this.calendars.findIndex(c => c.id === status.id);
        if (index !== -1) {
            this.calendars[index] = { ...this.calendars[index], ...status };
        }
    }
    
    /**
     * Trigger a calendar synchronization
     */
    async syncCalendars(): Promise<void> {
        if (!this.hasCalendars) {
            throw new Error('No calendars connected');
        }

        if (this.isSyncing) {
            return;
        }

        this.error = null;

        try {
            await CalendarService.triggerSync();
            // Status will be updated via realtime subscription, no need to check manually
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Failed to sync calendars';
            throw error;
        }
    }
    
    async fetchEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
        this.isLoading = true;
        this.error = null;
        
        try {
            const { items } = await CalendarService.getEvents(startDate, endDate);
            this.events = items;
            return items;
        } catch (error) {
            console.error('Failed to fetch events:', error);
            this.error = error instanceof Error ? error.message : 'Failed to fetch events';
            return [];
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Add or update event (from realtime subscription)
     */
    upsertEvent(event: CalendarEvent) {
        const index = this.events.findIndex((e) => e.id === event.id);
        if (index >= 0) {
            // Update existing event
            this.events[index] = event;
        } else {
            // New event added - add to events array
            // Insert in sorted order by start date
            const eventStart = new Date(event.start).getTime();
            const insertIndex = this.events.findIndex(
                (e) => new Date(e.start).getTime() > eventStart
            );
            if (insertIndex === -1) {
                this.events = [...this.events, event];
            } else {
                this.events = [
                    ...this.events.slice(0, insertIndex),
                    event,
                    ...this.events.slice(insertIndex)
                ];
            }
        }
    }
    
    /**
     * Remove event (from realtime subscription)
     */
    removeEvent(id: string) {
        this.events = this.events.filter((e) => e.id !== id);
    }
    
    reset() {
        this.events = [];
        this.calendars = [];
        this.isLoading = false;
        this.error = null;
        this.syncStatus = null;
        this.lastChecked = null;
    }
}

// Export singleton instance
export const calendarStore = new CalendarStore();

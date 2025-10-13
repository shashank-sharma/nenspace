/**
 * Calendar Store - Svelte 5 Runes
 * Modern reactive state management for calendar feature
 */

import { CalendarService } from '../services/calendar.service';
import type { CalendarEvent, CalendarSync } from '../types';

class CalendarStore {
    // Reactive state using $state rune
    events = $state<CalendarEvent[]>([]);
    calendars = $state<CalendarSync[]>([]);
    isLoading = $state(false);
    error = $state<string | null>(null);
    
    // Derived state
    get hasCalendars() {
        return this.calendars.length > 0;
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
            return calendars;
        } catch (error) {
            console.error('Failed to fetch calendars:', error);
            this.error = error instanceof Error ? error.message : 'Failed to fetch calendars';
            return [];
        } finally {
            this.isLoading = false;
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
    
    reset() {
        this.events = [];
        this.calendars = [];
        this.isLoading = false;
        this.error = null;
    }
}

// Export singleton instance
export const calendarStore = new CalendarStore();

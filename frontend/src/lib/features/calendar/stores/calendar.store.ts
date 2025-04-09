import { writable, get } from 'svelte/store';
import type { CalendarEvent, CalendarState, CalendarSync } from '../types';
import { toast } from 'svelte-sonner';
import { CalendarService } from '../services';
import { browser } from '$app/environment';
import type { UnsubscribeFunc } from 'pocketbase';

const createCalendarStore = () => {
    const { subscribe, set, update } = writable<CalendarState>({
        events: [],
        calendars: [],
        isLoading: false,
        isAuthenticating: false,
        error: null,
        view: 'month',
        selectedDate: new Date(),
        selectedEvent: null,
        syncStatus: null,
        lastChecked: null,
        syncAvailable: false,
        subscriptions: {}
    });

    const STATUS_CHECK_INTERVAL = 30000;
    const subscriptions: Record<string, Promise<UnsubscribeFunc>> = {};

    const store = {
        subscribe,
        
        setSelectedEvent: (event: CalendarEvent | null) => update(state => ({ ...state, selectedEvent: event })),
        setView: (view: 'month' | 'week' | 'day') => update(state => ({ ...state, view })),
        setSelectedDate: (date: Date) => update(state => ({ ...state, selectedDate: date })),
        
        getState: () => get({ subscribe }),
        
        fetchAvailableTokens: async () => {
            try {
                return await CalendarService.fetchAvailableTokens();
            } catch (error) {
                console.error("Error fetching tokens:", error);
                toast.error("Failed to fetch available tokens");
                return [];
            }
        },
        
        checkStatus: async (force = false) => {
            const currentState = get({ subscribe });
            const now = Date.now();

            if (!force && currentState.lastChecked) {
                if (now - currentState.lastChecked < STATUS_CHECK_INTERVAL) {
                    return currentState.syncStatus;
                }
            }

            const shouldShowLoading = force || !currentState.lastChecked;
            
            if (shouldShowLoading) {
                update(state => ({ ...state, isLoading: true }));
            }

            try {
                const status = await CalendarService.checkStatus();
                update(state => ({
                    ...state, 
                    isLoading: false,
                    syncStatus: status,
                    lastChecked: now,
                    syncAvailable: !!status
                }));
                return status;
            } catch (error: any) {
                const is404 = error.status === 404;
                update(state => ({ 
                    ...state, 
                    isLoading: false,
                    lastChecked: now,
                    syncAvailable: !is404
                }));
                
                if (!is404) {
                    console.error('Error checking calendar status:', error);
                }
                return null;
            }
        },

        startAuth: async () => {
            update(state => ({ ...state, isAuthenticating: true }));
            try {
                const url = await CalendarService.startAuth();
                if (!url) {
                    toast.error('Failed to start calendar authentication process');
                }
                return url;
            } catch (error) {
                toast.error('Failed to start calendar authentication process');
                return null;
            } finally {
                update(state => ({ ...state, isAuthenticating: false }));
            }
        },

        completeAuth: async (code: string) => {
            try {
                update(state => ({ ...state, isAuthenticating: true }));
                
                const result = await CalendarService.completeAuth(code);
                if (result) {
                    await store.fetchCalendars();
                }
                return result;
            } catch (error) {
                console.error('Auth completion error:', error);
                return false;
            } finally {
                update(state => ({ ...state, isAuthenticating: false }));
            }
        },

        fetchEvents: async (startDate?: Date, endDate?: Date) => {
            update(state => ({ ...state, isLoading: true }));
            try {
                const result = await CalendarService.getEvents(startDate, endDate);
                update(state => ({ ...state, events: result.items, isLoading: false }));
                return result.items;
            } catch (error) {
                console.error('Error fetching events:', error);
                toast.error("Failed to fetch calendar events");
                update(state => ({ 
                    ...state, 
                    error: 'Failed to fetch calendar events',
                    isLoading: false 
                }));
                return [];
            }
        },
        
        fetchCalendars: async () => {
            update(state => ({ ...state, isLoading: true }));
            try {
                const calendars = await CalendarService.getCalendars();
                update(state => ({ ...state, calendars, isLoading: false }));
                
                if (browser) {
                    store.unsubscribeFromAllCalendars();
                    
                    calendars.forEach(calendar => {
                        store.subscribeToCalendarChanges(calendar.id);
                    });
                }
                
                return calendars;
            } catch (error) {
                console.error('Error fetching calendars:', error);
                toast.error("Failed to fetch calendars");
                update(state => ({ 
                    ...state, 
                    error: 'Failed to fetch calendars', 
                    isLoading: false 
                }));
                return [];
            }
        },
        
        createEvent: async (eventData: Partial<CalendarEvent>) => {
            try {
                await CalendarService.createEvent(eventData);
                await store.fetchEvents();
                toast.success("Event created");
                return true;
            } catch (error) {
                console.error('Error creating event:', error);
                toast.error("Failed to create event");
                return false;
            }
        },
        
        updateEvent: async (event: CalendarEvent) => {
            try {
                await CalendarService.updateEvent(event.id, event);
                await store.fetchEvents();
                toast.success("Event updated");
                return true;
            } catch (error) {
                console.error('Error updating event:', error);
                toast.error("Failed to update event");
                return false;
            }
        },
        
        deleteEvent: async (eventId: string) => {
            try {
                await CalendarService.deleteEvent(eventId);
                await store.fetchEvents();
                toast.success("Event deleted");
                return true;
            } catch (error) {
                console.error('Error deleting event:', error);
                toast.error("Failed to delete event");
                return false;
            }
        },
        
        createCalendarToken: async (name: string, type: string, tokenId: string) => {
            try {
                const success = await CalendarService.createCalendarToken(name, type, tokenId);
                if (success) {
                    toast.success("Calendar token created successfully");
                    await store.fetchCalendars(); // This will also handle subscriptions
                    return true;
                } else {
                    toast.error("Failed to create calendar token");
                    return false;
                }
            } catch (error) {
                console.error('Error creating calendar token:', error);
                toast.error("Failed to create calendar token");
                return false;
            }
        },
        
        subscribeToCalendarChanges: (calendarId: string) => {
            if (calendarId in subscriptions) {
                console.warn(`Already subscribed to calendar: ${calendarId}`);
                return;
            }
            
            console.log(`Subscribing to calendar changes: ${calendarId}`);
            
            try {
                subscriptions[calendarId] = CalendarService.subscribeToRecord(
                    'calendar_sync',
                    calendarId,
                    async (data) => {
                        console.log('Calendar sync updated:', data);
                        await store.fetchEvents();
                        update(state => ({
                            ...state,
                            calendars: state.calendars.map(cal => 
                                cal.id === data.record.id ? data.record : cal
                            )
                        }));
                    }
                );
            } catch (error) {
                console.error(`Error subscribing to calendar ${calendarId}:`, error);
            }
        },
        
        unsubscribeFromCalendar: async (calendarId: string) => {
            if (calendarId in subscriptions) {
                try {
                    const unsubscribeFn = await subscriptions[calendarId];
                    unsubscribeFn();
                    delete subscriptions[calendarId];
                    console.log(`Unsubscribed from calendar: ${calendarId}`);
                } catch (error) {
                    console.error(`Error unsubscribing from calendar ${calendarId}:`, error);
                }
            }
        },
        
        unsubscribeFromAllCalendars: async () => {
            for (const calendarId in subscriptions) {
                await store.unsubscribeFromCalendar(calendarId);
            }
        },
        
        triggerSync: async () => {
            try {
                await CalendarService.triggerSync();
                toast.success("Calendar sync initiated");
                return true;
            } catch (error) {
                console.error('Error triggering sync:', error);
                toast.error("Failed to trigger calendar sync");
                return false;
            }
        },
        
        cleanup: async () => {
            await store.unsubscribeFromAllCalendars();
        }
    };
    
    return store;
};

export const calendarStore = createCalendarStore(); 
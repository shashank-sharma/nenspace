import { pb } from '$lib/config/pocketbase';
import type { CalendarEvent, CalendarSync } from '../types';
import type { UnsubscribeFunc } from 'pocketbase';

export class CalendarService {
    static async checkStatus(): Promise<CalendarSync | null> {
        try {
            return await pb.send<CalendarSync>('/api/calendar/sync/status', {
                method: 'GET'
            });
        } catch (error) {
            throw error;
        }
    }

    static async startAuth(): Promise<string | null> {
        try {
            console.log('Calendar service: Starting auth process');
            const response = await pb.send<{ url: string }>('/api/calendar/auth/redirect', {
                method: 'GET'
            });
            console.log('Calendar service: Received auth response', response);
            return response.url;
        } catch (error) {
            console.error('Calendar auth start error:', error);
            return null;
        }
    }

    static async completeAuth(code: string): Promise<boolean> {
        try {
            await pb.send('/api/calendar/auth/callback', {
                method: 'POST',
                body: { code, provider: 'google' }
            });
            return true;
        } catch (error) {
            console.error('Auth completion error:', error);
            return false;
        }
    }

    static async createCalendarToken(name: string, type: string, tokenId: string): Promise<boolean> {
        try {
            await pb.send('/api/calendar/create', {
                method: 'POST',
                body: { 
                    name, 
                    type, 
                    token_id: tokenId 
                }
            });
            return true;
        } catch (error) {
            console.error('Create calendar token error:', error);
            return false;
        }
    }

    static async getEvents(startDate?: Date, endDate?: Date): Promise<{
        items: CalendarEvent[];
        totalItems: number;
    }> {
        const filterConditions = [`user = "${pb.authStore.model?.id}"`];
                
        // Add date range filter if provided
        if (startDate && endDate) {
            filterConditions.push(`(start >= "${startDate.toISOString()}" && start <= "${endDate.toISOString()}")`);
        }
        
        const result = await pb.collection('calendar_events').getList(1, 100, {
            filter: filterConditions.join(" && "),
            sort: 'start'
        });
        
        return {
            items: result.items as unknown as CalendarEvent[],
            totalItems: result.totalItems
        };
    }

    static async getCalendars(): Promise<CalendarSync[]> {
        const resultList = await pb.collection('calendar_sync').getList(1, 20, {
            filter: `user = "${pb.authStore.model?.id}"`,
            sort: '-last_synced'
        });
        
        return resultList.items as unknown as CalendarSync[];
    }

    static async createEvent(eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
        const createdEvent = await pb.collection('calendar_events').create({
            ...eventData,
            user: pb.authStore.model?.id
        });
        
        return createdEvent as unknown as CalendarEvent;
    }

    static async updateEvent(eventId: string, eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
        const updatedEvent = await pb.collection('calendar_events').update(eventId, eventData);
        return updatedEvent as unknown as CalendarEvent;
    }

    static async deleteEvent(eventId: string): Promise<boolean> {
        await pb.collection('calendar_events').delete(eventId);
        return true;
    }

    static async triggerSync(): Promise<void> {
        await pb.send('/api/calendar/sync', { method: 'POST' });
    }
    
    static async fetchAvailableTokens(): Promise<any[]> {
        const result = await pb.collection("tokens").getList(1, 50, {
            filter: 'is_active = true && provider = "google_calendar"',
            fields: "id,provider,account",
        });
        return result.items;
    }
    
    static subscribeToRecord(collection: string, recordId: string, callback: (data: any) => void): Promise<UnsubscribeFunc> {
        return pb.collection(collection).subscribe(recordId, callback);
    }
} 
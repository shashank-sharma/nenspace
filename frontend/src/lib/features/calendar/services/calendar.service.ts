import { pb } from '$lib/config/pocketbase';
import { FilterBuilder } from '$lib/utils/pocketbase-filter.util';
import type { CalendarEvent, CalendarSync } from '../types';
import type { UnsubscribeFunc } from 'pocketbase';
import { CALENDAR_PAGE_SIZE } from '../constants';

export class CalendarService {
    static async checkStatus(force: boolean = false): Promise<CalendarSync | null> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const filter = FilterBuilder.create()
            .equals('user', userId)
            .build();

        const result = await pb.collection('calendar_sync').getList(1, 1, {
            filter,
            sort: '-updated'
        });
        
        return (result.items?.[0] as unknown as CalendarSync) ?? null;
    }

    static async startAuth(): Promise<string> {
        const response = await pb.send<{ url: string }>('/api/calendar/auth/redirect', {
            method: 'GET'
        });
        
        if (!response?.url) {
            throw new Error('No auth URL received from server');
        }
        
        return response.url;
    }

    static async completeAuth(code: string): Promise<void> {
        if (!code) {
            throw new Error('Authorization code is required');
        }

        await pb.send('/api/calendar/auth/callback', {
            method: 'POST',
            body: { code, provider: 'google' }
        });
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
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const filterBuilder = FilterBuilder.create().equals('user', userId);
        
        // Add date range filter if provided
        if (startDate && endDate) {
            filterBuilder
                .greaterThanOrEqual('start', startDate.toISOString())
                .lessThanOrEqual('start', endDate.toISOString());
        }
        
        const result = await pb.collection('calendar_events').getList(1, CALENDAR_PAGE_SIZE, {
            filter: filterBuilder.build(),
            sort: 'start'
        });
        
        return {
            items: result.items as unknown as CalendarEvent[],
            totalItems: result.totalItems
        };
    }

    static async getCalendars(): Promise<CalendarSync[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const filter = FilterBuilder.create()
            .equals('user', userId)
            .build();

        const resultList = await pb.collection('calendar_sync').getList(1, 20, {
            filter,
            sort: '-last_synced'
        });
        
        return resultList.items as unknown as CalendarSync[];
    }

    static async createEvent(eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const createdEvent = await pb.collection('calendar_events').create({
            ...eventData,
            user: userId
        });
        
        return createdEvent as unknown as CalendarEvent;
    }

    static async updateEvent(eventId: string, eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        const updatedEvent = await pb.collection('calendar_events').update(eventId, eventData);
        return updatedEvent as unknown as CalendarEvent;
    }

    static async deleteEvent(eventId: string): Promise<void> {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        await pb.collection('calendar_events').delete(eventId);
    }

    static async triggerSync(): Promise<void> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        await pb.send('/api/calendar/sync', { method: 'POST' });

        const filter = FilterBuilder.create()
            .equals('user', userId)
            .equals('is_active', true)
            .build();

        const list = await pb.collection('calendar_sync').getList(1, 50, {
            filter,
            sort: '-updated'
        });
        
        await Promise.all(
            list.items.map((item: any) =>
                pb.collection('calendar_sync').update(item.id, { in_progress: true })
            )
        );
    }
    
    static async fetchAvailableTokens(): Promise<any[]> {
        const filter = FilterBuilder.create()
            .equals('is_active', true)
            .equals('provider', 'google_calendar')
            .build();

        const result = await pb.collection('tokens').getList(1, 50, {
            filter,
            fields: 'id,provider,account',
        });
        
        return result.items;
    }
    
    static subscribeToRecord(collection: string, recordId: string, callback: (data: any) => void): Promise<UnsubscribeFunc> {
        return pb.collection(collection).subscribe(recordId, callback);
    }
} 
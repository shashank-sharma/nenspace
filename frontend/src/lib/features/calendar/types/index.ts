/**
 * Calendar Feature Type Definitions
 */

export interface CalendarEvent {
    collectionId: string;
    collectionName: string;
    id: string;
    calendar_id: string;
    calendar_uid: string;
    user: string;
    calendar: string;
    etag: string;
    summary: string;
    description: string;
    event_type: string;
    start: string;
    end: string;
    start_time?: string;
    end_time?: string;
    creator: string;
    creator_email: string;
    organizer: string | { name?: string; email?: string };
    organizer_email: string;
    kind: string;
    location: string;
    status: string;
    event_created: string;
    event_updated: string;
    is_day_event: boolean;
    is_all_day?: boolean;
    created: string;
    updated: string;
}

export interface CalendarSync {
    collectionId: string;
    collectionName: string;
    id: string;
    user: string;
    token: string;
    name: string;
    type: string;
    sync_token: string;
    is_active: boolean;
    in_progress: boolean;
    last_synced: string;
    sync_status: string;
    color?: string;
    created: string;
    updated: string;
    status?: string;
    is_syncing?: boolean;
}

export interface CalendarState {
    events: CalendarEvent[];
    calendars: CalendarSync[];
    isLoading: boolean;
    isAuthenticating: boolean;
    error: string | null;
    view: CalendarView;
    selectedDate: Date;
    selectedEvent: CalendarEvent | null;
    syncStatus: CalendarSync | null;
    lastChecked: number | null;
    syncAvailable: boolean;
    subscriptions: Record<string, any>;
}

export interface CalendarViewProps {
    events: CalendarEvent[];
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    onEventClick: (event: CalendarEvent) => void;
}

export type CalendarView = 'month' | 'week' | 'day';

export interface CalendarFilter {
    startDate?: Date;
    endDate?: Date;
    calendarId?: string;
}

export interface CalendarFormData {
    name: string;
    type: string;
    tokenId: string;
}

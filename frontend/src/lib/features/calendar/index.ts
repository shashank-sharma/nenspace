/**
 * Calendar Feature Barrel Export
 */

// Components
export { default as CalendarFeature } from './components/CalendarFeature.svelte';
export { default as Calendar } from './components/Calendar.svelte';
export { default as CalendarAnalytics } from './components/CalendarAnalytics.svelte';
export { default as CalendarAuth } from './components/CalendarAuth.svelte';
export { default as CalendarSyncStatus } from './components/CalendarSyncStatus.svelte';
export { default as DayView } from './components/DayView.svelte';
export { default as EventCard } from './components/EventCard.svelte';
export { default as MonthView } from './components/MonthView.svelte';
export { default as WeekView } from './components/WeekView.svelte';
export { default as UpcomingEvents } from './components/UpcomingEvents.svelte';

// Services
export { CalendarService } from './services';
export { calendarStore } from './services';

// Types
export type {
    CalendarEvent,
    CalendarSync,
    CalendarState,
    CalendarView,
    CalendarViewProps,
    CalendarFilter,
    CalendarFormData,
} from './types';

// Constants
export {
    CALENDAR_PAGE_SIZE,
    CALENDAR_REFRESH_INTERVAL,
    MAX_CALENDAR_NAME_LENGTH,
    CALENDAR_VIEWS,
    CALENDAR_TYPES,
    SYNC_STATUS,
} from './constants';

// Utils
export * from './utils';

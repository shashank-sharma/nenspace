import { browser } from '$app/environment';
import { ensureCalendarData } from '../utils/event.utils';
export { CalendarService } from './calendar.service';

/**
 * Initialize calendar data by ensuring it's loaded.
 * This function handles the calendar data pre-loading and can be called from layout.
 */
export function initCalendar(): void {
  if (browser) {
    // Initialize calendar data
    ensureCalendarData();
  }
} 
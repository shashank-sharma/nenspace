import { browser } from '$app/environment';
import { calendarStore } from '../stores/calendar.store';
import { get } from 'svelte/store';

const CACHE_TIMEOUT = 5 * 60 * 1000;
let lastEventsFetch = 0;
let lastCalendarsFetch = 0;


export function ensureCalendarEvents(force: boolean = false, startDate?: Date, endDate?: Date): void {
  if (!browser) return;
  
  const storeState = get(calendarStore);
  
  const now = Date.now();
  const isDataStale = (now - lastEventsFetch) > CACHE_TIMEOUT;
  
  if (!force && !isDataStale && storeState.events && storeState.events.length > 0) {
    return;
  }
  
  if (storeState.calendars && storeState.calendars.length > 0) {
    calendarStore.fetchEvents(startDate, endDate)
      .then(() => {
        lastEventsFetch = Date.now();
      });
  }
}

export function ensureCalendarData(force: boolean = false): void {
  if (!browser) return;
  
  const storeState = get(calendarStore);
  
  const now = Date.now();
  const isCalendarsStale = (now - lastCalendarsFetch) > CACHE_TIMEOUT;
  const isEventsStale = (now - lastEventsFetch) > CACHE_TIMEOUT;
  
  const needToFetchCalendars = force || isCalendarsStale || 
    !storeState.calendars || 
    storeState.calendars.length === 0;
    
  if (needToFetchCalendars) {
    calendarStore.fetchCalendars()
      .then(calendars => {
        lastCalendarsFetch = Date.now();
        
        if (calendars && calendars.length > 0 && 
            (force || isEventsStale || !storeState.events || storeState.events.length === 0)) {
          calendarStore.fetchEvents()
            .then(() => {
              lastEventsFetch = Date.now();
            });
        }
      });
  } else {
    if (force || isEventsStale || !storeState.events || storeState.events.length === 0) {
      calendarStore.fetchEvents()
        .then(() => {
          lastEventsFetch = Date.now();
        });
    }
  }
} 
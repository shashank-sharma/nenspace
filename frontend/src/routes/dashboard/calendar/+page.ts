import { browser } from '$app/environment';
import { initCalendar } from '$lib/features/calendar/services';

/** @type {import('./$types').PageLoad} */
export function load() {
  // Initialize calendar data when this page is accessed
  if (browser) {
    initCalendar();
  }
  
  return {
    // No data needs to be returned as we're just triggering the initialization
  };
} 
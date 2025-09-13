import { browser } from '$app/environment';
import { initWeather } from '$lib/features/chronicles/services';
import { initCalendar } from '$lib/features/calendar/services';

/** @type {import('./$types').PageLoad} */
export function load() {
  // Initialize required data when this page is accessed
  if (browser) {
    // Initialize weather data with forecast
    initWeather(true);
    
    // Initialize calendar data for today's overview
    initCalendar();
  }
  
  return {
    // No data needs to be returned as we're just triggering the initialization
  };
} 
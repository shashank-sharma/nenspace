import type { CalendarEvent } from '../types';

/**
 * Returns the appropriate color class based on the time of day
 * Morning (5-11): Yellow
 * Afternoon (12-16): Orange
 * Evening (17-21): Purple
 * Night (22-4): Blue
 * All-day events: Default color
 */
export function getEventTimeColor(event: CalendarEvent): string {
  if (event.is_day_event || event.is_all_day) {
    return 'bg-purple-500 hover:bg-purple-600';
  }
  
  const date = new Date(event.start);
  const hour = date.getHours();
  
  if (hour >= 5 && hour < 12) {
    return 'bg-yellow-400 hover:bg-yellow-500';
  } else if (hour >= 12 && hour < 17) {
    return 'bg-orange-400 hover:bg-orange-500';
  } else if (hour >= 17 && hour < 22) {
    return 'bg-purple-400 hover:bg-purple-500';
  } else {
    return 'bg-blue-400 hover:bg-blue-500';
  }
}

export function getEventTextColor(event: CalendarEvent): string {
  return 'text-gray-900';
} 
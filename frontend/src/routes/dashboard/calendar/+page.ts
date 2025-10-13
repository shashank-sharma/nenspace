import { browser } from '$app/environment';

/** @type {import('./$types').PageLoad} */
export function load() {
  // The Calendar feature component handles its own initial data fetch.
  // Avoid triggering a parallel preload here to prevent duplicate requests.
  if (browser) {
    // no-op on client; leave data fetching to the component
  }
  
  return {
    // No data needs to be returned as we're just triggering the initialization
  };
} 
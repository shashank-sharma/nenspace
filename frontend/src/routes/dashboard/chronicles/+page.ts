import { browser } from '$app/environment';

/** @type {import('./$types').PageLoad} */
export function load() {
  // Initialize required data when this page is accessed
  if (browser) {
    // Initialization logic removed as services are no longer available
  }
  
  return {
    // No data needs to be returned as we're just triggering the initialization
  };
} 
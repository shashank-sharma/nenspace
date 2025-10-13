/**
 * Food Log Feature Constants
 */

// Pagination
export const FOOD_LOG_PAGE_SIZE = 10;

// Search debounce time in milliseconds
export const SEARCH_DEBOUNCE_MS = 300;

// Image upload constraints
export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// Meal sections for quick access
export const MEAL_SECTIONS = [
    { id: 'breakfast', label: 'Breakfast', icon: '☕' },
    { id: 'lunch', label: 'Lunch', icon: '🍲' },
    { id: 'dinner', label: 'Dinner', icon: '🍽️' },
] as const;

// Image retry configuration
export const IMAGE_RETRY_ATTEMPTS = 3;
export const IMAGE_RETRY_BASE_DELAY_MS = 1000;


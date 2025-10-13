/**
 * Chronicles Feature Constants
 * Centralized configuration and magic numbers
 */

// Weather cache configuration
export const WEATHER_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Chronicle steps configuration
export const CHRONICLE_STEPS = [
    {
        id: 'mood',
        title: 'Day Overview & Mood',
        subtitle: 'How was your day?',
    },
    {
        id: 'events',
        title: 'Main Events',
        subtitle: 'What was memorable today?',
    },
    {
        id: 'wins',
        title: 'Gratitude & Wins',
        subtitle: 'What went well today?',
    },
    {
        id: 'challenges',
        title: 'Challenges & Growth',
        subtitle: 'Any challenges today?',
    },
    {
        id: 'tomorrow',
        title: "Tomorrow's Intention",
        subtitle: 'What to focus on tomorrow?',
    },
] as const;

// Mood options (no emojis - using Lucide icons in component)
export const MOOD_OPTIONS = [
    { value: 'happy', label: 'Happy' },
    { value: 'excited', label: 'Excited' },
    { value: 'peaceful', label: 'Peaceful' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'anxious', label: 'Anxious' },
    { value: 'sad', label: 'Sad' },
] as const;

// Energy level configuration
export const ENERGY_CONFIG = {
    MIN: 1,
    MAX: 10,
    DEFAULT: 5,
    STEP: 1,
} as const;

// Form validation limits
export const VALIDATION_LIMITS = {
    MAX_TITLE_LENGTH: 100,
    MAX_CONTENT_LENGTH: 50000,
    MAX_TAG_LENGTH: 500,
    MAX_CHALLENGE_LENGTH: 5000,
    MAX_FOCUS_LENGTH: 2000,
} as const;

// Weather types
export const WEATHER_TYPES = [
    'sunny',
    'cloudy',
    'partly-cloudy',
    'rainy',
    'stormy',
    'stardust',
    'aurora',
] as const;

export type WeatherType = (typeof WEATHER_TYPES)[number];

// Local storage keys
export const STORAGE_KEYS = {
    CHRONICLES_STATE: 'chroniclesState',
    WEATHER_STATE: 'weatherState',
    WEATHER_LOCATION: 'weatherLocation',
    DEBUG_SETTINGS: 'chroniclesDebugSettings',
} as const;

// Weather API configuration
export const WEATHER_API_CONFIG = {
    DEFAULT_LOCATION: 'London',
    DEFAULT_UNITS: 'metric' as const,
    DEFAULT_LANG: 'en',
    DEFAULT_FORECAST_DAYS: 5,
    MAX_FORECAST_DAYS: 5,
    MIN_FORECAST_DAYS: 1,
} as const;

// View modes
export const VIEW_MODES = ['edit', 'preview', 'markdown'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

// Step count
export const TOTAL_STEPS = CHRONICLE_STEPS.length;

// Custom event names
export const CUSTOM_EVENTS = {
    DEBUG_SETTINGS_CHANGED: 'chronicles-debug-settings-changed',
} as const;

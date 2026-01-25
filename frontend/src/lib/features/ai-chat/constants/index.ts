export const DEFAULT_MODEL = 'openai/gpt-3.5-turbo';

export const CONVERSATIONS_PAGE_SIZE = 20;
export const MESSAGES_PAGE_SIZE = 50;
export const SEARCH_DEBOUNCE_MS = 300;

export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 100000;

export const KEYBOARD_SHORTCUTS = {
    NEW_CHAT: 'cmd+k',
    EXPORT: 'cmd+e',
    SEARCH: 'cmd+f',
    SEND: 'Enter',
    CANCEL: 'Escape',
} as const;

export const TEMPERATURE_RANGE = {
    MIN: 0,
    MAX: 2,
    DEFAULT: 0.7,
    STEP: 0.1,
} as const;

export const MAX_TOKENS_RANGE = {
    MIN: 100,
    MAX: 8000,
    DEFAULT: 2000,
    STEP: 100,
} as const;

export const CONVERSATION_STARTERS = [
    "Help me brainstorm ideas for a project",
    "Explain a complex concept in simple terms",
    "Write a creative story or poem",
    "Help me debug some code",
    "Plan my day or week",
    "Practice a language conversation",
    "Analyze data or information",
    "Generate creative content",
] as const;

export const SIDEBAR_WIDTH = 320;
export const SIDEBAR_MIN_WIDTH = 280;
export const SIDEBAR_MAX_WIDTH = 480;

export const DATE_GROUP_LABELS = {
    TODAY: 'Today',
    YESTERDAY: 'Yesterday',
    THIS_WEEK: 'This Week',
    THIS_MONTH: 'This Month',
    OLDER: 'Older',
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_TOTAL_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 10;

export const SUPPORTED_FILE_TYPES = [
    'image/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json'
] as const;

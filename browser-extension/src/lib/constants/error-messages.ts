/**
 * Error Messages
 * 
 * User-friendly error message constants.
 */

export const ERROR_MESSAGES = {
    LOGIN_FAILED: 'Login failed. Please check your credentials.',
    NETWORK_ERROR: 'Cannot connect to server. Please check your backend URL.',
    AUTH_EXPIRED: 'Your session has expired. Please login again.',
    DEVICE_REGISTRATION_FAILED: 'Failed to register device. Please try again.',
    INVALID_URL: 'Please enter a valid backend URL.',
    REQUIRED_FIELD: 'This field is required.',
    INVALID_EMAIL: 'Please enter a valid email address.',
} as const;


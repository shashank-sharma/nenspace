/**
 * Unified Error Handling
 * 
 * Centralized error handling with custom error types, user-friendly messages,
 * and structured error logging.
 */

import { createLogger } from './logger.util';
import { ERROR_MESSAGES } from '../config/constants';

const logger = createLogger('[ErrorHandler]');

/**
 * Base error class for extension errors
 */
export class ExtensionError extends Error {
    public readonly code?: number;
    public readonly data?: any;
    public readonly timestamp: number;

    constructor(message: string, code?: number, data?: any) {
        super(message);
        this.name = 'ExtensionError';
        this.code = code;
        this.data = data;
        this.timestamp = Date.now();
        
        // Maintains proper stack trace for where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Authentication error
 */
export class AuthError extends ExtensionError {
    constructor(message: string = ERROR_MESSAGES.AUTH_EXPIRED, code: number = 401, data?: any) {
        super(message, code, data);
        this.name = 'AuthError';
    }
}

/**
 * Network error
 */
export class NetworkError extends ExtensionError {
    constructor(message: string = ERROR_MESSAGES.NETWORK_ERROR, data?: any) {
        super(message, 0, data);
        this.name = 'NetworkError';
    }
}

/**
 * Storage error
 */
export class StorageError extends ExtensionError {
    constructor(message: string, data?: any) {
        super(message, undefined, data);
        this.name = 'StorageError';
    }
}

/**
 * Validation error
 */
export class ValidationError extends ExtensionError {
    constructor(message: string, data?: any) {
        super(message, 400, data);
        this.name = 'ValidationError';
    }
}

/**
 * API error
 */
export class ApiError extends ExtensionError {
    constructor(message: string, code: number, data?: any) {
        super(message, code, data);
        this.name = 'ApiError';
    }
}

/**
 * Parse PocketBase error into typed error
 */
export function parsePocketBaseError(error: any): ExtensionError {
    if (!error) {
        return new ExtensionError('Unknown error occurred');
    }

    const status = error.status || error.code;
    const message = error.message || 'API request failed';
    const data = error.data;

    // Authentication errors
    if (status === 401 || status === 403) {
        return new AuthError(ERROR_MESSAGES.AUTH_EXPIRED, status, data);
    }

    // Network errors
    if (status === 0 || !status) {
        return new NetworkError(ERROR_MESSAGES.NETWORK_ERROR, data);
    }

    // Validation errors
    if (status === 400) {
        // Extract PocketBase validation errors
        if (data && data.data) {
            const errors = Object.values(data.data).flat() as string[];
            if (errors.length > 0) {
                return new ValidationError(errors.join(', '), data);
            }
        }
        return new ValidationError(message, data);
    }

    // Server errors
    if (status >= 500) {
        return new ApiError('Server error. Please try again later.', status, data);
    }

    // Generic API error
    return new ApiError(message, status, data);
}

/**
 * Format error for user display
 */
export function formatError(error: unknown): string {
    if (typeof error === 'string') {
        return error;
    }

    if (error instanceof ExtensionError) {
        return error.message;
    }

    if (error && typeof error === 'object') {
        const err = error as any;

        // Handle specific error codes
        if (err.code === 401 || err.code === 403 || err.status === 401 || err.status === 403) {
            return ERROR_MESSAGES.AUTH_EXPIRED;
        }

        if (err.code === 0 || err.status === 0) {
            return ERROR_MESSAGES.NETWORK_ERROR;
        }

        if (err.code && err.code >= 500) {
            return 'Server error. Please try again later.';
        }

        // Return error message if available
        if (err.message) {
            return err.message;
        }

        // Check for PocketBase error format
        if ('data' in err && err.data) {
            const data = err.data as any;
            if (data.message) {
                return data.message;
            }
            if (data.data) {
                const errors = Object.values(data.data).flat() as string[];
                if (errors.length > 0) {
                    return errors.join(', ');
                }
            }
        }
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is network related
 */
export function isNetworkError(error: unknown): boolean {
    if (error instanceof NetworkError) {
        return true;
    }

    if (error && typeof error === 'object') {
        const err = error as any;
        return err.code === 0 || err.status === 0 || 
               (error instanceof TypeError && err.message?.includes('fetch'));
    }

    return false;
}

/**
 * Check if error is authentication related
 */
export function isAuthError(error: unknown): boolean {
    if (error instanceof AuthError) {
        return true;
    }

    if (error && typeof error === 'object') {
        const err = error as any;
        return err.code === 401 || err.code === 403 || err.status === 401 || err.status === 403;
    }

    return false;
}

/**
 * Check if error is validation related
 */
export function isValidationError(error: unknown): boolean {
    if (error instanceof ValidationError) {
        return true;
    }

    if (error && typeof error === 'object') {
        const err = error as any;
        return err.code === 400 || err.status === 400;
    }

    return false;
}

/**
 * Log error with context
 */
export function logError(context: string, error: unknown, additionalData?: any): void {
    const message = formatError(error);
    
    if (error instanceof ExtensionError) {
        logger.error(`${context}: ${message}`, {
            code: error.code,
            data: error.data,
            timestamp: error.timestamp,
            ...additionalData,
        });
    } else {
        logger.error(`${context}: ${message}`, { error, ...additionalData });
    }
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context: string
): T {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args);
        } catch (error) {
            logError(context, error);
            throw error;
        }
    }) as T;
}

/**
 * Safe async execution with error handling and fallback
 */
export async function safeAsync<T>(
    fn: () => Promise<T>,
    fallback: T,
    context?: string
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (context) {
            logError(context, error);
        }
        return fallback;
    }
}


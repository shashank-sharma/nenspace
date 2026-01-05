/**
 * PocketBase Error Handler
 * 
 * Specialized error handling for PocketBase API errors.
 */

import { parsePocketBaseError, ApiError } from '../../utils/error.util';
import { createLogger } from '../../utils/logger.util';

const logger = createLogger('[PocketBase:Error]');

/**
 * Handle PocketBase error with logging and parsing
 */
export function handlePocketBaseError(error: any, context?: string): ApiError {
    const parsedError = parsePocketBaseError(error);
    
    if (context) {
        logger.error(`${context}`, {
            message: parsedError.message,
            code: parsedError.code,
            data: parsedError.data,
        });
    }
    
    return parsedError;
}

/**
 * Extract validation errors from PocketBase response
 */
export function extractValidationErrors(error: any): Record<string, string[]> {
    if (error?.data?.data) {
        return error.data.data;
    }
    return {};
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: Record<string, string[]>): string {
    const messages: string[] = [];
    
    for (const [field, fieldErrors] of Object.entries(errors)) {
        messages.push(...fieldErrors.map(err => `${field}: ${err}`));
    }
    
    return messages.join(', ');
}


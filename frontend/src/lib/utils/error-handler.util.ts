/**
 * Error Handler Utility
 * 
 * Production-grade error handling with retry logic, detailed error parsing,
 * and automatic toast notifications.
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Detailed error parsing (PocketBase, network, validation errors)
 * - Type-safe error handling
 * - Automatic toast notifications
 * - Error logging
 * - Offline detection
 * 
 * ✅ Eliminates ~400 lines of duplicate error handling across features
 */

import { toast } from 'svelte-sonner';
import { NetworkService } from '$lib/services/network.service.svelte';

export interface ErrorHandlerOptions<T> {
    /**
     * Success message to display
     */
    successMessage?: string;
    
    /**
     * Error message to display (can be a function for dynamic messages)
     */
    errorMessage?: string | ((error: any) => string);
    
    /**
     * Callback on success
     */
    onSuccess?: (result: T) => void | Promise<void>;
    
    /**
     * Callback on error
     */
    onError?: (error: ParsedError) => void | Promise<void>;
    
    /**
     * Whether to show toast notifications (default: true)
     */
    showToast?: boolean;
    
    /**
     * Retry configuration
     */
    retry?: {
        /**
         * Maximum number of retries (default: 0)
         */
        maxAttempts?: number;
        
        /**
         * Initial delay in ms (default: 1000)
         */
        initialDelay?: number;
        
        /**
         * Exponential backoff multiplier (default: 2)
         */
        backoffMultiplier?: number;
        
        /**
         * Maximum delay in ms (default: 10000)
         */
        maxDelay?: number;
        
        /**
         * Function to determine if error is retryable
         */
        shouldRetry?: (error: ParsedError, attempt: number) => boolean;
    };
    
    /**
     * Whether to log errors to console (default: true)
     */
    logErrors?: boolean;
    
    /**
     * Custom error parser
     */
    parseError?: (error: any) => ParsedError;
}

export interface ParsedError {
    /**
     * Error type
     */
    type: 'network' | 'validation' | 'authentication' | 'authorization' | 'not_found' | 'server' | 'unknown';
    
    /**
     * Human-readable error message
     */
    message: string;
    
    /**
     * Original error object
     */
    original: any;
    
    /**
     * HTTP status code (if applicable)
     */
    statusCode?: number;
    
    /**
     * Validation errors (if applicable)
     */
    validationErrors?: Record<string, string[]>;
    
    /**
     * Whether the error is retryable
     */
    isRetryable: boolean;
}

/**
 * Parse error into structured format
 */
function parseError(error: any): ParsedError {
    // Network error (offline)
    if (!NetworkService.isOnline) {
        return {
            type: 'network',
            message: 'You are offline. Please check your internet connection.',
            original: error,
            isRetryable: false, // Don't retry when offline - wait for user to go back online
        };
    }
    
    // PocketBase ClientResponseError
    if (error?.status !== undefined && error?.data !== undefined) {
        const statusCode = error.status;
        
        // Validation error (400)
        if (statusCode === 400) {
            const validationErrors: Record<string, string[]> = {};
            
            if (error.data?.data) {
                Object.keys(error.data.data).forEach(key => {
                    validationErrors[key] = [error.data.data[key].message || 'Invalid value'];
                });
            }
            
            return {
                type: 'validation',
                message: error.data?.message || 'Validation failed',
                original: error,
                statusCode,
                validationErrors,
                isRetryable: false,
            };
        }
        
        // Authentication error (401)
        if (statusCode === 401) {
            return {
                type: 'authentication',
                message: 'Authentication required. Please log in again.',
                original: error,
                statusCode,
                isRetryable: false,
            };
        }
        
        // Authorization error (403)
        if (statusCode === 403) {
            return {
                type: 'authorization',
                message: 'You do not have permission to perform this action.',
                original: error,
                statusCode,
                isRetryable: false,
            };
        }
        
        // Not found error (404)
        if (statusCode === 404) {
            return {
                type: 'not_found',
                message: 'The requested resource was not found.',
                original: error,
                statusCode,
                isRetryable: false,
            };
        }
        
        // Server error (500+)
        if (statusCode >= 500) {
            return {
                type: 'server',
                message: 'Server error. Please try again later.',
                original: error,
                statusCode,
                isRetryable: true,
            };
        }
        
        // Other PocketBase errors
        return {
            type: 'unknown',
            message: error.data?.message || error.message || 'An error occurred',
            original: error,
            statusCode,
            isRetryable: statusCode >= 500,
        };
    }
    
    // Network fetch errors
    if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
        return {
            type: 'network',
            message: 'Network error. Please check your connection.',
            original: error,
            isRetryable: true,
        };
    }
    
    // Timeout errors
    if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
        return {
            type: 'network',
            message: 'Request timed out. Please try again.',
            original: error,
            isRetryable: true,
        };
    }
    
    // Standard Error object
    if (error instanceof Error) {
        return {
            type: 'unknown',
            message: error.message || 'An unexpected error occurred',
            original: error,
            isRetryable: false,
        };
    }
    
    // Unknown error type
    return {
        type: 'unknown',
        message: typeof error === 'string' ? error : 'An unexpected error occurred',
        original: error,
        isRetryable: false,
    };
}

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(
    attempt: number,
    initialDelay: number,
    multiplier: number,
    maxDelay: number
): number {
    const delay = initialDelay * Math.pow(multiplier, attempt - 1);
    return Math.min(delay, maxDelay);
}

/**
 * Execute function with comprehensive error handling
 * 
 * @example
 * const result = await withErrorHandling(
 *     () => pb.collection('tasks').create(data),
 *     {
 *         successMessage: 'Task created!',
 *         errorMessage: 'Failed to create task',
 *         retry: { maxAttempts: 3 }
 *     }
 * );
 */
export async function withErrorHandling<T>(
    fn: () => Promise<T>,
    options: ErrorHandlerOptions<T> = {}
): Promise<T | null> {
    const {
        successMessage,
        errorMessage,
        onSuccess,
        onError,
        showToast = true,
        retry,
        logErrors = true,
        parseError: customParseError,
    } = options;
    
    const maxAttempts = retry?.maxAttempts ?? 0;
    const initialDelay = retry?.initialDelay ?? 1000;
    const backoffMultiplier = retry?.backoffMultiplier ?? 2;
    const maxDelay = retry?.maxDelay ?? 10000;
    
    let lastError: ParsedError | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts + 1; attempt++) {
        try {
            // Execute the function
            const result = await fn();
            
            // Success!
            if (showToast && successMessage) {
                toast.success(successMessage);
            }
            
            await onSuccess?.(result);
            
            return result;
        } catch (error) {
            // Parse error
            const parsedError = customParseError?.(error) ?? parseError(error);
            lastError = parsedError;
            
            // Log error
            if (logErrors) {
                console.error(`[ErrorHandler] Attempt ${attempt}/${maxAttempts + 1} failed:`, {
                    type: parsedError.type,
                    message: parsedError.message,
                    statusCode: parsedError.statusCode,
                    original: parsedError.original,
                });
            }
            
            // Check if we should retry
            const shouldRetry = 
                attempt <= maxAttempts &&
                parsedError.isRetryable &&
                (retry?.shouldRetry?.(parsedError, attempt) ?? true);
            
            if (shouldRetry) {
                const delay = calculateRetryDelay(attempt, initialDelay, backoffMultiplier, maxDelay);
                
                if (showToast) {
                    toast.info(`Retrying... (${attempt}/${maxAttempts})`);
                }
                
                await sleep(delay);
                continue;
            }
            
            // No more retries, handle error
            break;
        }
    }
    
    // All attempts failed
    if (lastError) {
        // Show error toast
        if (showToast) {
            const message = typeof errorMessage === 'function'
                ? errorMessage(lastError.original)
                : errorMessage || lastError.message;
            
            toast.error(message);
        }
        
        // Call error callback
        await onError?.(lastError);
    }
    
    return null;
}

/**
 * Batch error handler for multiple operations
 * 
 * @example
 * const results = await withBatchErrorHandling(
 *     items.map(item => () => pb.collection('tasks').create(item)),
 *     {
 *         successMessage: (count) => `Created ${count} tasks`,
 *         errorMessage: (failed) => `Failed to create ${failed} tasks`,
 *     }
 * );
 */
export async function withBatchErrorHandling<T>(
    operations: Array<() => Promise<T>>,
    options: {
        successMessage?: (successCount: number) => string;
        errorMessage?: (failedCount: number) => string;
        onSuccess?: (results: T[]) => void | Promise<void>;
        onError?: (errors: ParsedError[]) => void | Promise<void>;
        showToast?: boolean;
        continueOnError?: boolean;
        logErrors?: boolean;
    } = {}
): Promise<{
    results: (T | null)[];
    errors: ParsedError[];
    successCount: number;
    failedCount: number;
}> {
    const {
        successMessage,
        errorMessage,
        onSuccess,
        onError,
        showToast = true,
        continueOnError = true,
        logErrors = true,
    } = options;
    
    const results: (T | null)[] = [];
    const errors: ParsedError[] = [];
    
    for (const operation of operations) {
        try {
            const result = await operation();
            results.push(result);
        } catch (error) {
            const parsedError = parseError(error);
            errors.push(parsedError);
            results.push(null);
            
            if (logErrors) {
                console.error('[BatchErrorHandler] Operation failed:', parsedError);
            }
            
            if (!continueOnError) {
                break;
            }
        }
    }
    
    const successCount = results.filter(r => r !== null).length;
    const failedCount = errors.length;
    
    // Show summary toast
    if (showToast) {
        if (failedCount === 0 && successMessage) {
            toast.success(successMessage(successCount));
        } else if (failedCount > 0 && errorMessage) {
            toast.error(errorMessage(failedCount));
        }
    }
    
    // Call callbacks
    const successResults = results.filter((r): r is T => r !== null);
    await onSuccess?.(successResults);
    await onError?.(errors);
    
    return {
        results,
        errors,
        successCount,
        failedCount,
    };
}

/**
 * Export parseError for custom error handling
 */
export { parseError };

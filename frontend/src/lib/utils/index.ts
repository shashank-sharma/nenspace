/**
 * Utilities Index
 * 
 * Centralized exports for all utility functions
 */

// UI utilities
export { cn, flyAndScale, formatDate, getPriorityColor } from './ui.util';

// Date utilities
export { DateUtil } from './date.util';

// Error handling
export {
    withErrorHandling,
    withBatchErrorHandling,
    parseError,
    type ErrorHandlerOptions,
    type ParsedError,
} from './error-handler.util';

// Debug helpers
export { DebugSettings, createPageDebug } from './debug-helper';

// ID generation
export {
    generateLocalId,
    isLocalId,
    generateUUID,
    generateShortId,
    extractTimestamp,
} from './id.util';

// Storage
export { storage, TypeSafeStorage } from './storage.util';

// Validation
export {
    validate,
    validateWithToast,
    validateField,
    required,
    minLength,
    maxLength,
    email,
    url,
    pattern,
    min,
    max,
    range,
    ipAddress,
    notEmpty,
    custom,
    type ValidationRule,
    type ValidationSchema,
    type ValidationResult,
} from './validation.util';

// PocketBase filter builder
export { FilterBuilder } from './pocketbase-filter.util';

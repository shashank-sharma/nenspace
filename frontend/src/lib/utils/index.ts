export { cn, flyAndScale, formatDate, getPriorityColor, type WithElementRef, type WithoutChildren } from './ui.util';

export { DateUtil } from './date.util';

export {
    withErrorHandling,
    withBatchErrorHandling,
    parseError,
    type ErrorHandlerOptions,
    type ParsedError,
} from './error-handler.util';

export { DebugSettings, createPageDebug } from './debug-helper';

export {
    generateLocalId,
    isLocalId,
    generateUUID,
    generateShortId,
    extractTimestamp,
} from './id.util';

export { storage, TypeSafeStorage } from './storage.util';

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

export { FilterBuilder } from './pocketbase-filter.util';

export {
    fetchAllPages,
    fetchPage,
    collectionExists,
    PAGINATION_PER_PAGE,
    PAGINATION_MAX_PER_PAGE,
    DEFAULT_SORT,
    type PaginationOptions,
    type FetchAllPagesOptions,
} from './pocketbase.util';

export {
    sha256,
    sha256Sync,
    hashObject,
    hashMultiple,
} from './hash.util';

export {
    formatEmailString,
    formatEmailDate,
} from './email.util';

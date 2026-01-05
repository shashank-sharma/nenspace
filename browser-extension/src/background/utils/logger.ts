/**
 * Background Logger (Backward Compatibility)
 * 
 * @deprecated Use centralized logger from '../../lib/utils/logger.util' instead
 * 
 * This file re-exports the centralized logger for backward compatibility.
 */

export { LogLevel, createLogger, NamespacedLogger as Logger } from '../../lib/utils/logger.util';
export type { LoggerOptions } from '../../lib/utils/logger.util';


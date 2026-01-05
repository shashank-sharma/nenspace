/**
 * PocketBase Client Factory
 * 
 * Enhanced PocketBase client creation with interceptors and helpers.
 */

import PocketBase from 'pocketbase';
import { DEFAULT_BACKEND_URL } from '../../constants';
import { createLogger } from '../../utils/logger.util';
import { setupLoggingInterceptors, setupErrorHandlingInterceptor } from './request-interceptors';
import type { PocketBaseConfig } from './types';

const logger = createLogger('[PocketBase:Client]');

/**
 * Global PocketBase instance
 */
let globalPb: PocketBase | null = null;

/**
 * Create PocketBase client instance with interceptors
 */
export function createPocketBaseClient(config?: Partial<PocketBaseConfig>): PocketBase {
    const baseUrl = config?.baseUrl || DEFAULT_BACKEND_URL;
    const enableLogging = config?.enableLogging ?? true;
    
    const pb = new PocketBase(baseUrl);
    
    // Setup interceptors
    if (enableLogging) {
        setupLoggingInterceptors(pb);
    }
    
    setupErrorHandlingInterceptor(pb);
    
    logger.debug('PocketBase client created', { baseUrl });
    
    return pb;
}

/**
 * Get or create global PocketBase instance
 */
export function getPocketBase(baseUrl?: string): PocketBase {
    if (!globalPb || (baseUrl && globalPb.baseUrl !== baseUrl)) {
        globalPb = createPocketBaseClient({ baseUrl });
    }
    return globalPb;
}

/**
 * Update global PocketBase URL
 */
export function updatePocketBaseUrl(baseUrl: string): void {
    globalPb = createPocketBaseClient({ baseUrl });
    logger.info('PocketBase URL updated', { baseUrl });
}

/**
 * Reset global PocketBase instance
 */
export function resetPocketBase(): void {
    if (globalPb) {
        globalPb.authStore.clear();
    }
    globalPb = null;
    logger.debug('PocketBase instance reset');
}


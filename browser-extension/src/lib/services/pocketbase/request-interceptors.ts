/**
 * PocketBase Request Interceptors
 * 
 * Request and response interceptors for PocketBase client.
 */

import type PocketBase from 'pocketbase';
import { createLogger } from '../../utils/logger.util';

const logger = createLogger('[PocketBase:Request]');

/**
 * Setup request/response logging interceptors
 */
export function setupLoggingInterceptors(pb: PocketBase): void {
    // Track active requests for debugging
    const activeRequests = new Set<string>();
    
    pb.beforeSend = function (url, options) {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeRequests.add(requestId);
        
        logger.debug(`Request: ${options.method || 'GET'} ${url}`, {
            requestId,
            headers: options.headers,
        });
        
        // Auto-cleanup after 30 seconds
        setTimeout(() => {
            if (activeRequests.has(requestId)) {
                activeRequests.delete(requestId);
            }
        }, 30000);
        
        return { url, options };
    };
    
    pb.afterSend = function (response, data) {
        logger.debug(`Response: ${response.status}`, {
            status: response.status,
            dataSize: JSON.stringify(data).length,
        });
        
        // Clear oldest request
        const firstRequest = activeRequests.values().next().value;
        if (firstRequest) {
            activeRequests.delete(firstRequest);
        }
        
        return data;
    };
}

/**
 * Setup custom headers interceptor
 */
export function setupCustomHeadersInterceptor(
    pb: PocketBase,
    headers: Record<string, string>
): void {
    const originalBeforeSend = pb.beforeSend;
    
    pb.beforeSend = function (url, options) {
        // Add custom headers
        options.headers = {
            ...options.headers,
            ...headers,
        };
        
        // Call original interceptor if exists
        if (originalBeforeSend) {
            return originalBeforeSend.call(this, url, options);
        }
        
        return { url, options };
    };
}

/**
 * Setup error handling interceptor
 */
export function setupErrorHandlingInterceptor(pb: PocketBase): void {
    const originalAfterSend = pb.afterSend;
    
    pb.afterSend = function (response, data) {
        // Handle non-successful responses
        if (!response.ok) {
            logger.warn(`Request failed: ${response.status}`, {
                status: response.status,
                statusText: response.statusText,
                data,
            });
        }
        
        // Call original interceptor if exists
        if (originalAfterSend) {
            return originalAfterSend.call(this, response, data);
        }
        
        return data;
    };
}


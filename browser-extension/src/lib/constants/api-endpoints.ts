/**
 * API Endpoints
 * 
 * Constants for API endpoint paths.
 */

import { isDev, getBrowserType } from '../utils/environment.util'

export const API_ENDPOINTS = {
    DEV_TOKEN: '/api/token',
    TRACK_CREATE: '/api/track/create',
} as const;

/**
 * Environment Configuration
 * 
 * Uses Plasmo's environment variable system for configuration.
 * Enhanced with environment detection utilities.
 */
export const ENV_CONFIG = {
    // Public environment variables (accessible in all contexts)
    DEFAULT_BACKEND_URL: process.env.PLASMO_PUBLIC_DEFAULT_BACKEND_URL || 'http://localhost:8090',
    APP_NAME: process.env.PLASMO_PUBLIC_APP_NAME || 'Nenspace Extension',
    VERSION: process.env.PLASMO_PUBLIC_VERSION || '0.0.1',
    
    // Feature flags (enhanced with environment detection)
    ENABLE_DEBUG_MODE: process.env.PLASMO_PUBLIC_ENABLE_DEBUG_MODE === 'true' || isDev(),
    ENABLE_ANALYTICS: process.env.PLASMO_PUBLIC_ENABLE_ANALYTICS === 'true',
    ENABLE_REALTIME: process.env.PLASMO_PUBLIC_ENABLE_REALTIME === 'true',
    
    // Environment info
    IS_DEVELOPMENT: isDev(),
    BROWSER_TYPE: getBrowserType(),
    
    // API Configuration
    API_TIMEOUT: Number.parseInt(process.env.PLASMO_PUBLIC_API_TIMEOUT || '10000'),
    HEALTH_CHECK_INTERVAL: Number.parseInt(process.env.PLASMO_PUBLIC_HEALTH_CHECK_INTERVAL || '30000'),
    REALTIME_MAX_RETRIES: Number.parseInt(process.env.PLASMO_PUBLIC_REALTIME_MAX_RETRIES || '10'),
    
    // Build-time variables
    NODE_ENV: process.env.NODE_ENV || 'development',
    TARGET: process.env.PLASMO_TARGET || 'chrome-mv3',
} as const;


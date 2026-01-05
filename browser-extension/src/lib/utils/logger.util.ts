/**
 * Centralized Logger Utility
 * 
 * Environment-aware logging with user-toggleable debug mode.
 * - In production builds: logs are stripped unless debug mode is enabled
 * - Debug mode can be toggled via extension settings
 * - Namespace support for different modules
 * - Enhanced with environment detection utilities
 */

import { isDev, isProd, getContext } from './environment.util';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  namespace: string;
  level?: LogLevel;
  timestamp?: boolean;
}

class LoggerImpl {
  private debugEnabled: boolean = false;
  private isProduction: boolean = isProd();
  private isDevelopment: boolean = isDev();
  private context: string = getContext();
  private storageInitialized: boolean = false;

  constructor() {
    // Don't load debug setting immediately to avoid circular dependency
    // It will be loaded when first needed
  }

  /**
   * Load debug setting from Plasmo storage (lazy initialization)
   */
  private async loadDebugSetting(): Promise<void> {
    if (this.storageInitialized) return;
    
    try {
      // Dynamic import to avoid circular dependency
      const { storage } = await import('../services/plasmo-storage.service');
      const result = await storage.get('debug_enabled');
      this.debugEnabled = result ?? false;
      this.storageInitialized = true;
    } catch {
      this.debugEnabled = false;
      this.storageInitialized = true;
    }
  }

  /**
   * Set debug mode (called from settings UI)
   */
  async setDebugMode(enabled: boolean): Promise<void> {
    this.debugEnabled = enabled;
    try {
      // Dynamic import to avoid circular dependency
      const { storage } = await import('../services/plasmo-storage.service');
      await storage.set('debug_enabled', enabled);
    } catch (error) {
      console.error('[Logger] Failed to save debug setting:', error);
    }
  }

  /**
   * Get current debug mode status
   */
  getDebugMode(): boolean {
    return this.debugEnabled;
  }

  /**
   * Check if logging should be enabled
   */
  private shouldLog(level: LogLevel): boolean {
    // Always log errors and warnings
    if (level >= LogLevel.WARN) return true;
    
    // In development, always log
    if (!this.isProduction) return true;
    
    // In production, only log if debug mode is enabled
    // Load debug setting if not already loaded
    if (!this.storageInitialized) {
      this.loadDebugSetting().catch(() => {
        // Ignore errors during lazy loading
      });
    }
    return this.debugEnabled;
  }

  /**
   * Create a namespaced logger
   */
  create(options: LoggerOptions): NamespacedLogger {
    return new NamespacedLogger(options, this);
  }
}

export class NamespacedLogger {
  private namespace: string;
  private level: LogLevel;
  private includeTimestamp: boolean;
  private logger: LoggerImpl;

  constructor(options: LoggerOptions, logger: LoggerImpl) {
    this.namespace = options.namespace;
    this.level = options.level ?? LogLevel.INFO;
    this.includeTimestamp = options.timestamp ?? false;
    this.logger = logger;
  }

  private formatMessage(level: string, message: string, data?: any): string[] {
    const timestamp = this.includeTimestamp ? `[${new Date().toISOString()}] ` : '';
    const prefix = `${timestamp}${this.namespace} [${level}]`;
    
    if (data !== undefined) {
      return [prefix, message, data];
    }
    
    return [prefix, message];
  }

  debug(message: string, data?: any): void {
    if (this.level <= LogLevel.DEBUG && this.logger['shouldLog'](LogLevel.DEBUG)) {
      console.debug(...this.formatMessage('DEBUG', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.level <= LogLevel.INFO && this.logger['shouldLog'](LogLevel.INFO)) {
      console.log(...this.formatMessage('INFO', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.level <= LogLevel.WARN && this.logger['shouldLog'](LogLevel.WARN)) {
      console.warn(...this.formatMessage('WARN', message, data));
    }
  }

  error(message: string, error?: any): void {
    if (this.level <= LogLevel.ERROR && this.logger['shouldLog'](LogLevel.ERROR)) {
      console.error(...this.formatMessage('ERROR', message, error));
    }
  }
}

// Export singleton logger instance
export const Logger = new LoggerImpl();

/**
 * Create a namespaced logger
 * 
 * @example
 * const logger = createLogger('[AuthService]');
 * logger.info('User logged in', { userId: '123' });
 */
export function createLogger(namespace: string, level?: LogLevel): NamespacedLogger {
  return Logger.create({ namespace, level });
}


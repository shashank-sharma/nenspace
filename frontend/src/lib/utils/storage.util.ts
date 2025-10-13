/**
 * Type-Safe localStorage Wrapper
 * Provides type-safe access to localStorage with automatic expiration support
 */

interface StorageItem<T> {
    value: T;
    expires?: number;
    version?: string; // For future schema migration support
}

/**
 * Type-safe localStorage wrapper with expiration support
 */
export class TypeSafeStorage {
    /**
     * Save item to localStorage with optional expiration
     * 
     * @param key - Storage key
     * @param value - Value to store (will be JSON serialized)
     * @param ttlMs - Optional time-to-live in milliseconds
     * 
     * @example
     * storage.set('userPrefs', { theme: 'dark' }, 5 * 60 * 1000); // 5 minutes
     */
    static set<T>(key: string, value: T, ttlMs?: number): void {
        try {
            const item: StorageItem<T> = {
                value,
                expires: ttlMs ? Date.now() + ttlMs : undefined,
            };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
            console.warn(`Failed to save to localStorage: ${key}`, error);
        }
    }

    /**
     * Get item from localStorage with automatic expiration check
     * 
     * @param key - Storage key
     * @param defaultValue - Optional default value if key doesn't exist or is expired
     * @returns The stored value or default value
     * 
     * @example
     * const prefs = storage.get('userPrefs', { theme: 'light' });
     */
    static get<T>(key: string, defaultValue?: T): T | null {
        try {
            const stored = localStorage.getItem(key);
            if (!stored) return defaultValue ?? null;

            const item: StorageItem<T> = JSON.parse(stored);

            // Check expiration
            if (item.expires && Date.now() > item.expires) {
                localStorage.removeItem(key);
                return defaultValue ?? null;
            }

            return item.value;
        } catch (error) {
            console.warn(`Failed to read from localStorage: ${key}`, error);
            return defaultValue ?? null;
        }
    }

    /**
     * Remove item from localStorage
     * 
     * @param key - Storage key to remove
     * 
     * @example
     * storage.remove('userPrefs');
     */
    static remove(key: string): void {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn(`Failed to remove from localStorage: ${key}`, error);
        }
    }

    /**
     * Clear all items from localStorage
     * If prefix is provided, only removes keys starting with that prefix
     * 
     * @param prefix - Optional prefix to filter keys
     * 
     * @example
     * storage.clear('debug_'); // Clear all debug settings
     * storage.clear(); // Clear everything
     */
    static clear(prefix?: string): void {
        try {
            if (prefix) {
                const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
                keys.forEach((key) => localStorage.removeItem(key));
            } else {
                localStorage.clear();
            }
        } catch (error) {
            console.warn('Failed to clear localStorage', error);
        }
    }

    /**
     * Check if key exists and is not expired
     * 
     * @param key - Storage key to check
     * @returns True if key exists and is not expired
     * 
     * @example
     * if (storage.has('userPrefs')) { ... }
     */
    static has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * Get all keys in localStorage (optionally filtered by prefix)
     * 
     * @param prefix - Optional prefix to filter keys
     * @returns Array of keys
     * 
     * @example
     * const debugKeys = storage.keys('debug_');
     */
    static keys(prefix?: string): string[] {
        try {
            const allKeys = Object.keys(localStorage);
            return prefix ? allKeys.filter((k) => k.startsWith(prefix)) : allKeys;
        } catch (error) {
            console.warn('Failed to get localStorage keys', error);
            return [];
        }
    }

    /**
     * Get the size of localStorage in bytes (approximate)
     * 
     * @returns Size in bytes
     */
    static size(): number {
        try {
            let total = 0;
            for (const key in localStorage) {
                if (Object.hasOwn(localStorage, key)) {
                    const value = localStorage.getItem(key);
                    total += key.length + (value?.length ?? 0);
                }
            }
            return total;
        } catch (error) {
            console.warn('Failed to calculate localStorage size', error);
            return 0;
        }
    }
}

/**
 * Convenience alias for TypeSafeStorage
 * 
 * @example
 * import { storage } from '$lib/utils/storage.util';
 * storage.set('key', 'value');
 */
export const storage = TypeSafeStorage;

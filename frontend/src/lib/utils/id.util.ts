/**
 * ID Generation Utilities
 * Centralized functions for generating unique identifiers
 */

/**
 * Generate a temporary local ID for offline-first features
 * Format: prefix_timestamp_randomString
 * 
 * @param prefix - Optional prefix for the ID (default: 'local')
 * @returns A unique local ID string
 * 
 * @example
 * generateLocalId() // 'local_1234567890_abc123'
 * generateLocalId('task') // 'task_1234567890_xyz789'
 */
export function generateLocalId(prefix = 'local'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if an ID is a temporary local ID
 * 
 * @param id - The ID to check
 * @param prefix - Optional prefix to check for (default: 'local')
 * @returns True if the ID is a local ID with the given prefix
 * 
 * @example
 * isLocalId('local_1234567890_abc123') // true
 * isLocalId('server_abc123') // false
 * isLocalId('task_1234567890_abc123', 'task') // true
 */
export function isLocalId(id: string, prefix = 'local'): boolean {
    return id.startsWith(`${prefix}_`);
}

/**
 * Generate a UUID v4 (universally unique identifier)
 * Uses the browser's crypto API for cryptographically secure random values
 * 
 * @returns A UUID v4 string
 * 
 * @example
 * generateUUID() // '550e8400-e29b-41d4-a716-446655440000'
 */
export function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Generate a short random ID (8 characters)
 * Useful for less critical IDs where full UUID is overkill
 * 
 * @returns A short random string
 * 
 * @example
 * generateShortId() // 'a7b3c9d2'
 */
export function generateShortId(): string {
    return Math.random().toString(36).substring(2, 10);
}

/**
 * Extract the timestamp from a local ID
 * 
 * @param localId - The local ID to extract timestamp from
 * @returns The timestamp in milliseconds, or null if invalid
 * 
 * @example
 * extractTimestamp('local_1234567890_abc123') // 1234567890
 */
export function extractTimestamp(localId: string): number | null {
    const parts = localId.split('_');
    if (parts.length >= 2) {
        const timestamp = parseInt(parts[1], 10);
        return isNaN(timestamp) ? null : timestamp;
    }
    return null;
}

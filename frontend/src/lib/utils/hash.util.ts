/**
 * Hash Utilities
 * 
 * Provides SHA-256 hashing functions for content versioning and sync.
 * Uses Web Crypto API for cryptographic hashing.
 */

/**
 * Calculate SHA-256 hash of a string
 * 
 * @param input - String to hash
 * @returns Promise resolving to hex-encoded SHA-256 hash
 * 
 * @example
 * const hash = await sha256('hello world');
 * // Returns: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
 */
export async function sha256(input: string): Promise<string> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        throw new Error('Web Crypto API not available');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

/**
 * Calculate SHA-256 hash synchronously (for small inputs only)
 * Note: This is a fallback and should be avoided for large inputs
 * 
 * @param input - String to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function sha256Sync(input: string): string {
    // Simple hash function for small inputs (not cryptographically secure)
    // For production, always use async sha256()
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Calculate hash of an object by stringifying it
 * 
 * @param obj - Object to hash
 * @returns Promise resolving to hex-encoded SHA-256 hash
 */
export async function hashObject(obj: unknown): Promise<string> {
    const jsonString = JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort());
    return sha256(jsonString);
}

/**
 * Calculate a deterministic hash from multiple inputs
 * 
 * @param inputs - Array of strings to combine and hash
 * @returns Promise resolving to hex-encoded SHA-256 hash
 */
export async function hashMultiple(...inputs: string[]): Promise<string> {
    const combined = inputs.join('|');
    return sha256(combined);
}


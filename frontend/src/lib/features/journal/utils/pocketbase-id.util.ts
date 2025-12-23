/**
 * PocketBase ID Generation Utility
 * 
 * Generates IDs matching PocketBase's format: 15-character lowercase alphanumeric
 * Example: '8khg0rrnv80266l'
 * 
 * Uses crypto.getRandomValues for cryptographically secure randomness
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 15;

/**
 * Generate a PocketBase-style ID (15-character lowercase alphanumeric)
 * 
 * @returns A 15-character ID matching PocketBase's format
 * 
 * @example
 * generateEntryId() // '8khg0rrnv80266l'
 */
export function generateEntryId(): string {
    let id = '';
    
    // Use crypto.getRandomValues for better randomness
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const randomValues = new Uint8Array(ID_LENGTH);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < ID_LENGTH; i++) {
            id += ALPHABET[randomValues[i] % ALPHABET.length];
        }
    } else {
        // Fallback for older browsers
        for (let i = 0; i < ID_LENGTH; i++) {
            id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
        }
    }
    
    return id;
}

/**
 * Validate if a string is a valid PocketBase-style ID
 * 
 * @param id - The ID to validate
 * @returns True if the ID is valid (15 characters, lowercase alphanumeric)
 * 
 * @example
 * isValidPocketBaseId('8khg0rrnv80266l') // true
 * isValidPocketBaseId('local_123') // false
 * isValidPocketBaseId('ABC123') // false
 */
export function isValidPocketBaseId(id: string): boolean {
    if (!id || id.length !== ID_LENGTH) {
        return false;
    }
    return /^[a-z0-9]{15}$/.test(id);
}


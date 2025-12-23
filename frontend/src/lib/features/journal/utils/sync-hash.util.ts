/**
 * Sync Hash Utilities
 * 
 * Provides hash calculation functions for version-based sync.
 * Calculates entry content hashes and global state hashes.
 */

import { sha256, hashMultiple } from '$lib/utils/hash.util';
import type { LocalStreamEntry } from '../types';

/**
 * Calculate content hash for a single entry.
 * 
 * Hashes only the content fields (excludes metadata like id, created, updated, version, sync fields).
 * This ensures the hash changes only when actual content changes.
 * 
 * @param entry - Entry to calculate hash for
 * @returns Promise resolving to SHA-256 hash of entry content
 */
export async function calculateEntryHash(entry: LocalStreamEntry): Promise<string> {
    // Extract only content fields (exclude metadata)
    const content = {
        content: entry.content || '',
        title: entry.title || '',
        entry_type: entry.entry_type,
        entry_color: entry.entry_color || null,
        is_highlighted: entry.is_highlighted || false,
        parent_entry: entry.parent_entry || null,
        entry_date: entry.entry_date,
        ai_context: entry.ai_context || null,
        // Explicitly exclude: id, user, created, updated, version, content_hash, 
        // last_synced_version, sync_device_id, syncStatus, lastModified
    };

    // Sort keys for deterministic JSON stringification
    const sortedContent = Object.keys(content)
        .sort()
        .reduce((acc, key) => {
            acc[key] = content[key as keyof typeof content];
            return acc;
        }, {} as Record<string, unknown>);

    const jsonString = JSON.stringify(sortedContent);
    return sha256(jsonString);
}

/**
 * Calculate global hash for all entries.
 * 
 * Creates a deterministic hash representing the entire state of all entries.
 * Used to quickly detect if frontend and backend states differ.
 * 
 * @param entries - Array of all entries
 * @returns Promise resolving to SHA-256 hash of global state
 */
export async function calculateFrontendHash(entries: LocalStreamEntry[]): Promise<string> {
    // Sort by ID for consistency
    const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));

    // Create hash input: id + version + content_hash for each entry
    const hashInputs = sorted.map(entry => {
        const version = entry.version || 0;
        const contentHash = entry.content_hash || '';
        return `${entry.id}:${version}:${contentHash}`;
    });

    // Combine all inputs and hash
    const combined = hashInputs.join('|');
    return sha256(combined);
}

/**
 * Calculate hash including entry count for additional validation.
 * 
 * This adds entry count to the hash to catch cases where entries are added/removed
 * but individual entry hashes might not change.
 * 
 * @param entries - Array of all entries
 * @returns Promise resolving to SHA-256 hash including count
 */
export async function calculateFrontendHashWithCount(entries: LocalStreamEntry[]): Promise<string> {
    const baseHash = await calculateFrontendHash(entries);
    const count = entries.length;
    return hashMultiple(baseHash, count.toString());
}

/**
 * Increment version number for an entry.
 * 
 * @param currentVersion - Current version number (defaults to 0)
 * @returns New version number
 */
export function incrementVersion(currentVersion: number = 0): number {
    return currentVersion + 1;
}

/**
 * Get or initialize version for an entry.
 * 
 * @param entry - Entry to get version for
 * @returns Version number (defaults to 1 if not set)
 */
export function getEntryVersion(entry: LocalStreamEntry): number {
    return entry.version || 1;
}

/**
 * Prepare entry for sync by updating version and hash.
 * 
 * @param entry - Entry to prepare
 * @returns Entry with updated version and content_hash
 */
export async function prepareEntryForSync(entry: LocalStreamEntry): Promise<LocalStreamEntry> {
    const contentHash = await calculateEntryHash(entry);
    const currentVersion = getEntryVersion(entry);
    const newVersion = incrementVersion(currentVersion);

    return {
        ...entry,
        version: newVersion,
        content_hash: contentHash,
    };
}


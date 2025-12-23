/**
 * Optimized Sync Hash Utilities
 * 
 * Performance-optimized version that only hashes changed entries.
 * Caches entry hashes to avoid recalculating unchanged entries.
 */

import { sha256 } from '$lib/utils/hash.util';
import type { LocalStreamEntry } from '../types';

/**
 * Cache for entry content hashes to avoid recalculating unchanged entries.
 * Key: entry.id, Value: { hash: string, version: number }
 */
const entryHashCache = new Map<string, { hash: string; version: number }>();

/**
 * Clear the hash cache (useful for testing or memory management).
 */
export function clearHashCache(): void {
    entryHashCache.clear();
}

/**
 * Calculate content hash for a single entry (with caching).
 * 
 * Only recalculates if entry version changed or hash not cached.
 * 
 * @param entry - Entry to calculate hash for
 * @returns Promise resolving to SHA-256 hash of entry content
 */
export async function calculateEntryHashCached(entry: LocalStreamEntry): Promise<string> {
    const cached = entryHashCache.get(entry.id);
    const currentVersion = entry.version || 1;

    // Return cached hash if entry hasn't changed
    if (cached && cached.version === currentVersion && cached.hash) {
        return cached.hash;
    }

    // Calculate new hash
    const content = {
        content: entry.content || '',
        title: entry.title || '',
        entry_type: entry.entry_type,
        entry_color: entry.entry_color || null,
        is_highlighted: entry.is_highlighted || false,
        parent_entry: entry.parent_entry || null,
        entry_date: entry.entry_date,
        ai_context: entry.ai_context || null,
    };

    const sortedContent = Object.keys(content)
        .sort()
        .reduce((acc, key) => {
            acc[key] = content[key as keyof typeof content];
            return acc;
        }, {} as Record<string, unknown>);

    const jsonString = JSON.stringify(sortedContent);
    const hash = await sha256(jsonString);

    // Cache the hash
    entryHashCache.set(entry.id, { hash, version: currentVersion });

    return hash;
}

/**
 * Calculate global hash for all entries (optimized - only hashes changed entries).
 * 
 * Uses cached hashes for unchanged entries, only recalculates changed ones.
 * This dramatically improves performance for large datasets.
 * 
 * @param entries - Array of all entries
 * @returns Promise resolving to SHA-256 hash of global state
 */
export async function calculateFrontendHashOptimized(entries: LocalStreamEntry[]): Promise<string> {
    // Sort by ID for consistency
    const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));

    // Calculate hashes for all entries (using cache)
    const hashPromises = sorted.map(entry => calculateEntryHashCached(entry));
    const hashes = await Promise.all(hashPromises);

    // Create hash input: id + version + content_hash for each entry
    const hashInputs = sorted.map((entry, index) => {
        const version = entry.version || 0;
        const contentHash = hashes[index];
        return `${entry.id}:${version}:${contentHash}`;
    });

    // Combine all inputs and hash
    const combined = hashInputs.join('|');
    return sha256(combined);
}

/**
 * Calculate global hash with incremental approach.
 * 
 * Only processes entries that have changed since last sync.
 * For unchanged entries, uses cached hash from sync state.
 * 
 * @param entries - Array of all entries
 * @param lastSyncedHashes - Map of entry IDs to their last synced hash
 * @returns Promise resolving to SHA-256 hash of global state
 */
export async function calculateFrontendHashIncremental(
    entries: LocalStreamEntry[],
    lastSyncedHashes?: Map<string, string>
): Promise<string> {
    const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));

    // Determine which entries need hashing
    const entriesToHash: LocalStreamEntry[] = [];
    const hashMap = new Map<string, string>();

    for (const entry of sorted) {
        const cached = entryHashCache.get(entry.id);
        const lastSyncedHash = lastSyncedHashes?.get(entry.id);
        const currentVersion = entry.version || 1;

        // Use cached hash if available and version matches
        if (cached && cached.version === currentVersion) {
            hashMap.set(entry.id, cached.hash);
            continue;
        }

        // Use last synced hash if entry hasn't changed
        if (lastSyncedHash && entry.content_hash === lastSyncedHash) {
            hashMap.set(entry.id, lastSyncedHash);
            entryHashCache.set(entry.id, { hash: lastSyncedHash, version: currentVersion });
            continue;
        }

        // Need to calculate hash
        entriesToHash.push(entry);
    }

    // Calculate hashes for changed entries only
    if (entriesToHash.length > 0) {
        const hashPromises = entriesToHash.map(entry => calculateEntryHashCached(entry));
        const hashes = await Promise.all(hashPromises);

        entriesToHash.forEach((entry, index) => {
            hashMap.set(entry.id, hashes[index]);
        });
    }

    // Create hash input: id + version + content_hash for each entry
    const hashInputs = sorted.map(entry => {
        const version = entry.version || 0;
        const contentHash = hashMap.get(entry.id) || '';
        return `${entry.id}:${version}:${contentHash}`;
    });

    // Combine all inputs and hash
    const combined = hashInputs.join('|');
    return sha256(combined);
}

/**
 * Get cache statistics for monitoring.
 */
export function getHashCacheStats(): {
    size: number;
    hitRate: number;
    entries: Array<{ id: string; version: number }>;
} {
    return {
        size: entryHashCache.size,
        hitRate: 0, // TODO: Track hits/misses
        entries: Array.from(entryHashCache.entries()).map(([id, value]) => ({
            id,
            version: value.version,
        })),
    };
}


/**
 * Credentials Storage Service
 * 
 * Provides IndexedDB-based local storage for credentials (developer tokens, API keys, security keys).
 * Enables offline-first functionality by caching data locally.
 * 
 * Extends BaseStorageService to leverage common patterns.
 */

import { BaseStorageService } from '$lib/services/base-storage.service';
import type { LocalDeveloperToken, LocalApiKey, LocalSecurityKey } from '../types';

const STORE_DEV_TOKENS = 'dev_tokens';
const STORE_API_KEYS = 'api_keys';
const STORE_SECURITY_KEYS = 'security_keys';

class CredentialsStorageServiceImpl extends BaseStorageService<LocalDeveloperToken | LocalApiKey | LocalSecurityKey> {
    constructor() {
        super({
            name: 'nen_space_credentials',
            version: 1,
            stores: [
                {
                    name: STORE_DEV_TOKENS,
                    keyPath: 'id',
                    indexes: [
                        { name: 'syncStatus', keyPath: 'syncStatus' },
                        { name: 'user', keyPath: 'user' },
                        { name: 'environment', keyPath: 'environment' },
                        { name: 'is_active', keyPath: 'is_active' },
                    ],
                },
                {
                    name: STORE_API_KEYS,
                    keyPath: 'id',
                    indexes: [
                        { name: 'syncStatus', keyPath: 'syncStatus' },
                        { name: 'user', keyPath: 'user' },
                        { name: 'service', keyPath: 'service' },
                        { name: 'is_active', keyPath: 'is_active' },
                    ],
                },
                {
                    name: STORE_SECURITY_KEYS,
                    keyPath: 'id',
                    indexes: [
                        { name: 'syncStatus', keyPath: 'syncStatus' },
                        { name: 'user', keyPath: 'user' },
                        { name: 'is_active', keyPath: 'is_active' },
                    ],
                },
            ],
        });
    }

    // ========================================
    // Developer Tokens Operations
    // ========================================

    async saveDeveloperToken(token: LocalDeveloperToken): Promise<void> {
        return this.save(STORE_DEV_TOKENS, token);
    }

    async getAllDeveloperTokens(): Promise<LocalDeveloperToken[]> {
        return this.getAll(STORE_DEV_TOKENS) as Promise<LocalDeveloperToken[]>;
    }

    async getPendingDeveloperTokens(): Promise<LocalDeveloperToken[]> {
        return this.getByIndex(STORE_DEV_TOKENS, 'syncStatus', 'pending') as Promise<LocalDeveloperToken[]>;
    }

    async getFailedDeveloperTokens(): Promise<LocalDeveloperToken[]> {
        return this.getByIndex(STORE_DEV_TOKENS, 'syncStatus', 'failed') as Promise<LocalDeveloperToken[]>;
    }

    async getDeveloperToken(id: string): Promise<LocalDeveloperToken | undefined> {
        return this.get(STORE_DEV_TOKENS, id) as Promise<LocalDeveloperToken | undefined>;
    }

    async deleteDeveloperToken(id: string): Promise<void> {
        return this.delete(STORE_DEV_TOKENS, id);
    }

    // ========================================
    // API Keys Operations
    // ========================================

    async saveApiKey(key: LocalApiKey): Promise<void> {
        return this.save(STORE_API_KEYS, key);
    }

    async getAllApiKeys(): Promise<LocalApiKey[]> {
        return this.getAll(STORE_API_KEYS) as Promise<LocalApiKey[]>;
    }

    async getPendingApiKeys(): Promise<LocalApiKey[]> {
        return this.getByIndex(STORE_API_KEYS, 'syncStatus', 'pending') as Promise<LocalApiKey[]>;
    }

    async getFailedApiKeys(): Promise<LocalApiKey[]> {
        return this.getByIndex(STORE_API_KEYS, 'syncStatus', 'failed') as Promise<LocalApiKey[]>;
    }

    async getApiKey(id: string): Promise<LocalApiKey | undefined> {
        return this.get(STORE_API_KEYS, id) as Promise<LocalApiKey | undefined>;
    }

    async deleteApiKey(id: string): Promise<void> {
        return this.delete(STORE_API_KEYS, id);
    }

    // ========================================
    // Security Keys Operations
    // ========================================

    async saveSecurityKey(key: LocalSecurityKey): Promise<void> {
        return this.save(STORE_SECURITY_KEYS, key);
    }

    async getAllSecurityKeys(): Promise<LocalSecurityKey[]> {
        return this.getAll(STORE_SECURITY_KEYS) as Promise<LocalSecurityKey[]>;
    }

    async getPendingSecurityKeys(): Promise<LocalSecurityKey[]> {
        return this.getByIndex(STORE_SECURITY_KEYS, 'syncStatus', 'pending') as Promise<LocalSecurityKey[]>;
    }

    async getFailedSecurityKeys(): Promise<LocalSecurityKey[]> {
        return this.getByIndex(STORE_SECURITY_KEYS, 'syncStatus', 'failed') as Promise<LocalSecurityKey[]>;
    }

    async getSecurityKey(id: string): Promise<LocalSecurityKey | undefined> {
        return this.get(STORE_SECURITY_KEYS, id) as Promise<LocalSecurityKey | undefined>;
    }

    async deleteSecurityKey(id: string): Promise<void> {
        return this.delete(STORE_SECURITY_KEYS, id);
    }

    // ========================================
    // Utility Operations
    // ========================================

    async clearAll(): Promise<void> {
        await this.clear(STORE_DEV_TOKENS);
        await this.clear(STORE_API_KEYS);
        await this.clear(STORE_SECURITY_KEYS);
    }

    async getSyncCounts(): Promise<{ pending: number; failed: number; synced: number }> {
        const [
            pendingDevTokens,
            failedDevTokens,
            pendingApiKeys,
            failedApiKeys,
            pendingSecurityKeys,
            failedSecurityKeys,
            allDevTokens,
            allApiKeys,
            allSecurityKeys,
        ] = await Promise.all([
            this.getPendingDeveloperTokens(),
            this.getFailedDeveloperTokens(),
            this.getPendingApiKeys(),
            this.getFailedApiKeys(),
            this.getPendingSecurityKeys(),
            this.getFailedSecurityKeys(),
            this.getAllDeveloperTokens(),
            this.getAllApiKeys(),
            this.getAllSecurityKeys(),
        ]);

        const pending = pendingDevTokens.length + pendingApiKeys.length + pendingSecurityKeys.length;
        const failed = failedDevTokens.length + failedApiKeys.length + failedSecurityKeys.length;
        const total = allDevTokens.length + allApiKeys.length + allSecurityKeys.length;
        const synced = total - pending - failed;

        return { pending, failed, synced };
    }
}

// Export singleton instance
export const CredentialsStorageService = new CredentialsStorageServiceImpl();

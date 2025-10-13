/**
 * Credentials Sync Services
 * 
 * Manages offline queue and automatic syncing for credentials.
 * Separate sync services for each credential type (dev tokens, API keys, security keys).
 * 
 * Extends BaseSyncService to leverage common patterns.
 */

import { BaseSyncService } from '$lib/services/base-sync.service.svelte';
import { CredentialsStorageService } from './credentials-storage.service';
import type { LocalDeveloperToken, LocalApiKey, LocalSecurityKey } from '../types';
import { pb } from '$lib/config/pocketbase';
import { COLLECTION_NAMES } from '../constants';

// ========================================
// Developer Tokens Sync Service
// ========================================

class DeveloperTokensSyncServiceImpl extends BaseSyncService<LocalDeveloperToken> {
    protected storageService = {
        save: (item: LocalDeveloperToken) => CredentialsStorageService.saveDeveloperToken(item),
        getAll: () => CredentialsStorageService.getAllDeveloperTokens(),
        getPending: () => CredentialsStorageService.getPendingDeveloperTokens(),
        getFailed: () => CredentialsStorageService.getFailedDeveloperTokens(),
        delete: (id: string) => CredentialsStorageService.deleteDeveloperToken(id),
        updateStatus: async (id: string, status: 'synced' | 'pending' | 'failed') => {
            const item = await CredentialsStorageService.getDeveloperToken(id);
            if (item) {
                item.syncStatus = status;
                await CredentialsStorageService.saveDeveloperToken(item);
            }
        },
    };
    protected eventName = 'developer-tokens-synced';

    protected async syncToServer(token: LocalDeveloperToken): Promise<LocalDeveloperToken> {
        const isLocalId = token.localId || token.id.startsWith('local_');

        if (isLocalId) {
            // Create new token on server (exclude id, localId, syncStatus, lastModified)
            const { id, localId, syncStatus, lastModified, ...tokenData } = token;
            const created = await pb.collection(COLLECTION_NAMES.DEV_TOKENS).create(tokenData);
            
            // Delete local temp token
            await CredentialsStorageService.deleteDeveloperToken(token.id);
            
            return created as LocalDeveloperToken;
        } else {
            // Update existing token on server
            const { syncStatus, lastModified, localId, ...tokenData } = token;
            const updated = await pb.collection(COLLECTION_NAMES.DEV_TOKENS).update(token.id, tokenData);
            return updated as LocalDeveloperToken;
        }
    }

    protected getItemDescription(token: LocalDeveloperToken): string {
        return `Developer Token "${token.name}"`;
    }

    async queueToken(token: LocalDeveloperToken): Promise<void> {
        return this.queueItem(token);
    }
}

// ========================================
// API Keys Sync Service
// ========================================

class ApiKeysSyncServiceImpl extends BaseSyncService<LocalApiKey> {
    protected storageService = {
        save: (item: LocalApiKey) => CredentialsStorageService.saveApiKey(item),
        getAll: () => CredentialsStorageService.getAllApiKeys(),
        getPending: () => CredentialsStorageService.getPendingApiKeys(),
        getFailed: () => CredentialsStorageService.getFailedApiKeys(),
        delete: (id: string) => CredentialsStorageService.deleteApiKey(id),
        updateStatus: async (id: string, status: 'synced' | 'pending' | 'failed') => {
            const item = await CredentialsStorageService.getApiKey(id);
            if (item) {
                item.syncStatus = status;
                await CredentialsStorageService.saveApiKey(item);
            }
        },
    };
    protected eventName = 'api-keys-synced';

    protected async syncToServer(key: LocalApiKey): Promise<LocalApiKey> {
        const isLocalId = key.localId || key.id.startsWith('local_');

        if (isLocalId) {
            // Create new key on server (exclude id, localId, syncStatus, lastModified)
            const { id, localId, syncStatus, lastModified, ...keyData } = key;
            const created = await pb.collection(COLLECTION_NAMES.API_KEYS).create(keyData);
            
            // Delete local temp key
            await CredentialsStorageService.deleteApiKey(key.id);
            
            return created as LocalApiKey;
        } else {
            // Update existing key on server
            const { syncStatus, lastModified, localId, ...keyData } = key;
            const updated = await pb.collection(COLLECTION_NAMES.API_KEYS).update(key.id, keyData);
            return updated as LocalApiKey;
        }
    }

    protected getItemDescription(key: LocalApiKey): string {
        return `API Key "${key.name}"`;
    }

    async queueKey(key: LocalApiKey): Promise<void> {
        return this.queueItem(key);
    }
}

// ========================================
// Security Keys Sync Service
// ========================================

class SecurityKeysSyncServiceImpl extends BaseSyncService<LocalSecurityKey> {
    protected storageService = {
        save: (item: LocalSecurityKey) => CredentialsStorageService.saveSecurityKey(item),
        getAll: () => CredentialsStorageService.getAllSecurityKeys(),
        getPending: () => CredentialsStorageService.getPendingSecurityKeys(),
        getFailed: () => CredentialsStorageService.getFailedSecurityKeys(),
        delete: (id: string) => CredentialsStorageService.deleteSecurityKey(id),
        updateStatus: async (id: string, status: 'synced' | 'pending' | 'failed') => {
            const item = await CredentialsStorageService.getSecurityKey(id);
            if (item) {
                item.syncStatus = status;
                await CredentialsStorageService.saveSecurityKey(item);
            }
        },
    };
    protected eventName = 'security-keys-synced';

    protected async syncToServer(key: LocalSecurityKey): Promise<LocalSecurityKey> {
        const isLocalId = key.localId || key.id.startsWith('local_');

        if (isLocalId) {
            // Create new key on server (exclude id, localId, syncStatus, lastModified)
            const { id, localId, syncStatus, lastModified, ...keyData } = key;
            const created = await pb.collection(COLLECTION_NAMES.SECURITY_KEYS).create(keyData);
            
            // Delete local temp key
            await CredentialsStorageService.deleteSecurityKey(key.id);
            
            return created as LocalSecurityKey;
        } else {
            // Update existing key on server
            const { syncStatus, lastModified, localId, ...keyData } = key;
            const updated = await pb.collection(COLLECTION_NAMES.SECURITY_KEYS).update(key.id, keyData);
            return updated as LocalSecurityKey;
        }
    }

    protected getItemDescription(key: LocalSecurityKey): string {
        return `Security Key "${key.name}"`;
    }

    async queueKey(key: LocalSecurityKey): Promise<void> {
        return this.queueItem(key);
    }
}

// Export singleton instances
export const DeveloperTokensSyncService = new DeveloperTokensSyncServiceImpl();
export const ApiKeysSyncService = new ApiKeysSyncServiceImpl();
export const SecurityKeysSyncService = new SecurityKeysSyncServiceImpl();

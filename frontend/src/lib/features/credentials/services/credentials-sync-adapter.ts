/**
 * Credentials Sync Adapter
 * 
 * Integrates credentials sync services with the UnifiedSyncService.
 * Provides a unified interface for syncing developer tokens, API keys, and security keys.
 */

import { UnifiedSyncService, type FeatureSyncService, type UnifiedPendingItem } from '$lib/services/unified-sync.service.svelte';
import { DeveloperTokensSyncService, ApiKeysSyncService, SecurityKeysSyncService } from './credentials-sync.service.svelte';
import { CredentialsStorageService } from './credentials-storage.service';

// Developer Tokens Adapter
const developerTokensAdapter: FeatureSyncService = {
    get syncStatus() {
        return DeveloperTokensSyncService.syncStatus;
    },
    
    async getPendingItems(): Promise<UnifiedPendingItem[]> {
        const pending = await CredentialsStorageService.getPendingDeveloperTokens();
        const failed = await CredentialsStorageService.getFailedDeveloperTokens();
        const all = [...pending, ...failed];
        
        return all
            .filter(item => item.syncStatus !== 'synced')
            .map(item => ({
                id: item.id,
                title: item.name,
                type: 'developer-token',
                syncStatus: item.syncStatus as 'pending' | 'failed',
            }));
    },
    
    async forceSyncNow(): Promise<void> {
        await DeveloperTokensSyncService.forceSyncNow();
    },
};

// API Keys Adapter
const apiKeysAdapter: FeatureSyncService = {
    get syncStatus() {
        return ApiKeysSyncService.syncStatus;
    },
    
    async getPendingItems(): Promise<UnifiedPendingItem[]> {
        const pending = await CredentialsStorageService.getPendingApiKeys();
        const failed = await CredentialsStorageService.getFailedApiKeys();
        const all = [...pending, ...failed];
        
        return all
            .filter(item => item.syncStatus !== 'synced')
            .map(item => ({
                id: item.id,
                title: item.name,
                type: 'api-key',
                syncStatus: item.syncStatus as 'pending' | 'failed',
            }));
    },
    
    async forceSyncNow(): Promise<void> {
        await ApiKeysSyncService.forceSyncNow();
    },
};

// Security Keys Adapter
const securityKeysAdapter: FeatureSyncService = {
    get syncStatus() {
        return SecurityKeysSyncService.syncStatus;
    },
    
    async getPendingItems(): Promise<UnifiedPendingItem[]> {
        const pending = await CredentialsStorageService.getPendingSecurityKeys();
        const failed = await CredentialsStorageService.getFailedSecurityKeys();
        const all = [...pending, ...failed];
        
        return all
            .filter(item => item.syncStatus !== 'synced')
            .map(item => ({
                id: item.id,
                title: item.name,
                type: 'security-key',
                syncStatus: item.syncStatus as 'pending' | 'failed',
            }));
    },
    
    async forceSyncNow(): Promise<void> {
        await SecurityKeysSyncService.forceSyncNow();
    },
};

// Register all adapters with UnifiedSyncService
UnifiedSyncService.register('developer-tokens', developerTokensAdapter);
UnifiedSyncService.register('api-keys', apiKeysAdapter);
UnifiedSyncService.register('security-keys', securityKeysAdapter);

/**
 * Credentials Service
 * 
 * Offline-first service for managing credentials (developer tokens, API keys, security keys).
 * Automatically handles online/offline states and sync.
 */

import { pb } from '$lib/config/pocketbase';
import { FilterBuilder, generateLocalId } from '$lib/utils';
import { NetworkService } from '$lib/services/network.service.svelte';
import type { DeveloperToken, ApiKey, SecurityKey, LocalDeveloperToken, LocalApiKey, LocalSecurityKey } from '../types';
import type { Token } from '$lib/features/tokens/types';
import { COLLECTION_NAMES, CREDENTIALS_PAGE_SIZE } from '../constants';
import { CredentialsStorageService } from './credentials-storage.service';
import { DeveloperTokensSyncService, ApiKeysSyncService, SecurityKeysSyncService } from './credentials-sync.service.svelte';

export class CredentialsService {
	// ==================== TOKENS (OAuth) ====================
	static async getTokens(): Promise<Token[]> {
		const userId = pb.authStore.model?.id;

		const filter = FilterBuilder.create().equals('user', userId).build();

		const result = await pb.collection(COLLECTION_NAMES.TOKENS).getList(1, CREDENTIALS_PAGE_SIZE, {
			sort: '-created',
			filter,
			expand: 'user'
		});

		return result.items as Token[];
	}

	static async createToken(data: Partial<Token>): Promise<Token> {
		const userId = pb.authStore.model?.id;

		// Check if online before attempting API call
		if (NetworkService.isOnline) {
			try {
				const created = await pb.collection(COLLECTION_NAMES.TOKENS).create({
					...data,
					user: userId,
					is_active: true
				});

				// Report success to NetworkService
				NetworkService.reportSuccess();

				return created as Token;
			} catch (error) {
				// Report failure to NetworkService (might trigger offline mode)
				NetworkService.reportFailure();
				
				console.error('Failed to create OAuth token:', error);
				// OAuth tokens require server authorization - can't fallback to offline
				throw error;
			}
		} else {
			// Offline: OAuth tokens require server authorization flow, can't create offline
			const errorMsg = 'OAuth tokens require server authorization (Google, GitHub, etc) and cannot be created offline. Please connect to the internet to authorize.';
			console.log('📴 Offline mode:', errorMsg);
			throw new Error(errorMsg);
		}
	}

	static async updateToken(id: string, data: Partial<Token>): Promise<Token> {
		if (NetworkService.isOnline) {
			try {
				const updated = await pb.collection(COLLECTION_NAMES.TOKENS).update(id, data);
				NetworkService.reportSuccess();
				return updated as Token;
			} catch (error) {
				NetworkService.reportFailure();
				throw error;
			}
		} else {
			throw new Error('Cannot update OAuth tokens while offline. Please connect to the internet.');
		}
	}

	static async deleteToken(id: string): Promise<void> {
		if (NetworkService.isOnline) {
			try {
				await pb.collection(COLLECTION_NAMES.TOKENS).delete(id);
				NetworkService.reportSuccess();
			} catch (error) {
				NetworkService.reportFailure();
				throw error;
			}
		} else {
			throw new Error('Cannot delete OAuth tokens while offline. Please connect to the internet.');
		}
	}

	static async toggleTokenStatus(id: string, currentStatus: boolean): Promise<Token> {
		const updated = await pb.collection(COLLECTION_NAMES.TOKENS).update(id, {
			is_active: !currentStatus
		});
		return updated as Token;
	}

	// ==================== DEVELOPER TOKENS (Offline-First) ====================
	static async getDeveloperTokens(): Promise<DeveloperToken[]> {
		const userId = pb.authStore.model?.id;

		if (NetworkService.isOnline) {
			try {
				const filter = FilterBuilder.create().equals('user', userId).build();

				const result = await pb
					.collection(COLLECTION_NAMES.DEV_TOKENS)
					.getList(1, CREDENTIALS_PAGE_SIZE, {
						sort: '-created',
						filter,
						expand: 'user'
					});

				// Cache to local storage
				await this.cacheDeveloperTokens(result.items as DeveloperToken[]);

				return result.items as DeveloperToken[];
			} catch (error) {
				console.error('Failed to fetch developer tokens from server, falling back to cache:', error);
				return await CredentialsStorageService.getAllDeveloperTokens();
			}
		} else {
			// Offline: return from cache
			return await CredentialsStorageService.getAllDeveloperTokens();
		}
	}

	static async createDeveloperToken(data: Partial<DeveloperToken>): Promise<DeveloperToken> {
		const userId = pb.authStore.model?.id;

		if (NetworkService.isOnline) {
			try {
				const created = await pb.collection(COLLECTION_NAMES.DEV_TOKENS).create({
					...data,
					user: userId
				});

				// Report success to NetworkService
				NetworkService.reportSuccess();

				// Cache the created token
				await CredentialsStorageService.saveDeveloperToken({
					...created,
					syncStatus: 'synced',
					lastModified: Date.now(),
				} as LocalDeveloperToken);

				return created as DeveloperToken;
			} catch (error) {
				// Report failure to NetworkService (might trigger offline mode)
				NetworkService.reportFailure();
				
				console.error('Failed to create developer token online, creating offline:', error);
				return await this.createDeveloperTokenOffline(data);
			}
		} else {
			// Offline: create with temp ID (skip API call)
			console.log('📴 Offline mode: Creating developer token locally');
			return await this.createDeveloperTokenOffline(data);
		}
	}

	private static async createDeveloperTokenOffline(data: Partial<DeveloperToken>): Promise<DeveloperToken> {
		const userId = pb.authStore.model?.id;
		const localToken: LocalDeveloperToken = {
			...data,
			id: generateLocalId('devtoken'),
			localId: generateLocalId('devtoken'),
			user: userId!,
			created: new Date().toISOString(),
			syncStatus: 'pending',
			lastModified: Date.now(),
		} as LocalDeveloperToken;

		await CredentialsStorageService.saveDeveloperToken(localToken);
		await DeveloperTokensSyncService.queueToken(localToken);

		return localToken;
	}

	static async updateDeveloperToken(
		id: string,
		data: Partial<DeveloperToken>
	): Promise<DeveloperToken> {
		if (NetworkService.isOnline) {
			try {
				const updated = await pb.collection(COLLECTION_NAMES.DEV_TOKENS).update(id, data);
				
				// Update cache
				await CredentialsStorageService.saveDeveloperToken({
					...updated,
					syncStatus: 'synced',
					lastModified: Date.now(),
				} as LocalDeveloperToken);

				return updated as DeveloperToken;
			} catch (error) {
				console.error('Failed to update developer token online, updating offline:', error);
				return await this.updateDeveloperTokenOffline(id, data);
			}
		} else {
			return await this.updateDeveloperTokenOffline(id, data);
		}
	}

	private static async updateDeveloperTokenOffline(id: string, data: Partial<DeveloperToken>): Promise<DeveloperToken> {
		const existing = await CredentialsStorageService.getDeveloperToken(id);
		if (!existing) throw new Error('Developer token not found');

		const updated: LocalDeveloperToken = {
			...existing,
			...data,
			syncStatus: 'pending',
			lastModified: Date.now(),
		};

		await CredentialsStorageService.saveDeveloperToken(updated);
		await DeveloperTokensSyncService.queueToken(updated);

		return updated;
	}

	static async deleteDeveloperToken(id: string): Promise<void> {
		if (NetworkService.isOnline) {
			await pb.collection(COLLECTION_NAMES.DEV_TOKENS).delete(id);
		}
		await CredentialsStorageService.deleteDeveloperToken(id);
	}

	static async toggleDeveloperTokenStatus(
		id: string,
		currentStatus: boolean
	): Promise<DeveloperToken> {
		return await this.updateDeveloperToken(id, { is_active: !currentStatus });
	}

	private static async cacheDeveloperTokens(tokens: DeveloperToken[]): Promise<void> {
		for (const token of tokens) {
			await CredentialsStorageService.saveDeveloperToken({
				...token,
				syncStatus: 'synced',
				lastModified: Date.now(),
			} as LocalDeveloperToken);
		}
	}

	// ==================== API KEYS (Offline-First) ====================
	static async getApiKeys(): Promise<ApiKey[]> {
		const userId = pb.authStore.model?.id;

		if (NetworkService.isOnline) {
			try {
				const filter = FilterBuilder.create().equals('user', userId).build();

				const result = await pb.collection(COLLECTION_NAMES.API_KEYS).getList(1, CREDENTIALS_PAGE_SIZE, {
					sort: '-created',
					filter,
					expand: 'user'
				});

				await this.cacheApiKeys(result.items as ApiKey[]);

				return result.items as ApiKey[];
			} catch (error) {
				console.error('Failed to fetch API keys from server, falling back to cache:', error);
				return await CredentialsStorageService.getAllApiKeys();
			}
		} else {
			return await CredentialsStorageService.getAllApiKeys();
		}
	}

	static async createApiKey(data: Partial<ApiKey>): Promise<ApiKey> {
		const userId = pb.authStore.model?.id;

		if (NetworkService.isOnline) {
			try {
				const created = await pb.collection(COLLECTION_NAMES.API_KEYS).create({
					...data,
					user: userId
				});

				await CredentialsStorageService.saveApiKey({
					...created,
					syncStatus: 'synced',
					lastModified: Date.now(),
				} as LocalApiKey);

				return created as ApiKey;
			} catch (error) {
				console.error('Failed to create API key online, creating offline:', error);
				return await this.createApiKeyOffline(data);
			}
		} else {
			return await this.createApiKeyOffline(data);
		}
	}

	private static async createApiKeyOffline(data: Partial<ApiKey>): Promise<ApiKey> {
		const userId = pb.authStore.model?.id;
		const localKey: LocalApiKey = {
			...data,
			id: generateLocalId('apikey'),
			localId: generateLocalId('apikey'),
			user: userId!,
			created: new Date().toISOString(),
			syncStatus: 'pending',
			lastModified: Date.now(),
		} as LocalApiKey;

		await CredentialsStorageService.saveApiKey(localKey);
		await ApiKeysSyncService.queueKey(localKey);

		return localKey;
	}

	static async updateApiKey(id: string, data: Partial<ApiKey>): Promise<ApiKey> {
		if (NetworkService.isOnline) {
			try {
				const updated = await pb.collection(COLLECTION_NAMES.API_KEYS).update(id, data);
				
				await CredentialsStorageService.saveApiKey({
					...updated,
					syncStatus: 'synced',
					lastModified: Date.now(),
				} as LocalApiKey);

				return updated as ApiKey;
			} catch (error) {
				console.error('Failed to update API key online, updating offline:', error);
				return await this.updateApiKeyOffline(id, data);
			}
		} else {
			return await this.updateApiKeyOffline(id, data);
		}
	}

	private static async updateApiKeyOffline(id: string, data: Partial<ApiKey>): Promise<ApiKey> {
		const existing = await CredentialsStorageService.getApiKey(id);
		if (!existing) throw new Error('API key not found');

		const updated: LocalApiKey = {
			...existing,
			...data,
			syncStatus: 'pending',
			lastModified: Date.now(),
		};

		await CredentialsStorageService.saveApiKey(updated);
		await ApiKeysSyncService.queueKey(updated);

		return updated;
	}

	static async deleteApiKey(id: string): Promise<void> {
		if (NetworkService.isOnline) {
			await pb.collection(COLLECTION_NAMES.API_KEYS).delete(id);
		}
		await CredentialsStorageService.deleteApiKey(id);
	}

	static async toggleApiKeyStatus(id: string, currentStatus: boolean): Promise<ApiKey> {
		return await this.updateApiKey(id, { is_active: !currentStatus });
	}

	private static async cacheApiKeys(keys: ApiKey[]): Promise<void> {
		for (const key of keys) {
			await CredentialsStorageService.saveApiKey({
				...key,
				syncStatus: 'synced',
				lastModified: Date.now(),
			} as LocalApiKey);
		}
	}

	// ==================== SECURITY KEYS (Offline-First) ====================
	static async getSecurityKeys(): Promise<SecurityKey[]> {
		const userId = pb.authStore.model?.id;

		if (NetworkService.isOnline) {
			try {
				const filter = FilterBuilder.create().equals('user', userId).build();

				const result = await pb
					.collection(COLLECTION_NAMES.SECURITY_KEYS)
					.getList(1, CREDENTIALS_PAGE_SIZE, {
						sort: '-created',
						filter,
						expand: 'user'
					});

				await this.cacheSecurityKeys(result.items as SecurityKey[]);

				return result.items as SecurityKey[];
			} catch (error) {
				console.error('Failed to fetch security keys from server, falling back to cache:', error);
				return await CredentialsStorageService.getAllSecurityKeys();
			}
		} else {
			return await CredentialsStorageService.getAllSecurityKeys();
		}
	}

	static async createSecurityKey(data: Partial<SecurityKey>): Promise<SecurityKey> {
		const userId = pb.authStore.model?.id;

		if (NetworkService.isOnline) {
			try {
				const created = await pb.collection(COLLECTION_NAMES.SECURITY_KEYS).create({
					...data,
					user: userId
				});

				await CredentialsStorageService.saveSecurityKey({
					...created,
					syncStatus: 'synced',
					lastModified: Date.now(),
				} as LocalSecurityKey);

				return created as SecurityKey;
			} catch (error) {
				console.error('Failed to create security key online, creating offline:', error);
				return await this.createSecurityKeyOffline(data);
			}
		} else {
			return await this.createSecurityKeyOffline(data);
		}
	}

	private static async createSecurityKeyOffline(data: Partial<SecurityKey>): Promise<SecurityKey> {
		const userId = pb.authStore.model?.id;
		const localKey: LocalSecurityKey = {
			...data,
			id: generateLocalId('seckey'),
			localId: generateLocalId('seckey'),
			user: userId!,
			created: new Date().toISOString(),
			updated: new Date().toISOString(),
			syncStatus: 'pending',
			lastModified: Date.now(),
		} as LocalSecurityKey;

		await CredentialsStorageService.saveSecurityKey(localKey);
		await SecurityKeysSyncService.queueKey(localKey);

		return localKey;
	}

	static async updateSecurityKey(id: string, data: Partial<SecurityKey>): Promise<SecurityKey> {
		if (NetworkService.isOnline) {
			try {
				const updated = await pb.collection(COLLECTION_NAMES.SECURITY_KEYS).update(id, data);
				
				await CredentialsStorageService.saveSecurityKey({
					...updated,
					syncStatus: 'synced',
					lastModified: Date.now(),
				} as LocalSecurityKey);

				return updated as SecurityKey;
			} catch (error) {
				console.error('Failed to update security key online, updating offline:', error);
				return await this.updateSecurityKeyOffline(id, data);
			}
		} else {
			return await this.updateSecurityKeyOffline(id, data);
		}
	}

	private static async updateSecurityKeyOffline(id: string, data: Partial<SecurityKey>): Promise<SecurityKey> {
		const existing = await CredentialsStorageService.getSecurityKey(id);
		if (!existing) throw new Error('Security key not found');

		const updated: LocalSecurityKey = {
			...existing,
			...data,
			updated: new Date().toISOString(),
			syncStatus: 'pending',
			lastModified: Date.now(),
		};

		await CredentialsStorageService.saveSecurityKey(updated);
		await SecurityKeysSyncService.queueKey(updated);

		return updated;
	}

	static async deleteSecurityKey(id: string): Promise<void> {
		if (NetworkService.isOnline) {
			await pb.collection(COLLECTION_NAMES.SECURITY_KEYS).delete(id);
		}
		await CredentialsStorageService.deleteSecurityKey(id);
	}

	static async toggleSecurityKeyStatus(id: string, currentStatus: boolean): Promise<SecurityKey> {
		return await this.updateSecurityKey(id, { is_active: !currentStatus });
	}

	private static async cacheSecurityKeys(keys: SecurityKey[]): Promise<void> {
		for (const key of keys) {
			await CredentialsStorageService.saveSecurityKey({
				...key,
				syncStatus: 'synced',
				lastModified: Date.now(),
			} as LocalSecurityKey);
		}
	}
}
/**
 * PocketBase Auth Helpers
 * 
 * Helper functions for PocketBase authentication operations.
 */

import type PocketBase from 'pocketbase';
import type { StoredAuth, PocketBaseUser } from '../../types';
import { createLogger } from '../../utils/logger.util';

const logger = createLogger('[PocketBase:Auth]');

/**
 * Check if PocketBase auth is valid
 */
export function isPocketBaseAuthValid(pb: PocketBase): boolean {
    return pb.authStore.isValid && !!pb.authStore.token;
}

/**
 * Get user from PocketBase auth store
 */
export function getUserFromAuthStore(pb: PocketBase): PocketBaseUser | null {
    if (!pb.authStore.model) {
        return null;
    }
    
    const model = pb.authStore.model as any;
    
    return {
        id: model.id,
        email: model.email || '',
        name: model.name,
        username: model.username,
        verified: model.verified ?? false,
        created: model.created || '',
        updated: model.updated || '',
    };
}

/**
 * Convert stored auth to PocketBase auth store format
 */
export function restoreAuthToStore(pb: PocketBase, auth: StoredAuth): void {
    const userRecord = {
        id: auth.userId,
        email: auth.email,
        name: auth.email.split('@')[0],
        collectionId: '_pb_users_auth_',
        collectionName: 'users',
    };
    
    pb.authStore.save(auth.primaryToken, userRecord);
    
    logger.debug('Auth restored to PocketBase', {
        userId: auth.userId,
        isValid: pb.authStore.isValid,
    });
}

/**
 * Clear PocketBase auth store
 */
export function clearAuthStore(pb: PocketBase): void {
    pb.authStore.clear();
    logger.debug('Auth store cleared');
}

/**
 * Check if error is auth-related
 */
export function isAuthError(error: any): boolean {
    const status = error?.status || error?.code;
    return status === 401 || status === 403;
}

/**
 * Refresh auth token
 */
export async function refreshAuthToken(pb: PocketBase): Promise<boolean> {
    try {
        if (!pb.authStore.isValid) {
            return false;
        }
        
        await pb.collection('users').authRefresh();
        logger.debug('Auth token refreshed');
        return true;
    } catch (error) {
        logger.error('Failed to refresh auth token', error);
        return false;
    }
}


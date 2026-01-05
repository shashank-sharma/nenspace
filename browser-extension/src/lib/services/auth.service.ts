import type { PocketBaseUser, StoredAuth } from '../types';
import { getPocketBase } from './pocketbase';
import { handlePocketBaseError } from './pocketbase/error-handler';
import { restoreAuthToStore, clearAuthStore } from './pocketbase/auth-helpers';
import { authStorage } from './plasmo-storage.service';
import { createLogger } from '../utils/logger.util';
import { AuthError } from '../utils/error.util';
import { type Result, success, failure, wrapAsync } from '../types/result.types';

const logger = createLogger('[AuthService]');

class AuthService {
  async initializeFromStorage(): Promise<boolean> {
    try {
      const authResult = await authStorage.get();
      if (!authResult.success || !authResult.data) return false;
      const auth = authResult.data;

      const pb = getPocketBase(auth.backendUrl);
      restoreAuthToStore(pb, auth);
      
      return pb.authStore.isValid;
    } catch (error) {
      logger.error('Failed to initialize auth from storage', error);
      return false;
    }
  }

  async login(backendUrl: string, email: string, password: string): Promise<Result<{ token: string; user: PocketBaseUser }>> {
    try {
      const pb = getPocketBase(backendUrl);
      const authData = await pb.collection('users').authWithPassword(email, password);

      return success({
        token: pb.authStore.token,
        user: authData.record as PocketBaseUser
      });
    } catch (error) {
      logger.error('Login failed', error);
      return failure(handlePocketBaseError(error, 'Login'));
    }
  }

  async logout(): Promise<Result<void>> {
    try {
      const pb = getPocketBase();
      clearAuthStore(pb);
      const result = await authStorage.clear();
      if (!result.success) return result;
      return success(undefined);
    } catch (error) {
      logger.error('Logout failed', error);
      return failure(new AuthError('Failed to logout'));
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const authResult = await authStorage.get();
    if (!authResult.success || !authResult.data) return false;
    const auth = authResult.data;

    if (auth.expiresAt && Date.now() > auth.expiresAt) {
      logger.warn('Auth token expired, clearing auth data');
      await this.logout();
      return false;
    }

    const pb = getPocketBase(auth.backendUrl);
    
    if (!pb.authStore.isValid || pb.authStore.token !== auth.primaryToken) {
      restoreAuthToStore(pb, auth);
    }
    
    return pb.authStore.isValid;
  }

  async getCurrentUser(): Promise<PocketBaseUser | null> {
    const authResult = await authStorage.get();
    if (!authResult.success || !authResult.data) return null;
    const auth = authResult.data;

    return {
      id: auth.userId,
      email: auth.email,
      name: auth.email.split('@')[0],
      username: auth.email.split('@')[0],
      verified: true,
      created: '',
      updated: ''
    };
  }

  async getStoredAuth(): Promise<Result<StoredAuth | null>> {
    return await authStorage.get();
  }

  async refreshAuth(backendUrl: string): Promise<Result<boolean>> {
    try {
      const pb = getPocketBase(backendUrl);
      if (!pb.authStore.isValid) {
        logger.warn('Cannot refresh token: auth store is invalid');
        return success(false);
      }

      await pb.collection('users').authRefresh();
      logger.debug('Auth token refreshed successfully');
      return success(true);
    } catch (error) {
      logger.error('Token refresh failed', error);
      await this.logout();
      return failure(handlePocketBaseError(error, 'Token refresh'));
    }
  }
}

export const authService = new AuthService();

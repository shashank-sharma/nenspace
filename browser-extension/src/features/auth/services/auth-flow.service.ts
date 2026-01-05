/**
 * Authentication Flow Service
 * 
 * Handles complete authentication flow including login and profile management.
 */

import type { StoredAuth } from '../../../lib/types'
import type { AuthFlowResult } from '../types'
import { authService } from '../../../lib/services/auth.service'
import { authStorage, settingsStorage, profileStorage } from '../../../lib/services/plasmo-storage.service'
import { getPocketBase, updatePocketBaseUrl } from '../../../lib/services/pocketbase/client'
import { formatError } from '../../../lib/utils/error-handler.util'
import { normalizeBackendUrl } from '../../../lib/utils/api.util'
import { verifyProfile, markInactive } from '../../../lib/services/profile.service'
import { AUTH_STEPS, AUTH_STEP_MESSAGES } from '../constants'
import { createLogger } from '../../../lib/utils/logger.util'

const logger = createLogger('[AuthFlowService]')

class AuthFlowService {
  /**
   * Complete authentication flow
   * 1. Login with PocketBase and save credentials
   */
  async completeAuthFlow(
    backendUrl: string,
    email: string,
    password: string,
    _deviceName: string, // Keep for backwards compatibility but don't use
    onProgress?: (step: string, message: string) => void
  ): Promise<AuthFlowResult> {
    try {
      // Normalize backend URL
      const normalizedUrl = normalizeBackendUrl(backendUrl)
      updatePocketBaseUrl(normalizedUrl)

      // Step 1: Login
      onProgress?.(AUTH_STEPS.LOGIN, AUTH_STEP_MESSAGES[AUTH_STEPS.LOGIN])
      const loginResult = await authService.login(
        normalizedUrl,
        email,
        password
      )

      if (!loginResult.success) {
        throw loginResult.error || new Error('Login failed')
      }

      const { token: primaryToken, user } = loginResult.data

      // Create auth data object
      const authData: StoredAuth = {
        userId: user.id,
        primaryToken,
        backendUrl: normalizedUrl,
        email: user.email,
        expiresAt: undefined // Will be set by PocketBase auth store
      }

      // Save to storage
      logger.debug('Saving auth data', { userId: authData.userId, backendUrl: normalizedUrl, email: authData.email })
      await authStorage.save(authData)
      await settingsStorage.saveBackendUrl(normalizedUrl)
      logger.debug('Auth data saved successfully')
      
      // Verify the data was saved correctly
      const savedAuthResult = await authStorage.get()
      const savedAuth = savedAuthResult.success ? savedAuthResult.data : null
      logger.debug('Verification - saved auth data', { 
        saved: savedAuth ? { userId: savedAuth.userId, email: savedAuth.email, hasToken: !!savedAuth.primaryToken } : null 
      })

      const pb = getPocketBase(normalizedUrl)
      if (pb.authStore.token !== primaryToken) {
        pb.authStore.save(primaryToken, user)
      }

      return {
        success: true,
        authData,
        needsProfileSelection: true
      }
    } catch (error) {
      logger.error('Auth flow failed', error)
      return {
        success: false,
        error: formatError(error)
      }
    }
  }

  /**
   * Check if stored authentication is still valid
   */
  async checkAuthStatus(): Promise<boolean> {
    try {
      return await authService.isAuthenticated()
    } catch (error) {
      logger.error('Failed to check auth status', error)
      return false
    }
  }

  /**
   * Check if profile selection is needed after login
   */
  private async checkProfileSelection(authData: StoredAuth): Promise<boolean> {
    try {
      const profileIdResult = await profileStorage.getProfileId()
      const profileId = profileIdResult.success ? profileIdResult.data : null
      
      if (!profileId) {
        return true
      }

      const profile = await verifyProfile(authData.backendUrl, authData.primaryToken, profileId)
      
      if (!profile) {
        await profileStorage.clearProfileId()
        return true
      }

      return false
    } catch (error) {
      logger.error('Failed to check profile selection', error)
      return true
    }
  }

  /**
   * Logout and clear all data
   */
  async logout(): Promise<void> {
    try {
      const profileIdResult = await profileStorage.getProfileId()
      const profileId = profileIdResult.success ? profileIdResult.data : null
      if (profileId) {
        try {
          const authDataResult = await authService.getStoredAuth()
          if (authDataResult.success && authDataResult.data) {
            const authData = authDataResult.data
            await markInactive(authData.backendUrl, authData.primaryToken, profileId)
          }
        } catch (error) {
          logger.warn('Failed to mark profile inactive', error)
        }
      }

      await profileStorage.clearProfileId()
      await authService.logout()
    } catch (error) {
      logger.error('Logout failed', error)
      throw error
    }
  }
}

export const authFlowService = new AuthFlowService()


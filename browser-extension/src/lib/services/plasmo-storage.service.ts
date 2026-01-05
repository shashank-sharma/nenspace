import { Storage } from "@plasmohq/storage"
import { SecureStorage } from "@plasmohq/storage/secure"
import { createLogger } from "../utils/logger.util"
import type { ActivityData, ActivitySettings, ActivityCheckpoint } from "../types/activity.types"
import { type Result, success, failure, wrapAsync } from '../types/result.types'

const logger = createLogger('[PlasmoStorage]')

export const storage = new Storage({ area: "local" })
export const syncStorage = new Storage({ area: "sync" })
export const secureStorage = new SecureStorage()

let secureStorageInitialized = false

async function ensureSecureStorageInitialized(): Promise<void> {
  if (!secureStorageInitialized) {
    await initializeSecureStorage()
  }
}

async function initializeSecureStorage(): Promise<void> {
  if (secureStorageInitialized) return
  
  try {
    const deviceId = await getDeviceId()
    const password = `nenspace-${deviceId}`
    
    await secureStorage.setPassword(password)
    secureStorageInitialized = true
    logger.debug('Secure storage initialized')
  } catch (error) {
    logger.error('Failed to initialize secure storage', error)
  }
}

const DEVICE_ID_KEY = "nenspace_device_id"

async function getDeviceId(): Promise<string> {
  try {
    const existing = await storage.get(DEVICE_ID_KEY)
    if (existing && typeof existing === 'string') return existing

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('Device fingerprint', 2, 2)
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|')
    
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    
    const deviceId = Math.abs(hash).toString(36)
    await storage.set(DEVICE_ID_KEY, deviceId)
    return deviceId
  } catch (error) {
    const randomId = Math.random().toString(36).substring(2, 15)
    await storage.set(DEVICE_ID_KEY, randomId).catch(() => {})
    return randomId
  }
}

export const KEYS = {
  AUTH: "nenspace_auth",
  DEV_TOKEN: "nenspace_dev_token", 
  THEME: "nenspace_theme",
  BACKEND_URL: "nenspace_backend_url",
  PROFILE_ID: "nenspace_profile_id",
  ACTIVITY_SETTINGS: "nenspace_activity_settings",
  ACTIVITY_DATA: "nenspace_activity_data",
  HISTORY_CHECKPOINT: "nenspace_history_checkpoint",
  USER_SETTINGS: "nenspace_user_settings"
} as const

export interface StoredAuth {
  primaryToken: string
  userId: string
  backendUrl: string
  email: string
  expiresAt?: number
}

export interface HistoryCheckpoint {
  lastSyncTime: number
  totalSynced: number
  lastProcessedId?: string
}

export interface UserPreferences {
  theme: string
  shortcuts: Record<string, string>
  uiSettings: {
    floatingNavPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    commandPaletteShortcut: string
    statusIndicatorPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    showNotifications: boolean
    notificationDuration: number
  }
  privacySettings: {
    trackActivity: boolean
    syncHistory: boolean
    shareAnalytics: boolean
  }
  notificationSettings: {
    enabled: boolean
    showSuccessNotifications: boolean
    showErrorNotifications: boolean
    showProgressNotifications: boolean
    soundEnabled: boolean
  }
}

export const authStorage = {
  async save(authData: StoredAuth): Promise<Result<void>> {
    try {
      await storage.set(KEYS.AUTH, authData)
      
      try {
        await ensureSecureStorageInitialized()
        await secureStorage.set(KEYS.AUTH, authData)
      } catch (secureError) {
        logger.warn('Failed to save to secure storage', secureError)
      }
      return success(undefined)
    } catch (error) {
      logger.error('Failed to save auth data', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async get(): Promise<Result<StoredAuth | null>> {
    try {
      const authData = await storage.get(KEYS.AUTH)
      if (authData) return success(authData as StoredAuth)
      
      try {
        await ensureSecureStorageInitialized()
        const secureData = await secureStorage.get(KEYS.AUTH)
        return success(secureData as StoredAuth || null)
      } catch (secureError) {
        logger.warn('Failed to get from secure storage', secureError)
        return success(null)
      }
    } catch (error) {
      logger.error('Failed to get auth data', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async clear(): Promise<Result<void>> {
    try {
      await storage.remove(KEYS.AUTH)
      try {
        await ensureSecureStorageInitialized()
        await secureStorage.remove(KEYS.AUTH)
      } catch (secureError) {
        logger.warn('Failed to clear from secure storage', secureError)
      }
      return success(undefined)
    } catch (error) {
      logger.error('Failed to clear auth data', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const authResult = await this.get()
    return authResult.success && authResult.data !== null && !!authResult.data.primaryToken && !!authResult.data.userId
  }
}

export const devTokenStorage = {
  async save(token: string): Promise<Result<void>> {
    try {
      await storage.set(KEYS.DEV_TOKEN, token)
      
      try {
        await ensureSecureStorageInitialized()
        await secureStorage.set(KEYS.DEV_TOKEN, token)
      } catch (secureError) {
        logger.warn('Failed to save to secure storage', secureError)
      }
      return success(undefined)
    } catch (error) {
      logger.error('Failed to save dev token', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async get(): Promise<Result<string | null>> {
    try {
      const token = await storage.get(KEYS.DEV_TOKEN)
      if (token) return success(token as string)
      
      try {
        await ensureSecureStorageInitialized()
        const secureToken = await secureStorage.get(KEYS.DEV_TOKEN)
        return success(secureToken as string || null)
      } catch (secureError) {
        logger.warn('Failed to get from secure storage', secureError)
        return success(null)
      }
    } catch (error) {
      logger.error('Failed to get dev token', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async clear(): Promise<Result<void>> {
    try {
      await storage.remove(KEYS.DEV_TOKEN)
      
      try {
        await ensureSecureStorageInitialized()
        await secureStorage.remove(KEYS.DEV_TOKEN)
      } catch (secureError) {
        logger.warn('Failed to clear from secure storage', secureError)
      }
      return success(undefined)
    } catch (error) {
      logger.error('Failed to clear dev token', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  }
}

export const settingsStorage = {
  async saveTheme(theme: string, sync: boolean = true): Promise<Result<void>> {
    try {
      if (sync) {
        await syncStorage.set(KEYS.THEME, theme)
      } else {
        await storage.set(KEYS.THEME, theme)
      }
      return success(undefined)
    } catch (error) {
      logger.error('Failed to save theme', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async getTheme(): Promise<Result<string>> {
    try {
      let theme = await syncStorage.get(KEYS.THEME)
      if (!theme) {
        theme = await storage.get(KEYS.THEME)
      }
      return success(theme as string || 'dark')
    } catch (error) {
      logger.error('Failed to get theme', error)
      return success('dark')
    }
  },

  async saveBackendUrl(url: string): Promise<Result<void>> {
    try {
      await storage.set(KEYS.BACKEND_URL, url)
      return success(undefined)
    } catch (error) {
      logger.error('Failed to save backend URL', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async getBackendUrl(): Promise<Result<string | null>> {
    try {
      const url = await storage.get(KEYS.BACKEND_URL)
      return success(url as string || null)
    } catch (error) {
      logger.error('Failed to get backend URL', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async saveActivitySettings(settings: ActivitySettings): Promise<Result<void>> {
    try {
      await storage.set(KEYS.ACTIVITY_SETTINGS, settings)
      return success(undefined)
    } catch (error) {
      logger.error('[PlasmoStorage] Failed to save activity settings', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async getActivitySettings(): Promise<Result<ActivitySettings | null>> {
    try {
      const settings = await storage.get(KEYS.ACTIVITY_SETTINGS)
      return success(settings as ActivitySettings || null)
    } catch (error) {
      logger.error('[PlasmoStorage] Failed to get activity settings', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  }
}

export const userPreferencesStorage = {
  async savePreferences(preferences: UserPreferences): Promise<Result<void>> {
    try {
      await syncStorage.set(KEYS.USER_SETTINGS, preferences)
      return success(undefined)
    } catch (error) {
      logger.error('Failed to save user preferences', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async getPreferences(): Promise<Result<UserPreferences | null>> {
    try {
      const preferences = await syncStorage.get(KEYS.USER_SETTINGS)
      return success(preferences as UserPreferences || null)
    } catch (error) {
      logger.error('Failed to get user preferences', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async updateTheme(theme: string): Promise<Result<void>> {
    try {
      const currentResult = await this.getPreferences()
      const current = currentResult.success && currentResult.data ? currentResult.data : this.getDefaultPreferences()
      const updated = { ...current, theme }
      return await this.savePreferences(updated)
    } catch (error) {
      logger.error('Failed to update theme in preferences', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async updateShortcuts(shortcuts: Record<string, string>): Promise<Result<void>> {
    try {
      const currentResult = await this.getPreferences()
      const current = currentResult.success && currentResult.data ? currentResult.data : this.getDefaultPreferences()
      const updated = { ...current, shortcuts }
      return await this.savePreferences(updated)
    } catch (error) {
      logger.error('Failed to update shortcuts in preferences', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async updateUISettings(uiSettings: Partial<UserPreferences['uiSettings']>): Promise<Result<void>> {
    try {
      const currentResult = await this.getPreferences()
      const current = currentResult.success && currentResult.data ? currentResult.data : this.getDefaultPreferences()
      const updated = { 
        ...current, 
        uiSettings: { ...current.uiSettings, ...uiSettings }
      }
      return await this.savePreferences(updated)
    } catch (error) {
      logger.error('Failed to update UI settings in preferences', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async updatePrivacySettings(privacySettings: Partial<UserPreferences['privacySettings']>): Promise<Result<void>> {
    try {
      const currentResult = await this.getPreferences()
      const current = currentResult.success && currentResult.data ? currentResult.data : this.getDefaultPreferences()
      const updated = { 
        ...current, 
        privacySettings: { ...current.privacySettings, ...privacySettings }
      }
      return await this.savePreferences(updated)
    } catch (error) {
      logger.error('Failed to update privacy settings in preferences', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async updateNotificationSettings(notificationSettings: Partial<UserPreferences['notificationSettings']>): Promise<Result<void>> {
    try {
      const currentResult = await this.getPreferences()
      const current = currentResult.success && currentResult.data ? currentResult.data : this.getDefaultPreferences()
      const updated = { 
        ...current, 
        notificationSettings: { ...current.notificationSettings, ...notificationSettings }
      }
      return await this.savePreferences(updated)
    } catch (error) {
      logger.error('Failed to update notification settings in preferences', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  getDefaultPreferences(): UserPreferences {
    return {
      theme: 'dark',
      shortcuts: {
        'command-palette': 'Ctrl+Shift+P',
        'toggle-floating-nav': 'Ctrl+Shift+N',
        'toggle-status-indicator': 'Ctrl+Shift+S'
      },
      uiSettings: {
        floatingNavPosition: 'top-right',
        commandPaletteShortcut: 'Ctrl+Shift+P',
        statusIndicatorPosition: 'top-left',
        showNotifications: true,
        notificationDuration: 3000
      },
      privacySettings: {
        trackActivity: true,
        syncHistory: true,
        shareAnalytics: false
      },
      notificationSettings: {
        enabled: true,
        showSuccessNotifications: true,
        showErrorNotifications: true,
        showProgressNotifications: false,
        soundEnabled: true
      }
    }
  }
}

export const profileStorage = {
  async saveProfileId(profileId: string): Promise<Result<void>> {
    try {
      await storage.set(KEYS.PROFILE_ID, profileId)
      return success(undefined)
    } catch (error) {
      logger.error('Failed to save profile ID', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async getProfileId(): Promise<Result<string | null>> {
    try {
      const profileId = await storage.get(KEYS.PROFILE_ID)
      return success(profileId as string || null)
    } catch (error) {
      logger.error('Failed to get profile ID', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async clearProfileId(): Promise<Result<void>> {
    try {
      await storage.remove(KEYS.PROFILE_ID)
      return success(undefined)
    } catch (error) {
      logger.error('Failed to clear profile ID', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  }
}

export const activityStorage = {
  async saveActivityData(data: ActivityData): Promise<Result<void>> {
    try {
      await storage.set(KEYS.ACTIVITY_DATA, data)
      return success(undefined)
    } catch (error) {
      logger.error('Failed to save activity data', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async getActivityData(): Promise<Result<ActivityData | null>> {
    try {
      const data = await storage.get(KEYS.ACTIVITY_DATA)
      return success(data as ActivityData || null)
    } catch (error) {
      logger.error('Failed to get activity data', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async clearActivityData(): Promise<Result<void>> {
    try {
      await storage.remove(KEYS.ACTIVITY_DATA)
      return success(undefined)
    } catch (error) {
      logger.error('Failed to clear activity data', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  }
}

export const historyStorage = {
  async saveCheckpoint(checkpoint: HistoryCheckpoint): Promise<Result<void>> {
    try {
      await storage.set(KEYS.HISTORY_CHECKPOINT, checkpoint)
      return success(undefined)
    } catch (error) {
      logger.error('Failed to save history checkpoint', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async getCheckpoint(): Promise<Result<HistoryCheckpoint | null>> {
    try {
      const checkpoint = await storage.get(KEYS.HISTORY_CHECKPOINT)
      return success(checkpoint as HistoryCheckpoint || null)
    } catch (error) {
      logger.error('Failed to get history checkpoint', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  },

  async clearCheckpoint(): Promise<Result<void>> {
    try {
      await storage.remove(KEYS.HISTORY_CHECKPOINT)
      return success(undefined)
    } catch (error) {
      logger.error('Failed to clear history checkpoint', error)
      return failure(error instanceof Error ? error : new Error(String(error)))
    }
  }
}

export const watchStorage = {
  watchAuth(callback: (auth: StoredAuth | null) => void): () => void {
    return secureStorage.watch({
      [KEYS.AUTH]: (change) => {
        callback(change.newValue || null)
      }
    })
  },

  watchTheme(callback: (theme: string) => void): () => void {
    return storage.watch({
      [KEYS.THEME]: (change) => {
        callback(change.newValue || 'dark')
      }
    })
  },

  watchActivitySettings(callback: (settings: ActivitySettings | null) => void): () => void {
    return storage.watch({
      [KEYS.ACTIVITY_SETTINGS]: (change) => {
        callback(change.newValue || null)
      }
    })
  },

  watchProfileId(callback: (profileId: string | null) => void): () => void {
    return storage.watch({
      [KEYS.PROFILE_ID]: (change) => {
        callback(change.newValue || null)
      }
    })
  },

  watchUserPreferences(callback: (preferences: UserPreferences | null) => void): () => void {
    return syncStorage.watch({
      [KEYS.USER_SETTINGS]: (change) => {
        callback(change.newValue || null)
      }
    })
  },

  watchThemeSync(callback: (theme: string) => void): () => void {
    return syncStorage.watch({
      [KEYS.THEME]: (change) => {
        callback(change.newValue || 'dark')
      }
    })
  }
}

export const storageUtils = {
  async getAll(): Promise<Record<string, any>> {
    try {
      return await storage.getAll()
    } catch (error) {
      logger.error('Failed to get all storage', error)
      return {}
    }
  },

  async clearAll(): Promise<void> {
    try {
      await storage.clear()
    } catch (error) {
      logger.error('Failed to clear all storage', error)
      throw error
    }
  }
}

export {
  authStorage as auth,
  devTokenStorage as devToken,
  settingsStorage as settings,
  profileStorage as profile,
  activityStorage as activity,
  historyStorage as history,
  userPreferencesStorage as userPreferences,
  watchStorage as watch,
  storageUtils as utils
}

export type {
  StoredAuth,
  ActivitySettings,
  HistoryCheckpoint,
  UserPreferences
}

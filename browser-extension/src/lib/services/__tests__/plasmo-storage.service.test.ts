/**
 * Tests for Plasmo Storage Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  authStorage, 
  devTokenStorage, 
  settingsStorage, 
  userPreferencesStorage,
  activityStorage,
  profileStorage,
  historyStorage,
  watchStorage
} from '../plasmo-storage.service'
import type { StoredAuth, ActivityData, UserPreferences } from '../plasmo-storage.service'

// Mock Plasmo Storage
const mockStorage = {
  set: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  getAll: vi.fn(),
  watch: vi.fn()
}

const mockSecureStorage = {
  set: vi.fn(),
  get: vi.fn(),
  remove: vi.fn()
}

const mockSyncStorage = {
  set: vi.fn(),
  get: vi.fn(),
  watch: vi.fn()
}

// Mock the storage modules
vi.mock('@plasmohq/storage', () => ({
  Storage: vi.fn(() => mockStorage)
}))

vi.mock('@plasmohq/storage/secure', () => ({
  SecureStorage: vi.fn(() => mockSecureStorage)
}))

// Mock logger to avoid console output during tests
vi.mock('../../utils/logger.util', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('Auth Storage', () => {
  const mockAuthData: StoredAuth = {
    primaryToken: 'test-token',
    userId: 'user-123',
    backendUrl: 'https://api.example.com',
    email: 'test@example.com',
    expiresAt: Date.now() + 3600000
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('save', () => {
    it('should save auth data to secure storage', async () => {
      mockSecureStorage.set.mockResolvedValue(undefined)

      await authStorage.save(mockAuthData)

      expect(mockSecureStorage.set).toHaveBeenCalledWith('nenspace_auth', mockAuthData)
    })

    it('should throw error if save fails', async () => {
      const error = new Error('Storage error')
      mockSecureStorage.set.mockRejectedValue(error)

      await expect(authStorage.save(mockAuthData)).rejects.toThrow('Storage error')
    })
  })

  describe('get', () => {
    it('should retrieve auth data from secure storage', async () => {
      mockSecureStorage.get.mockResolvedValue(mockAuthData)

      const result = await authStorage.get()

      expect(result).toEqual(mockAuthData)
      expect(mockSecureStorage.get).toHaveBeenCalledWith('nenspace_auth')
    })

    it('should return null if no auth data exists', async () => {
      mockSecureStorage.get.mockResolvedValue(null)

      const result = await authStorage.get()

      expect(result).toBeNull()
    })

    it('should return null if storage fails', async () => {
      mockSecureStorage.get.mockRejectedValue(new Error('Storage error'))

      const result = await authStorage.get()

      expect(result).toBeNull()
    })
  })

  describe('clear', () => {
    it('should remove auth data from secure storage', async () => {
      mockSecureStorage.remove.mockResolvedValue(undefined)

      await authStorage.clear()

      expect(mockSecureStorage.remove).toHaveBeenCalledWith('nenspace_auth')
    })

    it('should throw error if clear fails', async () => {
      const error = new Error('Storage error')
      mockSecureStorage.remove.mockRejectedValue(error)

      await expect(authStorage.clear()).rejects.toThrow('Storage error')
    })
  })

  describe('isAuthenticated', () => {
    it('should return true for valid auth data', async () => {
      mockSecureStorage.get.mockResolvedValue(mockAuthData)

      const result = await authStorage.isAuthenticated()

      expect(result).toBe(true)
    })

    it('should return false for null auth data', async () => {
      mockSecureStorage.get.mockResolvedValue(null)

      const result = await authStorage.isAuthenticated()

      expect(result).toBe(false)
    })

    it('should return false for incomplete auth data', async () => {
      const incompleteAuth = { ...mockAuthData, primaryToken: '' }
      mockSecureStorage.get.mockResolvedValue(incompleteAuth)

      const result = await authStorage.isAuthenticated()

      expect(result).toBe(false)
    })
  })
})

describe('Dev Token Storage', () => {
  const testToken = 'dev-token-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('save', () => {
    it('should save dev token to secure storage', async () => {
      mockSecureStorage.set.mockResolvedValue(undefined)

      await devTokenStorage.save(testToken)

      expect(mockSecureStorage.set).toHaveBeenCalledWith('nenspace_dev_token', testToken)
    })
  })

  describe('get', () => {
    it('should retrieve dev token from secure storage', async () => {
      mockSecureStorage.get.mockResolvedValue(testToken)

      const result = await devTokenStorage.get()

      expect(result).toBe(testToken)
    })

    it('should return null if no token exists', async () => {
      mockSecureStorage.get.mockResolvedValue(null)

      const result = await devTokenStorage.get()

      expect(result).toBeNull()
    })
  })

  describe('clear', () => {
    it('should remove dev token from secure storage', async () => {
      mockSecureStorage.remove.mockResolvedValue(undefined)

      await devTokenStorage.clear()

      expect(mockSecureStorage.remove).toHaveBeenCalledWith('nenspace_dev_token')
    })
  })
})

describe('Settings Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveTheme', () => {
    it('should save theme to sync storage by default', async () => {
      mockSyncStorage.set.mockResolvedValue(undefined)

      await settingsStorage.saveTheme('dark')

      expect(mockSyncStorage.set).toHaveBeenCalledWith('nenspace_theme', 'dark')
    })

    it('should save theme to local storage when sync is false', async () => {
      mockStorage.set.mockResolvedValue(undefined)

      await settingsStorage.saveTheme('light', false)

      expect(mockStorage.set).toHaveBeenCalledWith('nenspace_theme', 'light')
    })
  })

  describe('getTheme', () => {
    it('should get theme from sync storage first', async () => {
      mockSyncStorage.get.mockResolvedValue('dark')
      mockStorage.get.mockResolvedValue('light')

      const result = await settingsStorage.getTheme()

      expect(result).toBe('dark')
    })

    it('should fallback to local storage if sync storage is empty', async () => {
      mockSyncStorage.get.mockResolvedValue(null)
      mockStorage.get.mockResolvedValue('light')

      const result = await settingsStorage.getTheme()

      expect(result).toBe('light')
    })

    it('should return default theme if both storages are empty', async () => {
      mockSyncStorage.get.mockResolvedValue(null)
      mockStorage.get.mockResolvedValue(null)

      const result = await settingsStorage.getTheme()

      expect(result).toBe('dark')
    })
  })
})

describe('User Preferences Storage', () => {
  const mockPreferences: UserPreferences = {
    theme: 'dark',
    shortcuts: {
      'command-palette': 'Ctrl+Shift+P'
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

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('savePreferences', () => {
    it('should save preferences to sync storage', async () => {
      mockSyncStorage.set.mockResolvedValue(undefined)

      await userPreferencesStorage.savePreferences(mockPreferences)

      expect(mockSyncStorage.set).toHaveBeenCalledWith('nenspace_user_settings', mockPreferences)
    })
  })

  describe('getPreferences', () => {
    it('should retrieve preferences from sync storage', async () => {
      mockSyncStorage.get.mockResolvedValue(mockPreferences)

      const result = await userPreferencesStorage.getPreferences()

      expect(result).toEqual(mockPreferences)
    })

    it('should return null if no preferences exist', async () => {
      mockSyncStorage.get.mockResolvedValue(null)

      const result = await userPreferencesStorage.getPreferences()

      expect(result).toBeNull()
    })
  })

  describe('updateTheme', () => {
    it('should update theme in existing preferences', async () => {
      mockSyncStorage.get.mockResolvedValue(mockPreferences)
      mockSyncStorage.set.mockResolvedValue(undefined)

      await userPreferencesStorage.updateTheme('light')

      expect(mockSyncStorage.set).toHaveBeenCalledWith('nenspace_user_settings', {
        ...mockPreferences,
        theme: 'light'
      })
    })

    it('should create new preferences with default values if none exist', async () => {
      mockSyncStorage.get.mockResolvedValue(null)
      mockSyncStorage.set.mockResolvedValue(undefined)

      await userPreferencesStorage.updateTheme('light')

      expect(mockSyncStorage.set).toHaveBeenCalledWith('nenspace_user_settings', {
        theme: 'light',
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
      })
    })
  })
})

describe('Activity Storage', () => {
  const mockActivityData: ActivityData = {
    id: 'activity-123',
    url: 'https://example.com',
    title: 'Example Page',
    timestamp: Date.now(),
    duration: 5000,
    domain: 'example.com',
    isIncognito: false,
    profileId: 'profile-123'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveActivityData', () => {
    it('should save activity data to local storage', async () => {
      mockStorage.set.mockResolvedValue(undefined)

      await activityStorage.saveActivityData(mockActivityData)

      expect(mockStorage.set).toHaveBeenCalledWith('nenspace_activity_data', mockActivityData)
    })
  })

  describe('getActivityData', () => {
    it('should retrieve activity data from local storage', async () => {
      mockStorage.get.mockResolvedValue(mockActivityData)

      const result = await activityStorage.getActivityData()

      expect(result).toEqual(mockActivityData)
    })

    it('should return null if no activity data exists', async () => {
      mockStorage.get.mockResolvedValue(null)

      const result = await activityStorage.getActivityData()

      expect(result).toBeNull()
    })
  })
})

describe('Watch Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('watchAuth', () => {
    it('should setup auth watcher with secure storage', () => {
      const mockCallback = vi.fn()
      const mockUnwatch = vi.fn()
      mockSecureStorage.watch.mockReturnValue(mockUnwatch)

      const unwatch = watchStorage.watchAuth(mockCallback)

      expect(mockSecureStorage.watch).toHaveBeenCalledWith({
        'nenspace_auth': expect.any(Function)
      })
      expect(unwatch).toBe(mockUnwatch)
    })
  })

  describe('watchTheme', () => {
    it('should setup theme watcher with local storage', () => {
      const mockCallback = vi.fn()
      const mockUnwatch = vi.fn()
      mockStorage.watch.mockReturnValue(mockUnwatch)

      const unwatch = watchStorage.watchTheme(mockCallback)

      expect(mockStorage.watch).toHaveBeenCalledWith({
        'nenspace_theme': expect.any(Function)
      })
      expect(unwatch).toBe(mockUnwatch)
    })
  })

  describe('watchUserPreferences', () => {
    it('should setup user preferences watcher with sync storage', () => {
      const mockCallback = vi.fn()
      const mockUnwatch = vi.fn()
      mockSyncStorage.watch.mockReturnValue(mockUnwatch)

      const unwatch = watchStorage.watchUserPreferences(mockCallback)

      expect(mockSyncStorage.watch).toHaveBeenCalledWith({
        'nenspace_user_settings': expect.any(Function)
      })
      expect(unwatch).toBe(mockUnwatch)
    })
  })
})

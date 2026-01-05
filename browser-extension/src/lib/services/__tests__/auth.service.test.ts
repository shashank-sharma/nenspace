/**
 * Unit tests for AuthService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authService } from '../auth.service'
import { storage } from '../plasmo-storage.service'

// Mock dependencies
vi.mock('../plasmo-storage.service', () => ({
  storage: {
    auth: {
      getAuth: vi.fn(),
      clearAuth: vi.fn()
    }
  }
}))

vi.mock('../config/pocketbase', () => ({
  getPocketBase: vi.fn(() => ({
    authStore: {
      isValid: false,
      token: null,
      save: vi.fn(),
      clear: vi.fn()
    },
    collection: vi.fn(() => ({
      authWithPassword: vi.fn(),
      authRefresh: vi.fn()
    }))
  }))
}))

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isAuthenticated', () => {
    it('should return false when no auth data exists', async () => {
      vi.mocked(storage.auth.getAuth).mockResolvedValue(null)
      
      const result = await authService.isAuthenticated()
      
      expect(result).toBe(false)
    })

    it('should return false when token is expired', async () => {
      const expiredAuth = {
        primaryToken: 'token123',
        userId: 'user123',
        backendUrl: 'http://localhost:8090',
        email: 'test@example.com',
        expiresAt: Date.now() - 1000 // Expired 1 second ago
      }
      
      vi.mocked(storage.auth.getAuth).mockResolvedValue(expiredAuth)
      
      const result = await authService.isAuthenticated()
      
      expect(result).toBe(false)
    })

    it('should return true when token is valid and not expired', async () => {
      const validAuth = {
        primaryToken: 'token123',
        userId: 'user123',
        backendUrl: 'http://localhost:8090',
        email: 'test@example.com',
        expiresAt: Date.now() + 3600000 // Expires in 1 hour
      }
      
      vi.mocked(storage.auth.getAuth).mockResolvedValue(validAuth)
      
      const result = await authService.isAuthenticated()
      
      expect(result).toBe(true)
    })
  })

  describe('getCurrentUser', () => {
    it('should return null when no auth data exists', async () => {
      vi.mocked(storage.auth.getAuth).mockResolvedValue(null)
      
      const result = await authService.getCurrentUser()
      
      expect(result).toBe(null)
    })

    it('should return user data when auth exists', async () => {
      const auth = {
        primaryToken: 'token123',
        userId: 'user123',
        backendUrl: 'http://localhost:8090',
        email: 'test@example.com'
      }
      
      vi.mocked(storage.auth.getAuth).mockResolvedValue(auth)
      
      const result = await authService.getCurrentUser()
      
      expect(result).toEqual({
        id: 'user123',
        email: 'test@example.com',
        name: 'test',
        username: 'test',
        verified: true,
        created: '',
        updated: ''
      })
    })
  })

  describe('logout', () => {
    it('should clear auth data and PocketBase store', async () => {
      const mockPb = {
        authStore: {
          clear: vi.fn()
        }
      }
      
      vi.mocked(require('../config/pocketbase').getPocketBase).mockReturnValue(mockPb)
      vi.mocked(storage.auth.clearAuth).mockResolvedValue()
      
      await authService.logout()
      
      expect(mockPb.authStore.clear).toHaveBeenCalled()
      expect(storage.auth.clearAuth).toHaveBeenCalled()
    })
  })
})


/**
 * Feature Flags Service
 * 
 * Provides feature flag management for gradual rollouts and A/B testing.
 */

import { createLogger } from '../utils/logger.util'
import { storage } from './plasmo-storage.service'

const logger = createLogger('[FeatureFlags]')

export interface FeatureFlag {
  id: string
  name: string
  description: string
  enabled: boolean
  rolloutPercentage: number
  targetUsers?: string[]
  targetBrowsers?: string[]
  targetVersions?: string[]
  startDate?: string
  endDate?: string
  metadata?: Record<string, any>
}

export interface FeatureFlagConfig {
  flags: FeatureFlag[]
  version: string
  lastUpdated: string
}

export interface UserContext {
  userId?: string
  browser: string
  version: string
  isIncognito: boolean
  locale: string
}

class FeatureFlagsService {
  private flags: Map<string, FeatureFlag> = new Map()
  private config: FeatureFlagConfig | null = null
  private userContext: UserContext | null = null
  private cacheKey = 'nenspace_feature_flags'
  private cacheExpiry = 5 * 60 * 1000 // 5 minutes
  private lastFetch = 0

  /**
   * Initialize feature flags service
   */
  async initialize(context: UserContext): Promise<void> {
    this.userContext = context
    await this.loadFlags()
    logger.debug('Feature flags service initialized', { context })
  }

  /**
   * Check if a feature flag is enabled for the current user
   */
  isEnabled(flagId: string): boolean {
    const flag = this.flags.get(flagId)
    if (!flag) {
      logger.warn(`Feature flag not found: ${flagId}`)
      return false
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return false
    }

    // Check date range
    if (flag.startDate && new Date() < new Date(flag.startDate)) {
      return false
    }

    if (flag.endDate && new Date() > new Date(flag.endDate)) {
      return false
    }

    // Check user context
    if (!this.isUserEligible(flag)) {
      return false
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const userHash = this.getUserHash(flagId)
      const percentage = userHash % 100
      return percentage < flag.rolloutPercentage
    }

    return true
  }

  /**
   * Get feature flag value with fallback
   */
  getValue<T>(flagId: string, fallback: T): T {
    const flag = this.flags.get(flagId)
    if (!flag || !this.isEnabled(flagId)) {
      return fallback
    }

    return (flag.metadata?.value as T) ?? fallback
  }

  /**
   * Get all enabled feature flags
   */
  getEnabledFlags(): string[] {
    return Array.from(this.flags.keys()).filter(flagId => this.isEnabled(flagId))
  }

  /**
   * Get feature flag metadata
   */
  getFlagMetadata(flagId: string): Record<string, any> | null {
    const flag = this.flags.get(flagId)
    return flag?.metadata ?? null
  }

  /**
   * Refresh feature flags from remote source
   */
  async refreshFlags(): Promise<void> {
    try {
      // In a real implementation, this would fetch from your backend
      const remoteConfig = await this.fetchRemoteConfig()
      if (remoteConfig) {
        this.config = remoteConfig
        this.flags.clear()
        remoteConfig.flags.forEach(flag => {
          this.flags.set(flag.id, flag)
        })
        await this.saveFlags()
        this.lastFetch = Date.now()
        logger.debug('Feature flags refreshed', { count: this.flags.size })
      }
    } catch (error) {
      logger.error('Failed to refresh feature flags', error)
    }
  }

  /**
   * Load feature flags from storage
   */
  private async loadFlags(): Promise<void> {
    try {
      const stored = await storage.get(this.cacheKey)
      if (stored && stored.config && stored.timestamp) {
        const age = Date.now() - stored.timestamp
        if (age < this.cacheExpiry) {
          this.config = stored.config
          this.flags.clear()
          stored.config.flags.forEach((flag: FeatureFlag) => {
            this.flags.set(flag.id, flag)
          })
          this.lastFetch = stored.timestamp
          logger.debug('Feature flags loaded from cache', { count: this.flags.size })
          return
        }
      }
    } catch (error) {
      logger.error('Failed to load feature flags from storage', error)
    }

    // Load default flags if cache is invalid
    await this.loadDefaultFlags()
  }

  /**
   * Save feature flags to storage
   */
  private async saveFlags(): Promise<void> {
    try {
      await storage.set(this.cacheKey, {
        config: this.config,
        timestamp: Date.now()
      })
    } catch (error) {
      logger.error('Failed to save feature flags to storage', error)
    }
  }

  /**
   * Load default feature flags
   */
  private async loadDefaultFlags(): Promise<void> {
    const defaultFlags: FeatureFlag[] = [
      {
        id: 'enhanced_search',
        name: 'Enhanced Search',
        description: 'Improved search functionality with better ranking',
        enabled: true,
        rolloutPercentage: 100,
        metadata: { version: '2.0' }
      },
      {
        id: 'dark_mode_auto',
        name: 'Automatic Dark Mode',
        description: 'Automatically switch to dark mode based on system preference',
        enabled: true,
        rolloutPercentage: 50,
        metadata: { autoSwitch: true }
      },
      {
        id: 'advanced_analytics',
        name: 'Advanced Analytics',
        description: 'Enhanced analytics and usage tracking',
        enabled: false,
        rolloutPercentage: 0,
        metadata: { trackingLevel: 'enhanced' }
      },
      {
        id: 'beta_features',
        name: 'Beta Features',
        description: 'Access to experimental features',
        enabled: false,
        rolloutPercentage: 10,
        targetUsers: ['beta-testers'],
        metadata: { experimental: true }
      }
    ]

    this.config = {
      flags: defaultFlags,
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    }

    this.flags.clear()
    defaultFlags.forEach(flag => {
      this.flags.set(flag.id, flag)
    })

    await this.saveFlags()
    logger.debug('Default feature flags loaded', { count: this.flags.size })
  }

  /**
   * Fetch remote feature flag configuration
   */
  private async fetchRemoteConfig(): Promise<FeatureFlagConfig | null> {
    // In a real implementation, this would make an API call to your backend
    // For now, return null to use default flags
    return null
  }

  /**
   * Check if user is eligible for a feature flag
   */
  private isUserEligible(flag: FeatureFlag): boolean {
    if (!this.userContext) {
      return false
    }

    // Check target users
    if (flag.targetUsers && flag.targetUsers.length > 0) {
      if (!this.userContext.userId || !flag.targetUsers.includes(this.userContext.userId)) {
        return false
      }
    }

    // Check target browsers
    if (flag.targetBrowsers && flag.targetBrowsers.length > 0) {
      if (!flag.targetBrowsers.includes(this.userContext.browser)) {
        return false
      }
    }

    // Check target versions
    if (flag.targetVersions && flag.targetVersions.length > 0) {
      if (!flag.targetVersions.includes(this.userContext.version)) {
        return false
      }
    }

    // Check incognito mode
    if (this.userContext.isIncognito && flag.metadata?.excludeIncognito) {
      return false
    }

    return true
  }

  /**
   * Generate consistent hash for user-based rollouts
   */
  private getUserHash(flagId: string): number {
    if (!this.userContext) {
      return Math.random() * 100
    }

    const input = `${flagId}-${this.userContext.userId || 'anonymous'}-${this.userContext.browser}`
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Get feature flag statistics
   */
  getStats(): {
    totalFlags: number
    enabledFlags: number
    rolloutFlags: number
    lastUpdated: string | null
  } {
    const totalFlags = this.flags.size
    const enabledFlags = Array.from(this.flags.values()).filter(flag => flag.enabled).length
    const rolloutFlags = Array.from(this.flags.values()).filter(flag => 
      flag.enabled && flag.rolloutPercentage < 100
    ).length

    return {
      totalFlags,
      enabledFlags,
      rolloutFlags,
      lastUpdated: this.config?.lastUpdated ?? null
    }
  }
}

// Export singleton instance
export const featureFlagsService = new FeatureFlagsService()

/**
 * Hook for using feature flags in components
 */
export function useFeatureFlag(flagId: string): boolean {
  return featureFlagsService.isEnabled(flagId)
}

/**
 * Hook for getting feature flag value
 */
export function useFeatureFlagValue<T>(flagId: string, fallback: T): T {
  return featureFlagsService.getValue(flagId, fallback)
}

/**
 * Browser Profile Management Service
 * 
 * Handles browser profile operations including creation, verification, and updates.
 */

import { createLogger } from '../utils/logger.util';

const logger = createLogger('[ProfileService]');

export interface BrowserProfile {
  id: string
  user: string
  profile_name: string
  browser_info?: {
    browser: string
    os: string
    version: string
  }
  settings?: Record<string, any>
  is_active: boolean
  last_used_at?: string
  created: string
  updated: string
}

export interface CreateProfileData {
  user: string
  profile_name: string
  browser_info?: {
    browser: string
    os: string
    version: string
  }
  settings?: Record<string, any>
}

export interface UpdateProfileData {
  profile_name?: string
  settings?: Record<string, any>
  last_used_at?: string
  is_active?: boolean
}

/**
 * Get browser information from user agent
 */
export function getBrowserInfo(): { browser: string; os: string; version: string } {
  const userAgent = navigator.userAgent
  
  // Detect browser
  let browser = 'Unknown'
  let version = 'Unknown'
  
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome'
    const match = userAgent.match(/Chrome\/(\d+\.\d+)/)
    if (match) version = match[1]
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox'
    const match = userAgent.match(/Firefox\/(\d+\.\d+)/)
    if (match) version = match[1]
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari'
    const match = userAgent.match(/Version\/(\d+\.\d+)/)
    if (match) version = match[1]
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge'
    const match = userAgent.match(/Edg\/(\d+\.\d+)/)
    if (match) version = match[1]
  }
  
  // Detect OS
  let os = 'Unknown'
  if (userAgent.includes('Windows')) {
    os = 'Windows'
  } else if (userAgent.includes('Mac OS X') || userAgent.includes('macOS')) {
    os = 'macOS'
  } else if (userAgent.includes('Linux')) {
    os = 'Linux'
  } else if (userAgent.includes('Android')) {
    os = 'Android'
  } else if (userAgent.includes('iOS')) {
    os = 'iOS'
  }
  
  return { browser, os, version }
}


/**
 * Fetch user's active browser profiles
 */
export async function fetchUserProfiles(
  backendUrl: string,
  token: string,
  userId: string
): Promise<BrowserProfile[]> {
  try {
    const response = await fetch(
      `${backendUrl}/api/collections/browser_profiles/records?filter=user="${userId}" && is_active=true&sort=-last_used_at`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      throw new Error(`Failed to fetch profiles: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.items || []
  } catch (error) {
    logger.error('Failed to fetch user profiles', error)
    throw error
  }
}

/**
 * Create a new browser profile
 */
export async function createProfile(
  backendUrl: string,
  token: string,
  data: CreateProfileData
): Promise<BrowserProfile> {
  try {
    const response = await fetch(
      `${backendUrl}/api/collections/browser_profiles/records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Failed to create profile: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`)
    }
    
    const profile = await response.json()
    return profile
  } catch (error) {
    logger.error('Failed to create profile', error)
    throw error
  }
}

/**
 * Update an existing browser profile
 */
export async function updateProfile(
  backendUrl: string,
  token: string,
  profileId: string,
  data: UpdateProfileData
): Promise<BrowserProfile> {
  try {
    const response = await fetch(
      `${backendUrl}/api/collections/browser_profiles/records/${profileId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Failed to update profile: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`)
    }
    
    const profile = await response.json()
    return profile
  } catch (error) {
    logger.error('Failed to update profile', error)
    throw error
  }
}

/**
 * Verify that a profile exists and is accessible
 */
export async function verifyProfile(
  backendUrl: string,
  token: string,
  profileId: string
): Promise<BrowserProfile | null> {
  try {
    const response = await fetch(
      `${backendUrl}/api/collections/browser_profiles/records/${profileId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (response.status === 404) {
      return null
    }
    
    if (!response.ok) {
      throw new Error(`Failed to verify profile: ${response.status} ${response.statusText}`)
    }
    
    const profile = await response.json()
    return profile
  } catch (error) {
    logger.error('Failed to verify profile', error)
    return null
  }
}

/**
 * Mark a profile as inactive (soft delete)
 */
export async function markInactive(
  backendUrl: string,
  token: string,
  profileId: string
): Promise<void> {
  try {
    await updateProfile(backendUrl, token, profileId, {
      is_active: false
    })
  } catch (error) {
    logger.error('Failed to mark profile inactive', error)
    throw error
  }
}

/**
 * Update profile's last used timestamp
 */
export async function updateLastUsed(
  backendUrl: string,
  token: string,
  profileId: string
): Promise<void> {
  try {
    await updateProfile(backendUrl, token, profileId, {
      last_used_at: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to update last used', error)
    throw error
  }
}

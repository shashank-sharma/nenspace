/**
 * Activity Types
 * 
 * Type definitions for activity tracking and storage.
 */

export interface ActivityData {
  id: string
  url: string
  title: string
  timestamp: number
  duration: number
  domain: string
  isIncognito: boolean
  profileId?: string
}

export interface ActivityRecord {
  id?: string
  user: string
  browser_profile: string
  url: string
  title: string
  domain?: string
  start_time: Date
  end_time?: Date
  duration?: number
  tab_id?: number
  window_id?: number
  audible: boolean
  incognito: boolean
  metadata?: ActivityMetadata
  session_id?: string
  created?: string
  updated?: string
}

export interface ActivityMetadata {
  referrer?: string
  tabCount?: number
  scrollDepth?: number
  [key: string]: any
}

export interface HeartbeatData {
  url: string
  title: string
  audible: boolean
  incognito: boolean
  tabCount: number
  tabId: number
  windowId: number
}

export interface ActivitySession {
  id: string
  startTime: number
  endTime?: number
  activities: ActivityData[]
  totalDuration: number
  domain: string
}

export interface ActivitySummary {
  totalTime: number
  domainBreakdown: Record<string, number>
  sessionCount: number
  lastActivity: number
}

export interface ActivitySettings {
  enabled: boolean
  syncEnabled: boolean
  incognitoMode: 'mark' | 'ignore' | 'block'
  heartbeatInterval: number // seconds
  syncInterval: number // seconds - interval for automatic batch sync
  minimumDuration: number // seconds - minimum duration to record an activity
  domainBlacklist: string[]
  autoCleanupDays: number
  sleepThreshold: number // seconds - threshold to detect sleep gap
}

export interface QueuedActivity {
  id: string
  type: 'create' | 'update' | 'finalize'
  data: Partial<ActivityRecord>
  timestamp: number
  retries: number
}

export interface SessionInfo {
  id: string
  startTime: Date
  lastActivity: Date
  profileId: string
}

export interface ActivityCheckpoint {
  lastSyncTime: number
  totalSynced: number
  lastProcessedId?: string
}
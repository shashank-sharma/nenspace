/**
 * Background Types
 * Type definitions for background script functionality
 */

import type { StoredAuth } from '../lib/types/auth.types'
import type { 
  ActivityRecord, 
  ActivityMetadata, 
  HeartbeatData, 
  ActivitySettings, 
  QueuedActivity, 
  SessionInfo 
} from '../lib/types/activity.types'

export type { 
  ActivityRecord, 
  ActivityMetadata, 
  HeartbeatData, 
  ActivitySettings, 
  QueuedActivity, 
  SessionInfo,
  StoredAuth
}

export interface BackgroundMessage {
  type: string
  payload?: any
  tabId?: number
  windowId?: number
}

export interface RealtimeConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  connected: boolean
  error?: string | null
}

export interface RealtimeStatusPayload {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  connected: boolean
  error?: string | null
}

export interface NotificationPayload {
  message: string
  variant?: "info" | "success" | "warning" | "error"
  duration?: number
}

export interface BrowserProfile {
  id: string
  profile_name: string
  user: string
  created?: string
  updated?: string
}

export interface TabInfo {
  id: number
  title: string
  url: string
  active?: boolean
}

export interface HealthStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  connected: boolean
  error: string | null
  lastChecked: string | null
}

export interface HealthStatusPayload {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  connected: boolean
  error: string | null
  lastChecked: string | null
}

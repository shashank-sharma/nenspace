/**
 * Message Types for Plasmo Messaging
 * 
 * Type definitions for all communication between content scripts,
 * background scripts, and popup/options pages.
 */

// Base message types
export interface BaseMessage<T = any> {
  type: string
  payload?: T
}

export interface BaseResponse {
  success: boolean
  error?: string
}

// Tab-related messages
export interface GetTabsRequest extends BaseMessage {
  type: 'GET_TABS'
}

export interface GetTabsResponse extends BaseResponse {
  tabs: chrome.tabs.Tab[]
}

export interface SwitchTabRequest extends BaseMessage {
  type: 'SWITCH_TAB'
  tabId: number
  windowId: number
}

export interface SwitchTabResponse extends BaseResponse {}

export interface PreviousTabRequest extends BaseMessage {
  type: 'PREVIOUS_TAB'
}

export interface PreviousTabResponse extends BaseResponse {}

export interface NextTabRequest extends BaseMessage {
  type: 'NEXT_TAB'
}

export interface NextTabResponse extends BaseResponse {}

export interface NewTabRequest extends BaseMessage {
  type: 'NEW_TAB'
}

export interface NewTabResponse extends BaseResponse {}

export interface CloseTabRequest extends BaseMessage {
  type: 'CLOSE_TAB'
}

export interface CloseTabResponse extends BaseResponse {}

export interface RestoreTabRequest extends BaseMessage {
  type: 'RESTORE_TAB'
}

export interface RestoreTabResponse extends BaseResponse {}

// Health monitoring messages
export interface GetHealthStatusRequest extends BaseMessage {
  type: 'GET_HEALTH_STATUS'
}

export interface HealthStatus {
  connected: boolean
  error: string | null
  lastChecked: Date | null
}

export interface GetHealthStatusResponse extends BaseResponse {
  health: HealthStatus
}

export interface CheckHealthRequest extends BaseMessage {
  type: 'CHECK_HEALTH'
}

export interface CheckHealthResponse extends BaseResponse {
  health: HealthStatus
}

// Realtime messages
export interface GetRealtimeStatusRequest extends BaseMessage {
  type: 'REALTIME_GET_STATUS'
}

export interface RealtimeStatus {
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  error?: string
  browserId?: string
}

export interface GetRealtimeStatusResponse extends BaseResponse {
  status: RealtimeStatus
}

// Activity tracking messages
export interface ActivityStartTrackingRequest extends BaseMessage {
  type: 'ACTIVITY_START_TRACKING'
}

export interface ActivityStartTrackingResponse extends BaseResponse {}

export interface ActivityStopTrackingRequest extends BaseMessage {
  type: 'ACTIVITY_STOP_TRACKING'
}

export interface ActivityStopTrackingResponse extends BaseResponse {}

export interface ActivityGetStatusRequest extends BaseMessage {
  type: 'ACTIVITY_GET_STATUS'
}

export interface ActivityStatus {
  settings: {
    enabled: boolean
    syncEnabled: boolean
    incognitoMode: 'mark' | 'track' | 'skip'
    heartbeatInterval: number
    syncInterval: number
    minimumDuration: number
    domainBlacklist: string[]
    autoCleanupDays: number
  }
  currentActivity: unknown | null
  sessionInfo: unknown | null
  syncStatus: {
    enabled: boolean
    running: boolean
    interval: number
    lastSync: Date | null
    itemsQueued: number
    totalSynced: number
    isTracking?: boolean
  }
}

export interface ActivityGetStatusResponse extends BaseResponse {
  status: ActivityStatus
}

export interface ActivityUpdateSettingsRequest extends BaseMessage {
  type: 'ACTIVITY_UPDATE_SETTINGS'
  payload: {
    settings: Partial<ActivityStatus['settings']>
  }
}

export interface ActivityUpdateSettingsResponse extends BaseResponse {}

// History sync messages
export interface HistorySyncFullRequest extends BaseMessage {
  type: 'HISTORY_SYNC_FULL'
}

export interface HistorySyncFullResponse extends BaseResponse {}

export interface HistorySyncIncrementalRequest extends BaseMessage {
  type: 'HISTORY_SYNC_INCREMENTAL'
}

export interface HistorySyncIncrementalResponse extends BaseResponse {}

export interface HistoryGetStatusRequest extends BaseMessage {
  type: 'HISTORY_GET_STATUS'
}

export interface HistoryStatus {
  checkpoint: {
    lastSyncTime: number
    totalSynced: number
    lastProcessedId?: string
  }
  state: {
    syncInProgress: boolean
  }
  syncStatus: {
    enabled: boolean
    running: boolean
    interval: number
    lastSync: Date | null
    itemsQueued: number
    totalSynced: number
  }
}

export interface HistoryGetStatusResponse extends BaseResponse {
  status: HistoryStatus
}

// Dev token messages
export interface DevTokenUpdatedRequest extends BaseMessage {
  type: 'DEV_TOKEN_UPDATED'
}

export interface DevTokenUpdatedResponse extends BaseResponse {}

// Browser ID messages
export interface GetBrowserIdRequest extends BaseMessage {
  type: 'GET_BROWSER_ID'
}

export interface GetBrowserIdResponse extends BaseResponse {
  browserId: string
}

// Ping messages
export interface PingRequest extends BaseMessage {
  type: 'PING'
}

export interface PingResponse extends BaseResponse {
  message: string
  timestamp: number
  initialized: boolean
}

// Notification messages (from background to content scripts)
export interface RealtimeNotificationMessage extends BaseMessage {
  type: 'REALTIME_NOTIFICATION'
  payload: {
    message: string
    variant: 'info' | 'success' | 'warning' | 'error'
    duration?: number
  }
}

// Status display messages (from background to content scripts)
export interface StatusDisplayMessage extends BaseMessage {
  type: 'STATUS_DISPLAY'
  payload: {
    content: {
      type: 'text' | 'image' | 'chart' | 'component' | 'timer'
      id: string
      mode?: 'compact' | 'notification' | 'timer' | 'custom'
      // Text content
      text?: string
      icon?: string // Icon name/identifier
      backgroundColor?: string
      textColor?: string
      // Image content
      src?: string
      alt?: string
      // Chart content
      chartType?: 'line' | 'bar' | 'pie'
      chartData?: unknown
      // Component content
      component?: string // Component name/identifier
      componentProps?: Record<string, unknown>
      // Timer content
      timerId?: string
    }
    dimensions?: {
      width?: number // 0 = fit-content
      height?: number
      borderRadius?: string
    }
    options?: {
      duration?: number // Auto-dismiss after duration (0 = persistent)
      priority?: number
      backgroundColor?: string
    }
  }
}

// Union types for all messages
export type BackgroundMessage = 
  | GetTabsRequest
  | SwitchTabRequest
  | PreviousTabRequest
  | NextTabRequest
  | NewTabRequest
  | CloseTabRequest
  | RestoreTabRequest
  | GetHealthStatusRequest
  | CheckHealthRequest
  | GetRealtimeStatusRequest
  | ActivityStartTrackingRequest
  | ActivityStopTrackingRequest
  | ActivityGetStatusRequest
  | ActivityUpdateSettingsRequest
  | HistorySyncFullRequest
  | HistorySyncIncrementalRequest
  | HistoryGetStatusRequest
  | DevTokenUpdatedRequest
  | GetBrowserIdRequest
  | PingRequest

export type BackgroundResponse = 
  | GetTabsResponse
  | SwitchTabResponse
  | PreviousTabResponse
  | NextTabResponse
  | NewTabResponse
  | CloseTabResponse
  | RestoreTabResponse
  | GetHealthStatusResponse
  | CheckHealthResponse
  | GetRealtimeStatusResponse
  | ActivityStartTrackingResponse
  | ActivityStopTrackingResponse
  | ActivityGetStatusResponse
  | ActivityUpdateSettingsResponse
  | HistorySyncFullResponse
  | HistorySyncIncrementalResponse
  | HistoryGetStatusResponse
  | DevTokenUpdatedResponse
  | GetBrowserIdResponse
  | PingResponse

export type ContentScriptMessage = RealtimeNotificationMessage | StatusDisplayMessage

// Helper types for message handling
export type MessageHandler<TRequest extends BaseMessage, TResponse extends BaseResponse> = (
  request: TRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: TResponse) => void
) => boolean | void

// Message type mapping for type safety
export interface MessageTypeMap {
  'GET_TABS': { request: GetTabsRequest; response: GetTabsResponse }
  'SWITCH_TAB': { request: SwitchTabRequest; response: SwitchTabResponse }
  'PREVIOUS_TAB': { request: PreviousTabRequest; response: PreviousTabResponse }
  'NEXT_TAB': { request: NextTabRequest; response: NextTabResponse }
  'NEW_TAB': { request: NewTabRequest; response: NewTabResponse }
  'CLOSE_TAB': { request: CloseTabRequest; response: CloseTabResponse }
  'RESTORE_TAB': { request: RestoreTabRequest; response: RestoreTabResponse }
  'GET_HEALTH_STATUS': { request: GetHealthStatusRequest; response: GetHealthStatusResponse }
  'CHECK_HEALTH': { request: CheckHealthRequest; response: CheckHealthResponse }
  'REALTIME_GET_STATUS': { request: GetRealtimeStatusRequest; response: GetRealtimeStatusResponse }
  'ACTIVITY_START_TRACKING': { request: ActivityStartTrackingRequest; response: ActivityStartTrackingResponse }
  'ACTIVITY_STOP_TRACKING': { request: ActivityStopTrackingRequest; response: ActivityStopTrackingResponse }
  'ACTIVITY_GET_STATUS': { request: ActivityGetStatusRequest; response: ActivityGetStatusResponse }
  'ACTIVITY_UPDATE_SETTINGS': { request: ActivityUpdateSettingsRequest; response: ActivityUpdateSettingsResponse }
  'HISTORY_SYNC_FULL': { request: HistorySyncFullRequest; response: HistorySyncFullResponse }
  'HISTORY_SYNC_INCREMENTAL': { request: HistorySyncIncrementalRequest; response: HistorySyncIncrementalResponse }
  'HISTORY_GET_STATUS': { request: HistoryGetStatusRequest; response: HistoryGetStatusResponse }
  'DEV_TOKEN_UPDATED': { request: DevTokenUpdatedRequest; response: DevTokenUpdatedResponse }
  'GET_BROWSER_ID': { request: GetBrowserIdRequest; response: GetBrowserIdResponse }
  'PING': { request: PingRequest; response: PingResponse }
}


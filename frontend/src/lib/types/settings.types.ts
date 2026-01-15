/**
 * Settings Type Definitions
 * 
 * Comprehensive type definitions for all user settings categories.
 * These interfaces ensure type safety across the settings system.
 */

// Base settings interface
export interface BaseSettings {
    version: number;
    lastUpdated?: number;
}

// Appearance Settings
export interface AppearanceSettings extends BaseSettings {
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'normal' | 'large' | 'xl';
    fontFamily: string; // Font identifier from fonts.config.ts (e.g., 'gilroy', 'heimat-mono', 'inter')
    spacing: 'compact' | 'comfortable' | 'relaxed';
    animationsEnabled: boolean;
    borderRadius: 'none' | 'small' | 'default' | 'large';
    accentColor: 'blue' | 'green' | 'purple' | 'orange' | 'pink';
    sidebarCollapsed: boolean;
    showStatusIndicator: boolean; // Control status indicator visibility
    backgroundType: 'none' | 'grid' | 'dot'; // Background pattern type
    statusIndicatorExpansionMode: 'edge' | 'center'; // How status indicator expands: 'edge' = from right, 'center' = equally from both sides
}

// Notification Settings  
export interface NotificationSettings extends BaseSettings {
    emailEnabled: boolean;
    typesEnabled: string[];
    quietHoursStart: string;
    quietHoursEnd: string;
    soundEnabled: boolean;
    desktopNotifications: boolean;
    emailDigestFrequency: 'never' | 'daily' | 'weekly';
    priorityLevel: 'all' | 'important' | 'urgent' | 'custom';
}

// Privacy Settings
export interface PrivacySettings extends BaseSettings {
    twoFactorEnabled: boolean;
    activityLogging: boolean;
    dataSharing: 'none' | 'minimal' | 'standard' | 'full';
    loginNotifications: boolean;
    publicProfile: boolean;
    securityLevel: 'low' | 'medium' | 'high' | 'custom';
}

// Account Settings
export interface AccountSettings extends BaseSettings {
    profileVisibility: 'private' | 'friends' | 'public';
    allowDiscovery: boolean;
    language: string;
    timezone: string;
}

// Integration Settings
export interface IntegrationSettings extends BaseSettings {
    enabledServices: string[];
    syncPreferences: Record<string, boolean>;
    apiAccess: boolean;
}

// Storage Settings
export interface StorageSettings extends BaseSettings {
    autoCleanup: boolean;
    retentionDays: number;
    compressionEnabled: boolean;
    localCacheSize: number;
}

// Language & Region Settings
export interface LanguageSettings extends BaseSettings {
    locale: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    currency: string;
    numberFormat: string;
}

// Performance Settings
export interface PerformanceSettings extends BaseSettings {
    enableOptimizations: boolean;
    lazyLoading: boolean;
    backgroundSync: boolean;
    cacheStrategy: 'aggressive' | 'balanced' | 'minimal';
}

// API Settings
export interface ApiSettings extends BaseSettings {
    rateLimitPreference: 'strict' | 'balanced' | 'relaxed';
    enableWebhooks: boolean;
    webhookUrl?: string;
    apiKeyRotationDays: number;
}

// Automation Settings
export interface AutomationSettings extends BaseSettings {
    enableRules: boolean;
    activeRules: string[];
    scheduleOptimization: boolean;
    smartSuggestions: boolean;
}

// Debug Settings
export interface DebugSettings extends BaseSettings {
    showDebugButton: boolean;
    enableConsoleLogging: boolean;
    enablePerformanceMonitoring: boolean;
    enableNetworkLogging: boolean;
    enableStateLogging: boolean;
    showGridOverlay: boolean;
    showComponentBoundaries: boolean;
    enableAccessibilityChecks: boolean;
}

// Journal Settings
export interface JournalSettings extends BaseSettings {
    aiReflectionsEnabled: boolean;
    defaultEntryColor: 'orange' | 'blue' | 'grey' | 'green' | 'purple' | 'pink' | 'teal' | 'yellow';
    syncEnabled: boolean;
    autoSyncInterval: number; // minutes
}

// Union type for all settings
export type SettingsCategory = 
    | 'appearance' 
    | 'notifications' 
    | 'privacy' 
    | 'account' 
    | 'integrations' 
    | 'storage' 
    | 'language' 
    | 'performance' 
    | 'api' 
    | 'automation'
    | 'debug'
    | 'journal';

export type AnySettings = 
    | AppearanceSettings
    | NotificationSettings 
    | PrivacySettings
    | AccountSettings
    | IntegrationSettings
    | StorageSettings
    | LanguageSettings
    | PerformanceSettings
    | ApiSettings
    | AutomationSettings
    | DebugSettings
    | JournalSettings;

// Settings record from database
export interface SettingsRecord {
    id: string;
    created: string;
    updated: string;
    user: string;
    category: SettingsCategory;
    data: AnySettings;
    version: number;
}

// Service state interface
export interface SettingsState {
    appearance: AppearanceSettings;
    notifications: NotificationSettings;
    privacy: PrivacySettings;
    account: AccountSettings;
    integrations: IntegrationSettings;
    storage: StorageSettings;
    language: LanguageSettings;
    performance: PerformanceSettings;
    api: ApiSettings;
    automation: AutomationSettings;
    debug: DebugSettings;
    journal: JournalSettings;
}

// Loading and error states
export interface CategoryState {
    loading: boolean;
    error: string | null;
    lastSynced: number | null;
}

export type SettingsLoadingState = Record<SettingsCategory, CategoryState>;

// Default settings
export const defaultAppearanceSettings: AppearanceSettings = {
    version: 4, // Incremented for statusIndicatorExpansionMode addition
    theme: 'system',
    fontSize: 'normal',
    fontFamily: 'gilroy', // Default font
    spacing: 'comfortable',
    animationsEnabled: true,
    borderRadius: 'default',
    accentColor: 'blue',
    sidebarCollapsed: false,
    showStatusIndicator: true, // Show status indicator by default
    backgroundType: 'grid', // Grid pattern by default
    statusIndicatorExpansionMode: 'center', // Expand equally from both sides by default
};

export const defaultNotificationSettings: NotificationSettings = {
    version: 1,
    emailEnabled: false,
    typesEnabled: ['system', 'task'],
    quietHoursStart: '',
    quietHoursEnd: '',
    soundEnabled: true,
    desktopNotifications: true,
    emailDigestFrequency: 'daily',
    priorityLevel: 'all',
};

export const defaultPrivacySettings: PrivacySettings = {
    version: 1,
    twoFactorEnabled: false,
    activityLogging: true,
    dataSharing: 'minimal',
    loginNotifications: true,
    publicProfile: false,
    securityLevel: 'high',
};

export const defaultAccountSettings: AccountSettings = {
    version: 1,
    profileVisibility: 'private',
    allowDiscovery: false,
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export const defaultIntegrationSettings: IntegrationSettings = {
    version: 1,
    enabledServices: [],
    syncPreferences: {},
    apiAccess: false,
};

export const defaultStorageSettings: StorageSettings = {
    version: 1,
    autoCleanup: true,
    retentionDays: 365,
    compressionEnabled: true,
    localCacheSize: 100, // MB
};

export const defaultLanguageSettings: LanguageSettings = {
    version: 1,
    locale: 'en-US',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: '12h',
    currency: 'USD',
    numberFormat: 'en-US',
};

export const defaultPerformanceSettings: PerformanceSettings = {
    version: 1,
    enableOptimizations: true,
    lazyLoading: true,
    backgroundSync: true,
    cacheStrategy: 'balanced',
};

export const defaultApiSettings: ApiSettings = {
    version: 1,
    rateLimitPreference: 'balanced',
    enableWebhooks: false,
    apiKeyRotationDays: 90,
};

export const defaultAutomationSettings: AutomationSettings = {
    version: 1,
    enableRules: false,
    activeRules: [],
    scheduleOptimization: true,
    smartSuggestions: true,
};

export const defaultDebugSettings: DebugSettings = {
    version: 1,
    showDebugButton: true,
    enableConsoleLogging: false,
    enablePerformanceMonitoring: false,
    enableNetworkLogging: false,
    enableStateLogging: false,
    showGridOverlay: false,
    showComponentBoundaries: false,
    enableAccessibilityChecks: false,
};

export const defaultJournalSettings: JournalSettings = {
    version: 1,
    aiReflectionsEnabled: true,
    defaultEntryColor: 'grey',
    syncEnabled: true,
    autoSyncInterval: 5, // minutes
};

// Complete default settings state
export const defaultSettingsState: SettingsState = {
    appearance: defaultAppearanceSettings,
    notifications: defaultNotificationSettings,
    privacy: defaultPrivacySettings,
    account: defaultAccountSettings,
    integrations: defaultIntegrationSettings,
    storage: defaultStorageSettings,
    language: defaultLanguageSettings,
    performance: defaultPerformanceSettings,
    api: defaultApiSettings,
    automation: defaultAutomationSettings,
    debug: defaultDebugSettings,
    journal: defaultJournalSettings,
};

// Array of all categories for iteration
export const categories: SettingsCategory[] = [
    'appearance',
    'notifications',
    'privacy',
    'account',
    'integrations',
    'storage',
    'language',
    'performance',
    'api',
    'automation',
    'debug',
    'journal',
];

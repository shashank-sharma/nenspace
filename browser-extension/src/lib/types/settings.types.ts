/**
 * Settings Types
 * 
 * Type definitions for extension settings (adapted from frontend settings system).
 */

export interface BaseSettings {
    version: number;
    lastUpdated?: number;
}

export interface DebugSettings extends BaseSettings {
    enabled: boolean;
    showDebugInfo: boolean;
    enableConsoleLogging: boolean;
    enablePerformanceMonitoring: boolean;
    enableNetworkLogging: boolean;
}

export interface ThemeSettings extends BaseSettings {
    theme: 'light' | 'dark' | 'nature' | 'system';
    accentColor?: string;
}

export interface ShortcutSettings extends BaseSettings {
    commandPalette: string;
    addBookmark: string;
    openSettings: string;
}

export interface UISettings extends BaseSettings {
    floatingNavEnabled: boolean;
    statusIndicatorEnabled: boolean;
    notificationsEnabled: boolean;
}

export interface ExtensionSettings {
    debug: DebugSettings;
    theme: ThemeSettings;
    shortcuts: ShortcutSettings;
    ui: UISettings;
    activity: import('./activity.types').ActivitySettings;
}

export const defaultDebugSettings: DebugSettings = {
    version: 1,
    enabled: false,
    showDebugInfo: false,
    enableConsoleLogging: false,
    enablePerformanceMonitoring: false,
    enableNetworkLogging: false,
};

export const defaultThemeSettings: ThemeSettings = {
    version: 1,
    theme: 'system',
};

export const defaultShortcutSettings: ShortcutSettings = {
    version: 1,
    commandPalette: 'cmd+shift+k',
    addBookmark: 'cmd+d',
    openSettings: 'cmd+,',
};

export const defaultUISettings: UISettings = {
    version: 1,
    floatingNavEnabled: true,
    statusIndicatorEnabled: true,
    notificationsEnabled: true,
};


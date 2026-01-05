/**
 * Settings Service
 * 
 * Centralized settings management with validation, persistence, and change listeners.
 */

import type { ExtensionSettings, DebugSettings, ThemeSettings, UISettings } from '../../types/settings.types';
import { defaultDebugSettings, defaultThemeSettings, defaultShortcutSettings, defaultUISettings } from '../../types/settings.types';
import { createLogger as createLoggerUtil, Logger } from '../../utils/logger.util';
import { settingsStorage, storage } from '../plasmo-storage.service';

const logger = createLoggerUtil('[Settings]');

type SettingsChangeListener = (settings: Partial<ExtensionSettings>) => void;

/**
 * Settings Service Class
 */
class SettingsServiceImpl {
    private listeners: Set<SettingsChangeListener> = new Set();
    private settings: ExtensionSettings | null = null;

    /**
     * Initialize settings service
     */
    async initialize(): Promise<void> {
        await this.load();
        logger.debug('Settings service initialized');
    }

    /**
     * Load all settings from storage
     */
    async load(): Promise<ExtensionSettings> {
        try {
            // Load individual setting categories
            const [themeResult, activitySettingsResult] = await Promise.all([
                settingsStorage.getTheme(),
                settingsStorage.getActivitySettings(),
            ]);

            const theme = themeResult.success ? themeResult.data : 'dark';
            const activitySettings = activitySettingsResult.success ? activitySettingsResult.data : null;

            // Get debug setting from Plasmo storage
            const debugEnabled = Boolean(await storage.get('debug_enabled')) ?? false;

            this.settings = {
                debug: { ...defaultDebugSettings, enabled: debugEnabled },
                theme: { ...defaultThemeSettings, theme: theme as any },
                shortcuts: defaultShortcutSettings,
                ui: defaultUISettings,
                activity: activitySettings || {
                    version: 1,
                    enabled: true,
                    syncEnabled: false,
                    incognitoMode: 'mark',
                    heartbeatInterval: 30,
                    syncInterval: 30,
                    domainBlacklist: [],
                    autoCleanupDays: 30,
                },
            };

            return this.settings;
        } catch (error) {
            logger.error('Failed to load settings', error);
            // Return defaults on error
            this.settings = {
                debug: defaultDebugSettings,
                theme: defaultThemeSettings,
                shortcuts: defaultShortcutSettings,
                ui: defaultUISettings,
                activity: {
                    version: 1,
                    enabled: true,
                    syncEnabled: false,
                    incognitoMode: 'mark',
                    heartbeatInterval: 30,
                    syncInterval: 30,
                    domainBlacklist: [],
                    autoCleanupDays: 30,
                },
            };
            return this.settings;
        }
    }

    /**
     * Get all settings
     */
    getAll(): ExtensionSettings {
        if (!this.settings) {
            throw new Error('Settings not initialized. Call initialize() first.');
        }
        return { ...this.settings };
    }

    /**
     * Get debug settings
     */
    getDebugSettings(): DebugSettings {
        return this.settings?.debug || defaultDebugSettings;
    }

    /**
     * Update debug settings
     */
    async updateDebugSettings(settings: Partial<DebugSettings>): Promise<void> {
        if (!this.settings) {
            await this.load();
        }

        this.settings!.debug = { ...this.settings!.debug, ...settings };

        // Save to storage
        if (settings.enabled !== undefined) {
            await Logger.setDebugMode(settings.enabled);
        }

        await this.notifyListeners({ debug: this.settings!.debug });
        logger.debug('Debug settings updated', settings);
    }

    /**
     * Get theme settings
     */
    getThemeSettings(): ThemeSettings {
        return this.settings?.theme || defaultThemeSettings;
    }

    /**
     * Update theme settings
     */
    async updateThemeSettings(settings: Partial<ThemeSettings>): Promise<void> {
        if (!this.settings) {
            await this.load();
        }

        this.settings!.theme = { ...this.settings!.theme, ...settings };

        // Save to storage
        if (settings.theme) {
            const saveResult = await settingsStorage.saveTheme(settings.theme);
            if (!saveResult.success) {
                logger.error('Failed to save theme setting', saveResult.error);
            }
        }

        await this.notifyListeners({ theme: this.settings!.theme });
        logger.debug('Theme settings updated', settings);
    }

    /**
     * Get UI settings
     */
    getUISettings(): UISettings {
        return this.settings?.ui || defaultUISettings;
    }

    /**
     * Update UI settings
     */
    async updateUISettings(settings: Partial<UISettings>): Promise<void> {
        if (!this.settings) {
            await this.load();
        }

        this.settings!.ui = { ...this.settings!.ui, ...settings };
        await this.notifyListeners({ ui: this.settings!.ui });
        logger.debug('UI settings updated', settings);
    }

    /**
     * Update activity settings
     */
    async updateActivitySettings(settings: any): Promise<void> {
        if (!this.settings) {
            await this.load();
        }

        this.settings!.activity = { ...this.settings!.activity, ...settings };

        // Save to storage
        const saveResult = await settingsStorage.saveActivitySettings(this.settings!.activity);
        if (!saveResult.success) {
            logger.error('Failed to save activity settings', saveResult.error);
        }
        await this.notifyListeners({ activity: this.settings!.activity });
        logger.debug('Activity settings updated');
    }

    /**
     * Add settings change listener
     */
    addChangeListener(listener: SettingsChangeListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Notify all listeners of settings change
     */
    private async notifyListeners(changes: Partial<ExtensionSettings>): Promise<void> {
        for (const listener of this.listeners) {
            try {
                listener(changes);
            } catch (error) {
                logger.error('Settings listener error', error);
            }
        }
    }

    /**
     * Reset all settings to defaults
     */
    async resetToDefaults(): Promise<void> {
        this.settings = {
            debug: defaultDebugSettings,
            theme: defaultThemeSettings,
            shortcuts: defaultShortcutSettings,
            ui: defaultUISettings,
            activity: {
                version: 1,
                enabled: true,
                syncEnabled: false,
                incognitoMode: 'mark',
                heartbeatInterval: 30,
                syncInterval: 30,
                domainBlacklist: [],
                autoCleanupDays: 30,
            },
        };

        // Save to storage
        await Promise.all([
            settingsStorage.saveTheme(this.settings.theme.theme),
            settingsStorage.saveActivitySettings(this.settings.activity),
            Logger.setDebugMode(false)
        ]);

        await this.notifyListeners(this.settings);
        logger.info('Settings reset to defaults');
    }
}

// Export singleton instance
export const SettingsService = new SettingsServiceImpl();


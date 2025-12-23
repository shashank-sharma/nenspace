/**
 * Settings Service
 * 
 * Comprehensive settings management with PocketBase persistence,
 * reactive state management, and automatic synchronization.
 */

import { browser } from '$app/environment';
import { pb } from '$lib/config/pocketbase';
import { authService } from '$lib/services/authService.svelte';
import { ThemeService } from '$lib/services/theme.service.svelte';
import { FontService } from '$lib/services/font.service.svelte';
import { toast } from 'svelte-sonner';
import type {
    SettingsCategory,
    SettingsState,
    SettingsLoadingState,
    SettingsRecord,
    AnySettings,
    AppearanceSettings,
    NotificationSettings,
    PrivacySettings,
    AccountSettings,
    IntegrationSettings,
    StorageSettings,
    LanguageSettings,
    PerformanceSettings,
    ApiSettings,
    AutomationSettings,
    DebugSettings,
    JournalSettings,
    defaultSettingsState,
} from '$lib/types/settings.types';

// Import defaults
import {
    defaultAppearanceSettings,
    defaultNotificationSettings,
    defaultPrivacySettings,
    defaultAccountSettings,
    defaultIntegrationSettings,
    defaultStorageSettings,
    defaultLanguageSettings,
    defaultPerformanceSettings,
    defaultApiSettings,
    defaultAutomationSettings,
    defaultDebugSettings,
    defaultJournalSettings,
    categories,
} from '$lib/types/settings.types';

class SettingsServiceImpl {
    // Reactive state for each settings category
    #appearance = $state<AppearanceSettings>(defaultAppearanceSettings);
    #notifications = $state<NotificationSettings>(defaultNotificationSettings);
    #privacy = $state<PrivacySettings>(defaultPrivacySettings);
    #account = $state<AccountSettings>(defaultAccountSettings);
    #integrations = $state<IntegrationSettings>(defaultIntegrationSettings);
    #storage = $state<StorageSettings>(defaultStorageSettings);
    #language = $state<LanguageSettings>(defaultLanguageSettings);
    #performance = $state<PerformanceSettings>(defaultPerformanceSettings);
    #api = $state<ApiSettings>(defaultApiSettings);
    #automation = $state<AutomationSettings>(defaultAutomationSettings);
    #debug = $state<DebugSettings>(defaultDebugSettings);
    #journal = $state<JournalSettings>(defaultJournalSettings);

    // Loading and error states
    #loadingStates = $state<SettingsLoadingState>({
        appearance: { loading: false, error: null, lastSynced: null },
        notifications: { loading: false, error: null, lastSynced: null },
        privacy: { loading: false, error: null, lastSynced: null },
        account: { loading: false, error: null, lastSynced: null },
        integrations: { loading: false, error: null, lastSynced: null },
        storage: { loading: false, error: null, lastSynced: null },
        language: { loading: false, error: null, lastSynced: null },
        performance: { loading: false, error: null, lastSynced: null },
        api: { loading: false, error: null, lastSynced: null },
        automation: { loading: false, error: null, lastSynced: null },
        debug: { loading: false, error: null, lastSynced: null },
        journal: { loading: false, error: null, lastSynced: null },
    });

    #initialized = false;
    #isLoading = $state(false);
    #loadingPromise: Promise<void> | null = null;
    #syncTimeouts = new Map<SettingsCategory, NodeJS.Timeout>();
    #retryAttempts = new Map<SettingsCategory, number>();

    constructor() {
        if (browser) {
            // Listen to PocketBase auth state changes (like authService does)
            pb.authStore.onChange((token, model) => {
                if (model && !this.#initialized) {
                    // User authenticated - initialize settings
                    this.initialize();
                } else if (!model && this.#initialized) {
                    // User logged out - reset settings
                    this.reset();
                }
            });
            
            // Initialize immediately if already authenticated
            if (pb.authStore.isValid) {
                this.initialize();
            }
        }
    }

    // Getters for reactive state
    get appearance(): AppearanceSettings { return this.#appearance; }
    get notifications(): NotificationSettings { return this.#notifications; }
    get privacy(): PrivacySettings { return this.#privacy; }
    get account(): AccountSettings { return this.#account; }
    get integrations(): IntegrationSettings { return this.#integrations; }
    get storage(): StorageSettings { return this.#storage; }
    get language(): LanguageSettings { return this.#language; }
    get performance(): PerformanceSettings { return this.#performance; }
    get api(): ApiSettings { return this.#api; }
    get automation(): AutomationSettings { return this.#automation; }
    get debug(): DebugSettings { return this.#debug; }
    get journal(): JournalSettings { return this.#journal; }
    
    get loadingStates(): SettingsLoadingState { return this.#loadingStates; }
    
    // Global loading state for initial settings load
    get isInitialLoading(): boolean { return this.#isLoading; }
    get isInitialized(): boolean { return this.#initialized; }

    /**
     * Initialize the service - load settings from PocketBase or localStorage
     */
    private async initialize(): Promise<void> {
        if (this.#initialized || this.#loadingPromise) return this.#loadingPromise || Promise.resolve();
        
        this.#isLoading = true;
        
        // Create and store the loading promise to prevent multiple initializations
        this.#loadingPromise = (async () => {
            console.log('[Settings] Initializing settings service...');
            
            try {
                // Load from localStorage first for instant UI
                this.loadFromLocalStorage();
                
                // Then sync from PocketBase
                await this.loadAllFromDatabase();
                
                this.#initialized = true;
                console.log('[Settings] Settings service initialized successfully');
            } catch (error) {
                console.error('[Settings] Failed to initialize:', error);
                toast.error('Failed to load settings');
                throw error;
            } finally {
                this.#isLoading = false;
                this.#loadingPromise = null;
            }
        })();
        
        return this.#loadingPromise;
    }

    /**
     * Ensure settings are loaded (for dashboard lifecycle)
     */
    async ensureLoaded(): Promise<void> {
        if (!pb.authStore.isValid) {
            console.warn('[Settings] Cannot load settings - user not authenticated');
            return;
        }
        
        if (this.#initialized) return;
        
        return await this.initialize();
    }

    /**
     * Reset service state on logout
     */
    private reset(): void {
        this.#initialized = false;
        this.#isLoading = false;
        this.#loadingPromise = null;
        
        // Clear all timeouts
        this.#syncTimeouts.forEach(timeout => clearTimeout(timeout));
        this.#syncTimeouts.clear();
        this.#retryAttempts.clear();
        
        // Reset to defaults
        this.#appearance = { ...defaultAppearanceSettings };
        this.#notifications = { ...defaultNotificationSettings };
        this.#privacy = { ...defaultPrivacySettings };
        this.#account = { ...defaultAccountSettings };
        this.#integrations = { ...defaultIntegrationSettings };
        this.#storage = { ...defaultStorageSettings };
        this.#language = { ...defaultLanguageSettings };
        this.#performance = { ...defaultPerformanceSettings };
        this.#api = { ...defaultApiSettings };
        this.#automation = { ...defaultAutomationSettings };
        this.#debug = { ...defaultDebugSettings };
        this.#journal = { ...defaultJournalSettings };
        
        // Reset loading states
        Object.keys(this.#loadingStates).forEach(category => {
            this.#loadingStates[category as SettingsCategory] = {
                loading: false,
                error: null,
                lastSynced: null,
            };
        });
        
        // Clear localStorage
        if (browser) {
            categories.forEach(category => {
                localStorage.removeItem(`settings_${category}`);
            });
        }
        
        console.log('[Settings] Service reset to defaults');
    }

    /**
     * Load all settings from database in a single query
     */
    private async loadAllFromDatabase(): Promise<void> {
        if (!authService.isAuthenticated) return;

        const userId = authService.user?.id;
        if (!userId) {
            console.error('[Settings] User ID not available');
            return;
        }

        try {
            // Build filter for only the categories we need
            const categoryFilters = categories.map(cat => `category = "${cat}"`).join(' || ');
            const filter = `user = "${userId}" && (${categoryFilters})`;
            
            // Fetch all user settings in one query (single API request)
            const records = await pb.collection('user_settings').getFullList({
                filter,
                requestKey: 'settings_load_all',
            });

            console.log(`[Settings] Loaded ${records.length}/${categories.length} setting categories from database`);

            // Process each record
            records.forEach(record => {
                const settingsRecord = record as unknown as SettingsRecord;
                const category = settingsRecord.category;
                
                // Skip if category is not recognized (shouldn't happen with our filter)
                if (!this.#loadingStates[category]) {
                    console.warn(`[Settings] Unknown category from database: ${category}`);
                    return;
                }
                
                try {
                    // Migrate settings if needed (e.g., version 1 -> 2)
                    const migratedData = this.migrateSettings(category, settingsRecord.data);
                    this.updateLocalState(category, migratedData);
                    this.saveToLocalStorage(category, migratedData);
                    this.#loadingStates[category].lastSynced = Date.now();
                    this.#loadingStates[category].error = null;
                } catch (error) {
                    console.warn(`[Settings] Failed to process ${category}:`, error);
                    this.#loadingStates[category].error = error instanceof Error ? error.message : String(error);
                }
            });

        } catch (error) {
            console.error('[Settings] Failed to load settings from database:', error);
            
            // Mark all categories as errored
            categories.forEach(category => {
                this.#loadingStates[category].error = error instanceof Error ? error.message : String(error);
            });
        }
        
        // Ensure account timezone is set after loading (in case it wasn't in database)
        if (!this.#account.timezone || this.#account.timezone.trim() === '') {
            this.#account.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            console.log('[Settings] Auto-detected timezone after database load:', this.#account.timezone);
            // Save the auto-detected timezone to database
            this.debouncedSync('account', this.#account);
        }
        
        // Apply global settings after loading
        this.applyGlobalSettings();
    }

    /**
     * Load specific category from database
     */
    private async loadFromDatabase(category: SettingsCategory): Promise<void> {
        if (!authService.isAuthenticated) return;

        this.#loadingStates[category].loading = true;
        this.#loadingStates[category].error = null;

        try {
            const userId = authService.user?.id;
            if (!userId) throw new Error('User not authenticated');

            const records = await pb.collection('user_settings').getList(1, 1, {
                filter: `user = "${userId}" && category = "${category}"`,
            });

            if (records.items.length > 0) {
                const record = records.items[0] as unknown as SettingsRecord;
                this.updateLocalState(category, record.data);
                this.saveToLocalStorage(category, record.data);
                this.#loadingStates[category].lastSynced = Date.now();
            }
        } catch (error) {
            console.warn(`[Settings] Failed to load ${category} from database:`, error);
            this.#loadingStates[category].error = error instanceof Error ? error.message : String(error);
        } finally {
            this.#loadingStates[category].loading = false;
        }
    }

    /**
     * Update settings for a specific category
     */
    async updateSettings<T extends AnySettings>(
        category: SettingsCategory, 
        updates: Partial<T>
    ): Promise<void> {
        // Get current settings
        const currentSettings = this.getSettingsForCategory(category);
        
        // Apply updates with version increment
        const newSettings = {
            ...currentSettings,
            ...updates,
            version: currentSettings.version + 1,
            lastUpdated: Date.now(),
        } as T;

        // Special handling for account settings - ensure timezone is valid
        if (category === 'account') {
            const accountSettings = newSettings as AccountSettings;
            if (!accountSettings.timezone || accountSettings.timezone.trim() === '') {
                accountSettings.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                console.log('[Settings] Auto-detected timezone for account update:', accountSettings.timezone);
            }
        }

        // Update local state immediately (optimistic update)
        this.updateLocalState(category, newSettings);
        
        // Save to localStorage immediately
        this.saveToLocalStorage(category, newSettings);
        
        // Apply global settings if appearance or debug changed
        if (category === 'appearance' || category === 'debug') {
            this.applyGlobalSettings();
        }
        
        // Debounced sync to database
        this.debouncedSync(category, newSettings);
    }

    /**
     * Get settings for a specific category
     */
    private getSettingsForCategory(category: SettingsCategory): AnySettings {
        switch (category) {
            case 'appearance': return this.#appearance;
            case 'notifications': return this.#notifications;
            case 'privacy': return this.#privacy;
            case 'account': return this.#account;
            case 'integrations': return this.#integrations;
            case 'storage': return this.#storage;
            case 'language': return this.#language;
            case 'performance': return this.#performance;
            case 'api': return this.#api;
            case 'automation': return this.#automation;
            case 'debug': return this.#debug;
            case 'journal': return this.#journal;
        }
    }

    /**
     * Apply global settings that affect other services
     */
    private applyGlobalSettings(): void {
        if (!browser) return;
        
        // Sync theme with ThemeService
        if (this.#appearance.theme) {
            ThemeService.setTheme(this.#appearance.theme);
        }
        
        // Apply font
        if (this.#appearance.fontFamily) {
            FontService.applyFont(this.#appearance.fontFamily).catch((error) => {
                console.error('[Settings] Failed to apply font:', error);
            });
        }
        
        console.log('[Settings] Global settings applied');
    }
    
    /**
     * Update local reactive state
     */
    private updateLocalState(category: SettingsCategory, settings: AnySettings): void {
        switch (category) {
            case 'appearance':
                this.#appearance = settings as AppearanceSettings;
                break;
            case 'notifications':
                this.#notifications = settings as NotificationSettings;
                break;
            case 'privacy':
                this.#privacy = settings as PrivacySettings;
                break;
            case 'account':
                const accountSettings = settings as AccountSettings;
                // Ensure timezone is always set - auto-detect if missing
                if (!accountSettings.timezone || accountSettings.timezone.trim() === '') {
                    accountSettings.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    console.log('[Settings] Auto-detected timezone:', accountSettings.timezone);
                }
                this.#account = accountSettings;
                break;
            case 'integrations':
                this.#integrations = settings as IntegrationSettings;
                break;
            case 'storage':
                this.#storage = settings as StorageSettings;
                break;
            case 'language':
                this.#language = settings as LanguageSettings;
                break;
            case 'performance':
                this.#performance = settings as PerformanceSettings;
                break;
            case 'api':
                this.#api = settings as ApiSettings;
                break;
            case 'automation':
                this.#automation = settings as AutomationSettings;
                break;
            case 'debug':
                this.#debug = settings as DebugSettings;
                break;
            case 'journal':
                this.#journal = settings as JournalSettings;
                break;
        }
    }

    /**
     * Debounced sync to database (500ms delay)
     */
    private debouncedSync(category: SettingsCategory, settings: AnySettings): void {
        // Clear existing timeout
        const existingTimeout = this.#syncTimeouts.get(category);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new timeout
        const timeout = setTimeout(() => {
            this.syncToDatabase(category, settings);
        }, 500);

        this.#syncTimeouts.set(category, timeout);
    }

    /**
     * Sync settings to database
     */
    private async syncToDatabase(category: SettingsCategory, settings: AnySettings): Promise<void> {
        if (!authService.isAuthenticated) return;

        const userId = authService.user?.id;
        if (!userId) return;

        this.#loadingStates[category].loading = true;
        this.#loadingStates[category].error = null;

        try {
            // Check if record exists
            const existingRecords = await pb.collection('user_settings').getList(1, 1, {
                filter: `user = "${userId}" && category = "${category}"`,
            });

            const data = {
                user: userId,
                category,
                data: settings,
                version: settings.version,
            };

            if (existingRecords.items.length > 0) {
                // Update existing record
                await pb.collection('user_settings').update(existingRecords.items[0].id, data);
                console.log(`[Settings] Updated ${category} settings in database`);
            } else {
                // Create new record
                await pb.collection('user_settings').create(data);
                console.log(`[Settings] Created ${category} settings in database`);
            }

            this.#loadingStates[category].lastSynced = Date.now();
            this.#retryAttempts.delete(category);
            
            // Log timezone specifically for account settings
            if (category === 'account') {
                const accountData = data.data as AccountSettings;
                console.log(`[Settings] Timezone persisted: ${accountData.timezone}`);
            }
            
            console.log(`[Settings] Successfully synced ${category} settings`);
        } catch (error) {
            console.error(`[Settings] Failed to sync ${category} settings:`, error);
            this.#loadingStates[category].error = error instanceof Error ? error.message : String(error);
            
            // Implement retry logic
            this.handleSyncError(category, settings, error);
        } finally {
            this.#loadingStates[category].loading = false;
        }
    }

    /**
     * Handle sync errors with retry logic
     */
    private async handleSyncError(
        category: SettingsCategory, 
        settings: AnySettings, 
        error: unknown
    ): Promise<void> {
        const currentAttempts = this.#retryAttempts.get(category) || 0;
        const maxAttempts = 3;

        if (currentAttempts < maxAttempts) {
            this.#retryAttempts.set(category, currentAttempts + 1);
            
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, currentAttempts) * 1000;
            
            console.log(`[Settings] Retrying ${category} sync in ${delay}ms (attempt ${currentAttempts + 1}/${maxAttempts})`);
            
            setTimeout(() => {
                this.syncToDatabase(category, settings);
            }, delay);
        } else {
            // Max retries exceeded
            this.#retryAttempts.delete(category);
            toast.error(`Failed to sync ${category} settings after ${maxAttempts} attempts`);
            
            // Could implement offline queue here for later retry
        }
    }

    /**
     * Save settings to localStorage for offline access
     */
    private saveToLocalStorage(category: SettingsCategory, settings: AnySettings): void {
        if (!browser) return;
        
        try {
            localStorage.setItem(`settings_${category}`, JSON.stringify(settings));
        } catch (error) {
            console.warn(`[Settings] Failed to save ${category} to localStorage:`, error);
        }
    }

    /**
     * Load settings from localStorage
     */
    private loadFromLocalStorage(): void {
        if (!browser) return;

        categories.forEach(category => {
            try {
                const stored = localStorage.getItem(`settings_${category}`);
                if (stored) {
                    const settings = JSON.parse(stored);
                    // Migrate settings if needed
                    const migratedSettings = this.migrateSettings(category, settings);
                    this.updateLocalState(category, migratedSettings);
                }
            } catch (error) {
                console.warn(`[Settings] Failed to load ${category} from localStorage:`, error);
            }
        });
        
        // Apply global settings after loading from localStorage
        this.applyGlobalSettings();
    }

    /**
     * Migrate settings to latest version
     */
    private migrateSettings(category: SettingsCategory, settings: AnySettings): AnySettings {
        if (category === 'appearance') {
            const appearanceSettings = settings as AppearanceSettings;
            
            // Migrate from version 1 to 2 (add fontFamily field)
            if (appearanceSettings.version === 1 || !appearanceSettings.fontFamily) {
                return {
                    ...appearanceSettings,
                    version: 2,
                    fontFamily: 'gilroy', // Default font for migrated settings
                };
            }
        }
        
        return settings;
    }

    /**
     * Force sync all settings to database
     */
    async forceSyncAll(): Promise<void> {
        await Promise.all(
            categories.map(category => {
                const settings = this.getSettingsForCategory(category);
                return this.syncToDatabase(category, settings);
            })
        );
    }

    /**
     * Reset specific category to defaults
     */
    async resetCategory(category: SettingsCategory): Promise<void> {
        const defaults: Record<SettingsCategory, AnySettings> = {
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

        await this.updateSettings(category, defaults[category]);
        toast.success(`${category} settings reset to defaults`);
    }

    /**
     * Export all settings
     */
    exportSettings(): SettingsState {
        return {
            appearance: this.#appearance,
            notifications: this.#notifications,
            privacy: this.#privacy,
            account: this.#account,
            integrations: this.#integrations,
            storage: this.#storage,
            language: this.#language,
            performance: this.#performance,
            api: this.#api,
            automation: this.#automation,
            debug: this.#debug,
            journal: this.#journal,
        };
    }

    /**
     * Import settings (with validation)
     */
    async importSettings(settingsData: Partial<SettingsState>): Promise<void> {
        const updates = Object.entries(settingsData) as [SettingsCategory, AnySettings][];
        
        await Promise.all(
            updates.map(([category, settings]) => 
                this.updateSettings(category, settings)
            )
        );
        
        toast.success('Settings imported successfully');
    }
}

export const SettingsService = new SettingsServiceImpl();

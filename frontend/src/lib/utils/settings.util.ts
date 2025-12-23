/**
 * Settings Utilities
 * 
 * Helper functions for working with the settings system
 * across different components and features.
 */

import { SettingsService } from '$lib/services/settings.service.svelte';

/**
 * Wait for settings to be initialized before proceeding
 * 
 * @example
 * ```typescript
 * import { waitForSettings } from '$lib/utils/settings.util';
 * 
 * onMount(async () => {
 *     await waitForSettings();
 *     // Now you can safely access SettingsService.appearance, etc.
 *     const theme = SettingsService.appearance.theme;
 * });
 * ```
 */
export async function waitForSettings(): Promise<void> {
    if (SettingsService.isInitialized) {
        return;
    }
    
    return await SettingsService.ensureLoaded();
}

/**
 * Check if settings are ready (synchronous)
 * 
 * @example
 * ```typescript
 * import { areSettingsReady } from '$lib/utils/settings.util';
 * 
 * if (areSettingsReady()) {
 *     // Safe to access settings
 *     const debugEnabled = SettingsService.appearance.showDebugButton;
 * } else {
 *     // Show loading state or defaults
 * }
 * ```
 */
export function areSettingsReady(): boolean {
    return SettingsService.isInitialized;
}

/**
 * Get settings with fallback to defaults if not yet loaded
 * 
 * @example
 * ```typescript
 * import { getSettingsOrDefaults } from '$lib/utils/settings.util';
 * 
 * // This will always return a value, even if settings aren't loaded yet
 * const appearance = getSettingsOrDefaults('appearance');
 * const theme = appearance.theme; // Safe to use
 * ```
 */
export function getSettingsOrDefaults<T extends keyof typeof SettingsService>(
    category: T
): ReturnType<typeof SettingsService[T]> {
    return SettingsService[category];
}

/**
 * Hook-style function for reactive settings access in components
 * 
 * @example
 * ```svelte
 * <script lang="ts">
 *     import { useSettings } from '$lib/utils/settings.util';
 *     
 *     let appearance = $derived(useSettings('appearance'));
 *     let isDebugVisible = $derived(appearance.showDebugButton);
 * </script>
 * 
 * {#if isDebugVisible}
 *     <DebugPanel />
 * {/if}
 * ```
 */
export function useSettings<T extends keyof typeof SettingsService>(
    category: T
): ReturnType<typeof SettingsService[T]> {
    return SettingsService[category];
}

/**
 * Type-safe helper for updating settings
 * 
 * @example
 * ```typescript
 * import { updateSettings } from '$lib/utils/settings.util';
 * 
 * // Type-safe updates
 * await updateSettings('appearance', { theme: 'dark' });
 * await updateSettings('notifications', { emailEnabled: true });
 * ```
 */
export async function updateSettings<T extends Parameters<typeof SettingsService.updateSettings>[0]>(
    category: T,
    updates: Parameters<typeof SettingsService.updateSettings<any>>[1]
): Promise<void> {
    return await SettingsService.updateSettings(category, updates);
}

/**
 * Reset a settings category to defaults
 * 
 * @example
 * ```typescript
 * import { resetSettings } from '$lib/utils/settings.util';
 * 
 * await resetSettings('appearance');
 * ```
 */
export async function resetSettings(category: Parameters<typeof SettingsService.resetCategory>[0]): Promise<void> {
    return await SettingsService.resetCategory(category);
}

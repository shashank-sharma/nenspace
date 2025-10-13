/**
 * usePlatform - Reactive Platform Hook
 * 
 * Provides reactive platform information and utilities for Svelte 5 components.
 * This is a runes-based composable that can be used in any component.
 */

import { browser } from '$app/environment';
import {
    isTauri,
    isPWA,
    getPlatform,
    isMobile,
    isDesktop,
    getPlatformName,
    getOS,
    type Platform,
} from '$lib/utils/platform';
import {
    getFeatureCapability,
    hasFullFeature,
    isFeatureAvailable,
    type FeatureCapability,
} from '$lib/utils/feature-capabilities';

/**
 * Platform state class for reactive platform information
 */
class PlatformState {
    // Platform detection
    readonly isTauri = isTauri();
    readonly isPWA = isPWA();
    readonly platform = getPlatform();
    readonly platformName = getPlatformName();
    
    // Device info
    readonly isMobile = isMobile();
    readonly isDesktop = isDesktop();
    readonly os = getOS();
    
    /**
     * Check if a feature is available on current platform
     */
    isFeatureAvailable(featureId: string): boolean {
        return isFeatureAvailable(featureId);
    }
    
    /**
     * Check if a feature has full capability on current platform
     */
    hasFullFeature(featureId: string): boolean {
        return hasFullFeature(featureId);
    }
    
    /**
     * Get capability level for a feature
     */
    getFeatureCapability(featureId: string): FeatureCapability {
        return getFeatureCapability(featureId);
    }
    
    /**
     * Check if running in production desktop app
     */
    get isProductionDesktop(): boolean {
        return this.isTauri && !import.meta.env.DEV;
    }
    
    /**
     * Check if running in development mode
     */
    get isDev(): boolean {
        return import.meta.env.DEV;
    }
    
    /**
     * Get human-readable platform summary
     */
    get summary(): string {
        const parts: string[] = [];
        
        parts.push(this.platformName);
        parts.push(this.os);
        if (this.isDev) parts.push('Development');
        
        return parts.join(' • ');
    }
}

/**
 * Singleton instance
 */
let platformInstance: PlatformState | null = null;

/**
 * Get or create platform state instance
 */
function getPlatformState(): PlatformState {
    if (!platformInstance) {
        platformInstance = new PlatformState();
    }
    return platformInstance;
}

/**
 * Use platform hook
 * 
 * Returns reactive platform information for use in Svelte 5 components.
 * 
 * @example
 * ```svelte
 * <script>
 *   import { usePlatform } from '$lib/hooks/usePlatform.svelte';
 *   
 *   const platform = usePlatform();
 * </script>
 * 
 * {#if platform.isTauri}
 *   <TauriOnlyFeature />
 * {/if}
 * 
 * {#if platform.isFeatureAvailable('drawings')}
 *   <DrawingEditor />
 * {/if}
 * ```
 */
export function usePlatform(): PlatformState {
    if (!browser) {
        // Return a dummy state for SSR
        return new PlatformState();
    }
    
    return getPlatformState();
}

/**
 * Export platform state for direct access
 */
export const platform = browser ? getPlatformState() : new PlatformState();


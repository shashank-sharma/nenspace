/**
 * Platform Components - Barrel Export
 * 
 * Provides easy imports for all platform-related components and utilities
 */

// Components
export { default as PlatformGuard } from './PlatformGuard.svelte';
export { default as FeatureBadge } from './FeatureBadge.svelte';
export { default as FeatureRestrictionBanner } from './FeatureRestrictionBanner.svelte';
export { default as LimitedFunctionalityBanner } from './LimitedFunctionalityBanner.svelte';
export { default as PlatformInfo } from './PlatformInfo.svelte';

// Re-export utilities for convenience
export {
    isTauri,
    isPWA,
    getPlatform,
    isMobile,
    isDesktop,
    getPlatformName,
    hasPlatformCapability,
    getDesktopDownloadUrl,
    getOS,
    openInDesktopApp,
    type Platform,
    type FeatureCapability,
} from '$lib/utils/platform';

export {
    getFeatureCapability,
    isFeatureAvailable,
    hasFullFeature,
    isFeatureLimited,
    getFeaturesByCapability,
    getAvailableFeatures,
    getFeatureRestrictionMessage,
    getCapabilityBadge,
    featureMatrix,
    type Feature,
} from '$lib/utils/feature-capabilities';

// Page feature detection
export {
    getPageFeatures,
    hasDisabledFeatures,
    hasLimitedFeatures,
    getLimitedPageFeatures,
    getPageLimitationMessage,
    pageFeatureMap,
} from '$lib/utils/page-features';


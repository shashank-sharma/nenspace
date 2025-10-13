/**
 * Page Feature Detection
 * 
 * Maps routes to the features they use, allowing us to detect
 * when a page has limited functionality on the current platform.
 */

import { getFeatureCapability, isFeatureAvailable, type Feature } from './feature-capabilities';
import { featureMatrix } from './feature-capabilities';

/**
 * Map of route patterns to features used on that page
 */
export const pageFeatureMap: Record<string, string[]> = {
    '/calendar': ['calendar'],
    '/tasks': ['tasks'],
    '/chronicles': ['chronicles'],
    '/food-log': ['foodLog'],
    '/drawings': ['drawings'],
    '/notebooks': ['notebooks'],
    '/settings/sync': ['fileSync'],
    '/settings/automation': ['automation'],
    '/settings': ['systemIntegration', 'advancedExport'],
};

/**
 * Get features used on a specific page
 */
export function getPageFeatures(pathname: string): string[] {
    // Check for exact match
    if (pageFeatureMap[pathname]) {
        return pageFeatureMap[pathname];
    }
    
    // Check for partial match (e.g., /food-log/123 matches /food-log)
    for (const [pattern, features] of Object.entries(pageFeatureMap)) {
        if (pathname.startsWith(pattern)) {
            return features;
        }
    }
    
    return [];
}

/**
 * Check if current page has any disabled features
 */
export function hasDisabledFeatures(pathname: string): boolean {
    const features = getPageFeatures(pathname);
    return features.some(featureId => !isFeatureAvailable(featureId));
}

/**
 * Check if current page has any limited features
 */
export function hasLimitedFeatures(pathname: string): boolean {
    const features = getPageFeatures(pathname);
    return features.some(featureId => {
        const capability = getFeatureCapability(featureId);
        return capability === 'limited' || capability === 'view-only';
    });
}

/**
 * Get all features with limited capability on current page
 */
export function getLimitedPageFeatures(pathname: string): Feature[] {
    const featureIds = getPageFeatures(pathname);
    return featureIds
        .map(id => featureMatrix[id])
        .filter(feature => {
            if (!feature) return false;
            const capability = getFeatureCapability(feature.id);
            return capability !== 'full';
        });
}

/**
 * Get a summary message for limited functionality on current page
 */
export function getPageLimitationMessage(pathname: string): string | null {
    const limitedFeatures = getLimitedPageFeatures(pathname);
    
    if (limitedFeatures.length === 0) {
        return null;
    }
    
    const hasDisabled = limitedFeatures.some(f => getFeatureCapability(f.id) === 'disabled');
    const hasLimited = limitedFeatures.some(f => {
        const cap = getFeatureCapability(f.id);
        return cap === 'limited' || cap === 'view-only';
    });
    
    if (hasDisabled) {
        return 'Some features are only available in the desktop app.';
    }
    
    if (hasLimited) {
        return 'You have limited functionality on this page. Download the desktop app for full features.';
    }
    
    return null;
}


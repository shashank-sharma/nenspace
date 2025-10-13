/**
 * Feature Capability System
 * 
 * Defines which features are available on each platform and their capability level.
 * Used to gracefully degrade features and show appropriate UI based on platform.
 */

import type { FeatureCapability } from './platform';
import { getPlatform } from './platform';

/**
 * Feature definition
 */
export interface Feature {
    id: string;
    name: string;
    description: string;
    tauri: FeatureCapability;
    pwa: FeatureCapability;
    web: FeatureCapability;
}

/**
 * Feature Matrix - Defines capability level for each feature on each platform
 * 
 * Capability Levels:
 * - full: Complete feature with all functionality
 * - limited: Core functionality only, missing advanced features
 * - view-only: Can view data but cannot create/edit
 * - disabled: Feature not available on this platform
 */
export const featureMatrix: Record<string, Feature> = {
    // === CORE FEATURES (Full Parity) ===
    calendar: {
        id: 'calendar',
        name: 'Calendar',
        description: 'View and manage calendar events',
        tauri: 'full',
        pwa: 'full',
        web: 'full',
    },
    
    tasks: {
        id: 'tasks',
        name: 'Tasks',
        description: 'Task management and to-do lists',
        tauri: 'full',
        pwa: 'full',
        web: 'full',
    },
    
    chronicles: {
        id: 'chronicles',
        name: 'Chronicles',
        description: 'Journal and note-taking',
        tauri: 'full',
        pwa: 'full',
        web: 'full',
    },
    
    // === LIMITED PWA FEATURES ===
    foodLog: {
        id: 'foodLog',
        name: 'Food Log',
        description: 'Food diary with photos',
        tauri: 'full', // Full editing, local cache, offline
        pwa: 'full',   // Can capture photos, basic editing
        web: 'limited', // Can view and add, no camera
    },
    
    drawings: {
        id: 'drawings',
        name: 'Drawings',
        description: 'Drawing and sketching tool',
        tauri: 'full',      // Full editor with layers, export
        pwa: 'view-only',   // Can view drawings only
        web: 'view-only',   // Can view drawings only
    },
    
    // === TAURI-ONLY FEATURES ===
    fileSync: {
        id: 'fileSync',
        name: 'File Sync',
        description: 'Sync files with local folders',
        tauri: 'full',
        pwa: 'disabled',
        web: 'disabled',
    },
    
    notebooks: {
        id: 'notebooks',
        name: 'Notebooks',
        description: 'Advanced note-taking with file attachments',
        tauri: 'full',
        pwa: 'view-only', // Can read notes, cannot edit or attach files
        web: 'view-only',
    },
    
    automation: {
        id: 'automation',
        name: 'Automation',
        description: 'Task automation and workflows',
        tauri: 'full',
        pwa: 'disabled',
        web: 'disabled',
    },
    
    systemIntegration: {
        id: 'systemIntegration',
        name: 'System Integration',
        description: 'System tray, shortcuts, and native features',
        tauri: 'full',
        pwa: 'disabled',
        web: 'disabled',
    },
    
    advancedExport: {
        id: 'advancedExport',
        name: 'Advanced Export',
        description: 'Export to multiple formats with templates',
        tauri: 'full',
        pwa: 'limited', // Basic export only
        web: 'limited',
    },
    
    offlineFirst: {
        id: 'offlineFirst',
        name: 'Offline Mode',
        description: 'Full offline functionality',
        tauri: 'full',    // Complete offline with local DB
        pwa: 'limited',   // Basic offline with service worker
        web: 'disabled',  // Requires internet
    },
};

/**
 * Get capability for a specific feature on current platform
 */
export function getFeatureCapability(featureId: string): FeatureCapability {
    const platform = getPlatform();
    const feature = featureMatrix[featureId];
    
    if (!feature) {
        console.warn(`Feature "${featureId}" not found in feature matrix`);
        return 'disabled';
    }
    
    return feature[platform];
}

/**
 * Check if feature is available (not disabled)
 */
export function isFeatureAvailable(featureId: string): boolean {
    return getFeatureCapability(featureId) !== 'disabled';
}

/**
 * Check if feature has full capability
 */
export function hasFullFeature(featureId: string): boolean {
    return getFeatureCapability(featureId) === 'full';
}

/**
 * Check if feature is limited
 */
export function isFeatureLimited(featureId: string): boolean {
    const capability = getFeatureCapability(featureId);
    return capability === 'limited' || capability === 'view-only';
}

/**
 * Get features by capability level
 */
export function getFeaturesByCapability(capability: FeatureCapability): Feature[] {
    const platform = getPlatform();
    return Object.values(featureMatrix).filter(
        feature => feature[platform] === capability
    );
}

/**
 * Get all available features for current platform
 */
export function getAvailableFeatures(): Feature[] {
    return Object.values(featureMatrix).filter(feature => 
        isFeatureAvailable(feature.id)
    );
}

/**
 * Get feature restriction message
 */
export function getFeatureRestrictionMessage(featureId: string): string | null {
    const capability = getFeatureCapability(featureId);
    const platform = getPlatform();
    
    switch (capability) {
        case 'full':
            return null;
            
        case 'limited':
            if (platform === 'pwa' || platform === 'web') {
                return 'Some features are limited. Download the desktop app for full functionality.';
            }
            return null;
            
        case 'view-only':
            return 'This feature is read-only. Download the desktop app to edit.';
            
        case 'disabled':
            return 'This feature is only available in the desktop app.';
            
        default:
            return null;
    }
}

/**
 * Get capability badge text
 */
export function getCapabilityBadge(capability: FeatureCapability): string | null {
    switch (capability) {
        case 'full':
            return null;
        case 'limited':
            return 'Limited';
        case 'view-only':
            return 'View Only';
        case 'disabled':
            return 'Desktop Only';
        default:
            return null;
    }
}


/**
 * Platform Detection and Capability System
 * 
 * This module provides utilities to detect the current platform (Tauri, PWA, or Web)
 * and determine feature capabilities for each platform.
 */

import { browser } from '$app/environment';

export type Platform = 'tauri' | 'pwa' | 'web';
export type FeatureCapability = 'full' | 'limited' | 'view-only' | 'disabled';

/**
 * Detect if running in Tauri desktop app
 * Uses __TAURI_INTERNALS__ which is reliable in Tauri v2
 */
export function isTauri(): boolean {
    if (!browser) return false;
    // Use __TAURI_INTERNALS__ which is more reliable in Tauri v2
    return typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
}

/**
 * Detect if running as installed PWA
 */
export function isPWA(): boolean {
    if (!browser) return false;
    
    // Check if running in standalone mode (installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // @ts-ignore - iOS-specific property
    const isIOSStandalone = window.navigator.standalone === true;
    
    return isStandalone || isIOSStandalone;
}

/**
 * Get current platform
 */
export function getPlatform(): Platform {
    if (isTauri()) return 'tauri';
    if (isPWA()) return 'pwa';
    return 'web';
}

/**
 * Check if running on mobile device
 */
export function isMobile(): boolean {
    if (!browser) return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}

/**
 * Check if running on desktop
 */
export function isDesktop(): boolean {
    return !isMobile();
}

/**
 * Get platform display name
 */
export function getPlatformName(): string {
    const platform = getPlatform();
    const device = isMobile() ? 'Mobile' : 'Desktop';
    
    switch (platform) {
        case 'tauri':
            return `Tauri Desktop`;
        case 'pwa':
            return `PWA ${device}`;
        case 'web':
            return `Web ${device}`;
    }
}

/**
 * Check if platform supports a specific capability
 */
export function hasPlatformCapability(capability: string): boolean {
    const platform = getPlatform();
    
    const capabilities: Record<Platform, string[]> = {
        tauri: [
            'file-system',
            'native-dialogs',
            'system-tray',
            'global-shortcuts',
            'background-tasks',
            'local-database',
            'binary-execution',
            'multi-window',
            'deep-links',
            'offline-full',
            'notifications-rich',
        ],
        pwa: [
            'camera',
            'geolocation',
            'push-notifications',
            'offline-basic',
            'background-sync',
            'share-api',
        ],
        web: [
            'camera',
            'geolocation',
        ],
    };
    
    return capabilities[platform].includes(capability);
}

/**
 * Get download URL for Tauri desktop app
 */
export function getDesktopDownloadUrl(): string {
    const os = getOS();
    const baseUrl = '/downloads'; // Adjust to your actual download location
    
    switch (os) {
        case 'windows':
            return `${baseUrl}/Nen-Space-Setup.exe`;
        case 'macos':
            return `${baseUrl}/Nen-Space.dmg`;
        case 'linux':
            return `${baseUrl}/Nen-Space.AppImage`;
        default:
            return baseUrl;
    }
}

/**
 * Detect operating system
 */
export function getOS(): 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown' {
    if (!browser) return 'unknown';
    
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    if (/win/.test(platform)) return 'windows';
    if (/mac/.test(platform)) return 'macos';
    if (/linux/.test(platform)) return 'linux';
    
    return 'unknown';
}

/**
 * Open deep link to desktop app (if installed)
 */
export function openInDesktopApp(path: string): void {
    if (!browser) return;
    
    // Try to open with custom protocol (requires Tauri configuration)
    const deepLink = `nenspace://${path}`;
    window.location.href = deepLink;
    
    // Fallback: Suggest downloading if protocol fails
    setTimeout(() => {
        if (document.visibilityState === 'visible') {
            // Still on page, likely app not installed
            const shouldDownload = confirm(
                'Desktop app not found. Would you like to download it for the full experience?'
            );
            if (shouldDownload) {
                window.open(getDesktopDownloadUrl(), '_blank');
            }
        }
    }, 2000);
}


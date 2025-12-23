/**
 * Device ID Utilities
 * 
 * Gets the current device ID from device management service.
 * This is a compatibility layer that uses DeviceManagementService.
 */

import { DeviceManagementService } from '$lib/services/device-management.service.svelte';

/**
 * Get the current active device ID.
 * 
 * Uses DeviceManagementService to get the active device from localStorage.
 * If no device is selected, returns null (caller should handle this).
 * 
 * @returns Device ID string or null if no device selected
 */
export async function getDeviceId(): Promise<string | null> {
    return DeviceManagementService.getCurrentDeviceId();
}

/**
 * Get or create a device ID.
 * 
 * Gets the active device, or creates one if none exists.
 * This ensures there's always a device available for sync.
 * 
 * @returns Device ID string
 * @throws Error if device creation fails
 */
export async function getOrCreateDeviceId(): Promise<string> {
    const device = await DeviceManagementService.getOrCreateDevice();
    return device.id;
}

/**
 * Reset device ID (for testing or user request)
 * 
 * Clears the active device from localStorage.
 * User will need to select/create a new device.
 * 
 * @returns void
 */
export function resetDeviceId(): void {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.removeItem('nen_space_active_device_id');
}


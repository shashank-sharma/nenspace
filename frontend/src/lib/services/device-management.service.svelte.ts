/**
 * Device Management Service
 * 
 * Manages user devices for multi-device sync tracking.
 * Handles device selection, creation, and persistence in localStorage and backend.
 */

import { browser } from '$app/environment';
import { pb } from '$lib/config/pocketbase';
import { authService } from '$lib/services/authService.svelte';
import { toast } from 'svelte-sonner';
import type { DeviceRecord } from '$lib/types/pocketbase';
import { FilterBuilder } from '$lib/utils/pocketbase-filter.util';

// ========================================
// Constants
// ========================================

/** localStorage key for active device ID */
const ACTIVE_DEVICE_ID_KEY = 'nen_space_active_device_id';

// ========================================
// Service Implementation
// ========================================

class DeviceManagementServiceImpl {
    #devicesCache: DeviceRecord[] | null = null;
    #activeDeviceId: string | null = null;

    constructor() {
        if (browser) {
            // Load active device ID from localStorage
            this.#activeDeviceId = localStorage.getItem(ACTIVE_DEVICE_ID_KEY);
        }
    }

    // ========================================
    // Device Selection
    // ========================================

    /**
     * Get the currently active device ID from localStorage.
     * 
     * @returns Active device ID or null if none selected
     */
    getCurrentDeviceId(): string | null {
        if (!browser) {
            return null;
        }
        return this.#activeDeviceId || localStorage.getItem(ACTIVE_DEVICE_ID_KEY);
    }

    /**
     * Set the active device ID.
     * Stores in localStorage and updates backend device.is_active flag.
     * 
     * @param deviceId - Device ID to set as active
     * @throws Error if device not found or update fails
     */
    async setActiveDevice(deviceId: string): Promise<void> {
        if (!browser) {
            throw new Error('Device management only available in browser');
        }

        const userId = authService.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        // Verify device exists and belongs to user
        const device = await this.getDevice(deviceId);
        if (!device || device.user !== userId) {
            throw new Error('Device not found or access denied');
        }

        // Update all user devices: set is_active to false for all, then true for selected
        const userDevices = await this.getUserDevices();
        for (const dev of userDevices) {
            await pb.collection('devices').update(dev.id, {
                is_active: dev.id === deviceId,
            });
        }

        // Update localStorage
        this.#activeDeviceId = deviceId;
        localStorage.setItem(ACTIVE_DEVICE_ID_KEY, deviceId);

        // Update cache
        this.#devicesCache = userDevices.map(dev => ({
            ...dev,
            is_active: dev.id === deviceId,
        }));

        console.log(`[DeviceManagement] Active device set to: ${device.name} (${deviceId})`);
    }

    // ========================================
    // Device CRUD Operations
    // ========================================

    /**
     * Get a single device by ID.
     * 
     * @param deviceId - Device ID
     * @returns Device record or null if not found
     * @throws Error if fetch fails
     */
    async getDevice(deviceId: string): Promise<DeviceRecord | null> {
        try {
            const device = await pb.collection('devices').getOne<DeviceRecord>(deviceId);
            return device;
        } catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Get all devices for the current user.
     * 
     * @returns Array of device records
     * @throws Error if fetch fails or user not authenticated
     */
    async getUserDevices(): Promise<DeviceRecord[]> {
        const userId = authService.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        // Return cached devices if available
        if (this.#devicesCache) {
            return this.#devicesCache;
        }

        try {
            const filter = FilterBuilder.create()
                .equals('user', userId)
                .build();

            const devices = await pb.collection('devices').getFullList<DeviceRecord>({
                filter,
                sort: '-is_active,-last_sync,-created',
            });

            this.#devicesCache = devices;
            return devices;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[DeviceManagement] Failed to fetch user devices:', errorMessage);
            throw error;
        }
    }

    /**
     * Create a new device for the current user.
     * 
     * @param name - Device name
     * @param hostname - Optional hostname
     * @param os - Optional OS
     * @param arch - Optional architecture
     * @param type - Optional device type
     * @returns Created device record
     * @throws Error if creation fails or user not authenticated
     */
    async createDevice(
        name: string,
        hostname?: string,
        os?: string,
        arch?: string,
        type?: string
    ): Promise<DeviceRecord> {
        const userId = authService.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        try {
            // Set all other devices to inactive
            const userDevices = await this.getUserDevices();
            for (const dev of userDevices) {
                if (dev.is_active) {
                    await pb.collection('devices').update(dev.id, { is_active: false });
                }
            }

            // Create new device as active
            const device = await pb.collection('devices').create<DeviceRecord>({
                user: userId,
                name,
                hostname: hostname || '',
                os: os || '',
                arch: arch || '',
                type: type || '',
                is_online: true,
                is_active: true,
                is_public: false,
                sync_events: true,
                last_online: new Date().toISOString(),
                last_sync: new Date().toISOString(),
            });

            // Clear cache
            this.#devicesCache = null;

            // Set as active device
            this.#activeDeviceId = device.id;
            localStorage.setItem(ACTIVE_DEVICE_ID_KEY, device.id);

            console.log(`[DeviceManagement] Created device: ${device.name} (${device.id})`);
            return device;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[DeviceManagement] Failed to create device:', errorMessage);
            toast.error('Failed to create device');
            throw error;
        }
    }

    /**
     * Update device name.
     * 
     * @param deviceId - Device ID
     * @param name - New device name
     * @throws Error if update fails or device not found
     */
    async updateDeviceName(deviceId: string, name: string): Promise<void> {
        const userId = authService.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        // Verify device belongs to user
        const device = await this.getDevice(deviceId);
        if (!device || device.user !== userId) {
            throw new Error('Device not found or access denied');
        }

        try {
            await pb.collection('devices').update(deviceId, { name });
            
            // Clear cache
            this.#devicesCache = null;
            
            console.log(`[DeviceManagement] Updated device name: ${name}`);
            toast.success('Device name updated');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[DeviceManagement] Failed to update device name:', errorMessage);
            toast.error('Failed to update device name');
            throw error;
        }
    }

    /**
     * Delete a device.
     * 
     * @param deviceId - Device ID to delete
     * @throws Error if deletion fails or device not found
     */
    async deleteDevice(deviceId: string): Promise<void> {
        const userId = authService.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        // Verify device belongs to user
        const device = await this.getDevice(deviceId);
        if (!device || device.user !== userId) {
            throw new Error('Device not found or access denied');
        }

        try {
            await pb.collection('devices').delete(deviceId);
            
            // Clear cache
            this.#devicesCache = null;
            
            // If deleted device was active, clear active device
            if (this.#activeDeviceId === deviceId) {
                this.#activeDeviceId = null;
                localStorage.removeItem(ACTIVE_DEVICE_ID_KEY);
            }
            
            console.log(`[DeviceManagement] Deleted device: ${deviceId}`);
            toast.success('Device deleted');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[DeviceManagement] Failed to delete device:', errorMessage);
            toast.error('Failed to delete device');
            throw error;
        }
    }

    /**
     * Get or create a device for the current user.
     * If no active device exists, creates one with auto-detected info.
     * 
     * @param name - Optional device name (auto-generated if not provided)
     * @returns Device record
     * @throws Error if operation fails
     */
    async getOrCreateDevice(name?: string): Promise<DeviceRecord> {
        const userId = authService.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        // Check if active device exists
        const activeDeviceId = this.getCurrentDeviceId();
        if (activeDeviceId) {
            const device = await this.getDevice(activeDeviceId);
            if (device && device.user === userId) {
                return device;
            }
        }

        // Check if user has any active device
        const userDevices = await this.getUserDevices();
        const activeDevice = userDevices.find(dev => dev.is_active);
        if (activeDevice) {
            // Set as active in localStorage
            this.#activeDeviceId = activeDevice.id;
            localStorage.setItem(ACTIVE_DEVICE_ID_KEY, activeDevice.id);
            return activeDevice;
        }

        // No active device found, create one
        const deviceName = name || this.#generateDeviceName();
        const deviceInfo = this.#detectDeviceInfo();
        
        return this.createDevice(
            deviceName,
            deviceInfo.hostname,
            deviceInfo.os,
            deviceInfo.arch,
            deviceInfo.type
        );
    }

    /**
     * Update device's last_sync timestamp.
     * Called automatically during sync operations.
     * 
     * @param deviceId - Device ID
     * @throws Error if update fails
     */
    async updateLastSync(deviceId: string): Promise<void> {
        try {
            await pb.collection('devices').update(deviceId, {
                last_sync: new Date().toISOString(),
                last_online: new Date().toISOString(),
                is_online: true,
            });
        } catch (error) {
            // Don't throw - this is a non-critical update
            console.warn('[DeviceManagement] Failed to update last_sync:', error);
        }
    }

    /**
     * Clear device cache (force refresh on next fetch).
     */
    clearCache(): void {
        this.#devicesCache = null;
    }

    // ========================================
    // Private Helpers
    // ========================================

    /**
     * Generate a default device name based on browser info.
     * 
     * @private
     */
    #generateDeviceName(): string {
        if (!browser) {
            return 'Unknown Device';
        }

        const platform = navigator.platform || 'Unknown';
        const userAgent = navigator.userAgent || '';
        
        // Try to detect OS
        let os = 'Unknown';
        if (userAgent.includes('Windows')) os = 'Windows';
        else if (userAgent.includes('Mac')) os = 'macOS';
        else if (userAgent.includes('Linux')) os = 'Linux';
        else if (userAgent.includes('Android')) os = 'Android';
        else if (userAgent.includes('iOS')) os = 'iOS';

        // Try to detect browser
        let browser = 'Browser';
        if (userAgent.includes('Chrome')) browser = 'Chrome';
        else if (userAgent.includes('Firefox')) browser = 'Firefox';
        else if (userAgent.includes('Safari')) browser = 'Safari';
        else if (userAgent.includes('Edge')) browser = 'Edge';

        return `${os} ${browser}`;
    }

    /**
     * Detect device information from browser.
     * 
     * @private
     */
    #detectDeviceInfo(): {
        hostname: string;
        os: string;
        arch: string;
        type: string;
    } {
        if (!browser) {
            return {
                hostname: '',
                os: '',
                arch: '',
                type: '',
            };
        }

        const userAgent = navigator.userAgent || '';
        const platform = navigator.platform || '';

        // Detect OS
        let os = '';
        if (userAgent.includes('Windows')) os = 'Windows';
        else if (userAgent.includes('Mac')) os = 'macOS';
        else if (userAgent.includes('Linux')) os = 'Linux';
        else if (userAgent.includes('Android')) os = 'Android';
        else if (userAgent.includes('iOS')) os = 'iOS';

        // Detect architecture (limited in browser)
        let arch = '';
        if (platform.includes('Win64') || platform.includes('x64')) arch = 'x64';
        else if (platform.includes('Win32') || platform.includes('x86')) arch = 'x86';
        else if (platform.includes('MacIntel')) arch = 'x64';
        else if (platform.includes('MacARM')) arch = 'arm64';
        else arch = 'unknown';

        // Detect device type
        let type = 'desktop';
        if (userAgent.includes('Mobile') || userAgent.includes('Android')) type = 'mobile';
        else if (userAgent.includes('Tablet')) type = 'tablet';

        return {
            hostname: window.location.hostname || '',
            os,
            arch,
            type,
        };
    }
}

// Export singleton instance
export const DeviceManagementService = new DeviceManagementServiceImpl();


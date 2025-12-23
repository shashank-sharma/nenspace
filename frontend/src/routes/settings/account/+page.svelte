<!-- src/routes/settings/account/+page.svelte -->
<script lang="ts">
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Label } from "$lib/components/ui/label";
    import * as Select from "$lib/components/ui/select";
    import { Switch } from "$lib/components/ui/switch";
    import { Input } from "$lib/components/ui/input";
    import { toast } from "svelte-sonner";
    import { User, Globe, Eye, RotateCcw, Clock, Smartphone, Plus, Edit2, Trash2 } from "lucide-svelte";
    import type { AccountSettings } from "$lib/types/settings.types";
    import { DeviceManagementService } from "$lib/services/device-management.service.svelte";
    import type { DeviceRecord } from "$lib/types/pocketbase";
    import { onMount } from "svelte";

    // Use settings service for reactive state
    let settings = $derived(SettingsService.account);
    let loadingState = $derived(SettingsService.loadingStates.account);
    let isLoading = $derived(loadingState.loading);
    let hasError = $derived(loadingState.error !== null);
    
    // Update settings with auto-sync
    async function updateSetting<K extends keyof typeof settings>(
        key: K, 
        value: typeof settings[K]
    ) {
        await SettingsService.updateSettings('account', { [key]: value });
        toast.success('Account settings updated');
    }

    // Common timezones grouped by region
    const timezones = [
        // Americas
        { value: 'America/New_York', label: 'Eastern Time (US & Canada)', group: 'Americas' },
        { value: 'America/Chicago', label: 'Central Time (US & Canada)', group: 'Americas' },
        { value: 'America/Denver', label: 'Mountain Time (US & Canada)', group: 'Americas' },
        { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)', group: 'Americas' },
        { value: 'America/Toronto', label: 'Toronto', group: 'Americas' },
        { value: 'America/Vancouver', label: 'Vancouver', group: 'Americas' },
        { value: 'America/Mexico_City', label: 'Mexico City', group: 'Americas' },
        { value: 'America/Sao_Paulo', label: 'São Paulo', group: 'Americas' },
        { value: 'America/Buenos_Aires', label: 'Buenos Aires', group: 'Americas' },
        
        // Europe
        { value: 'Europe/London', label: 'London', group: 'Europe' },
        { value: 'Europe/Paris', label: 'Paris', group: 'Europe' },
        { value: 'Europe/Berlin', label: 'Berlin', group: 'Europe' },
        { value: 'Europe/Rome', label: 'Rome', group: 'Europe' },
        { value: 'Europe/Madrid', label: 'Madrid', group: 'Europe' },
        { value: 'Europe/Amsterdam', label: 'Amsterdam', group: 'Europe' },
        { value: 'Europe/Stockholm', label: 'Stockholm', group: 'Europe' },
        { value: 'Europe/Moscow', label: 'Moscow', group: 'Europe' },
        
        // Asia
        { value: 'Asia/Tokyo', label: 'Tokyo', group: 'Asia' },
        { value: 'Asia/Shanghai', label: 'Shanghai', group: 'Asia' },
        { value: 'Asia/Hong_Kong', label: 'Hong Kong', group: 'Asia' },
        { value: 'Asia/Singapore', label: 'Singapore', group: 'Asia' },
        { value: 'Asia/Seoul', label: 'Seoul', group: 'Asia' },
        { value: 'Asia/Dubai', label: 'Dubai', group: 'Asia' },
        { value: 'Asia/Kolkata', label: 'Mumbai, New Delhi', group: 'Asia' },
        { value: 'Asia/Bangkok', label: 'Bangkok', group: 'Asia' },
        
        // Oceania
        { value: 'Australia/Sydney', label: 'Sydney', group: 'Oceania' },
        { value: 'Australia/Melbourne', label: 'Melbourne', group: 'Oceania' },
        { value: 'Australia/Brisbane', label: 'Brisbane', group: 'Oceania' },
        { value: 'Pacific/Auckland', label: 'Auckland', group: 'Oceania' },
        
        // Africa
        { value: 'Africa/Cairo', label: 'Cairo', group: 'Africa' },
        { value: 'Africa/Johannesburg', label: 'Johannesburg', group: 'Africa' },
        { value: 'Africa/Lagos', label: 'Lagos', group: 'Africa' },
    ];

    // Get current timezone display
    function getCurrentTimezoneDisplay(): string {
        const tz = settings.timezone;
        const found = timezones.find(t => t.value === tz);
        if (found) return found.label;
        
        // Try to format the timezone name nicely
        return tz.replace(/_/g, ' ').replace(/\//g, ' / ');
    }

    // Get current time in selected timezone for preview
    function getCurrentTimePreview(): string {
        try {
            const now = new Date();
            return new Intl.DateTimeFormat('en-US', {
                timeZone: settings.timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
            }).format(now);
        } catch {
            return 'Invalid timezone';
        }
    }

    // Get current date in selected timezone for preview
    function getCurrentDatePreview(): string {
        try {
            const now = new Date();
            return new Intl.DateTimeFormat('en-US', {
                timeZone: settings.timezone,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }).format(now);
        } catch {
            return 'Invalid timezone';
        }
    }

    const profileVisibilityOptions = [
        { value: 'private', label: 'Private', description: 'Only you can see your profile' },
        { value: 'friends', label: 'Friends', description: 'Only your friends can see your profile' },
        { value: 'public', label: 'Public', description: 'Everyone can see your profile' },
    ];

    // Reset settings to defaults
    async function resetSettings() {
        await SettingsService.resetCategory('account');
        toast.success('Account settings reset to defaults');
    }

    // Device Management
    let devices = $state<DeviceRecord[]>([]);
    let currentDeviceId = $state<string | null>(null);
    let isLoadingDevices = $state(false);
    let showCreateDevice = $state(false);
    let showEditDevice = $state(false);
    let editingDevice = $state<DeviceRecord | null>(null);
    let newDeviceName = $state('');
    let editDeviceName = $state('');

    onMount(async () => {
        await loadDevices();
    });

    async function loadDevices() {
        isLoadingDevices = true;
        try {
            devices = await DeviceManagementService.getUserDevices();
            currentDeviceId = DeviceManagementService.getCurrentDeviceId();
        } catch (error) {
            console.error('Failed to load devices:', error);
            toast.error('Failed to load devices');
        } finally {
            isLoadingDevices = false;
        }
    }

    async function handleDeviceSelect(deviceId: string) {
        try {
            await DeviceManagementService.setActiveDevice(deviceId);
            currentDeviceId = deviceId;
            await loadDevices(); // Refresh to update is_active flags
            toast.success('Device selected');
        } catch (error) {
            console.error('Failed to select device:', error);
            toast.error('Failed to select device');
        }
    }

    async function handleCreateDevice() {
        if (!newDeviceName.trim()) {
            toast.error('Device name is required');
            return;
        }
        try {
            await DeviceManagementService.createDevice(newDeviceName.trim());
            newDeviceName = '';
            showCreateDevice = false;
            await loadDevices();
            toast.success('Device created');
        } catch (error) {
            console.error('Failed to create device:', error);
            toast.error('Failed to create device');
        }
    }

    function startEditDevice(device: DeviceRecord) {
        editingDevice = device;
        editDeviceName = device.name;
        showEditDevice = true;
    }

    async function handleUpdateDeviceName() {
        if (!editingDevice || !editDeviceName.trim()) {
            return;
        }
        try {
            await DeviceManagementService.updateDeviceName(editingDevice.id, editDeviceName.trim());
            showEditDevice = false;
            editingDevice = null;
            editDeviceName = '';
            await loadDevices();
        } catch (error) {
            console.error('Failed to update device name:', error);
            toast.error('Failed to update device name');
        }
    }

    async function handleDeleteDevice(deviceId: string) {
        if (!confirm('Are you sure you want to delete this device? This action cannot be undone.')) {
            return;
        }
        try {
            await DeviceManagementService.deleteDevice(deviceId);
            await loadDevices();
        } catch (error) {
            console.error('Failed to delete device:', error);
            toast.error('Failed to delete device');
        }
    }

    function formatDate(dateString?: string): string {
        if (!dateString) return 'Never';
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }).format(date);
        } catch {
            return 'Invalid date';
        }
    }

    const currentDevice = $derived(devices.find(d => d.id === currentDeviceId));
</script>

<div class="space-y-8">
    <!-- Timezone Settings -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Clock class="h-5 w-5" />
            <h3 class="text-lg font-medium">Timezone</h3>
        </div>
        <p class="text-sm text-muted-foreground">
            Set your timezone to ensure dates and times are displayed correctly. This affects journal entries, calendar events, and other time-based features.
        </p>

        <div class="grid gap-4">
            <div class="space-y-2">
                <Label for="timezone">Select Timezone</Label>
                <Select.Root
                    value={settings.timezone}
                    onValueChange={(value: string | undefined) => {
                        if (value) {
                            updateSetting('timezone', value);
                        }
                    }}
                >
                    <Select.Trigger id="timezone" class="w-full" disabled={isLoading}>
                        <Select.Value placeholder="Select timezone" />
                    </Select.Trigger>
                    <Select.Content>
                        {#each timezones as tz}
                            <Select.Item value={tz.value}>
                                {tz.label} ({tz.group})
                            </Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
                
                <!-- Timezone Preview -->
                <div class="mt-3 p-3 bg-muted rounded-md">
                    <p class="text-sm font-medium mb-1">Current time in your timezone:</p>
                    <p class="text-lg font-mono">{getCurrentTimePreview()}</p>
                    <p class="text-sm text-muted-foreground mt-1">{getCurrentDatePreview()}</p>
                </div>
            </div>
        </div>
    </div>

    <div class="border-t pt-6"></div>

    <!-- Profile Visibility -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Eye class="h-5 w-5" />
            <h3 class="text-lg font-medium">Profile Visibility</h3>
        </div>
        <p class="text-sm text-muted-foreground">
            Control who can see your profile information.
        </p>

        <div class="grid gap-4">
            <div class="space-y-2">
                <Label>Profile Visibility</Label>
                <div class="space-y-3">
                    {#each profileVisibilityOptions as option}
                        <div class="flex items-start space-x-3">
                            <input
                                type="radio"
                                id="visibility-{option.value}"
                                name="profileVisibility"
                                value={option.value}
                                checked={settings.profileVisibility === option.value}
                                onchange={() => updateSetting('profileVisibility', option.value as any)}
                                class="mt-1 h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                            />
                            <div class="flex-1">
                                <label
                                    for="visibility-{option.value}"
                                    class="text-sm font-medium cursor-pointer"
                                >
                                    {option.label}
                                </label>
                                <p class="text-xs text-muted-foreground">
                                    {option.description}
                                </p>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    </div>

    <div class="border-t pt-6"></div>

    <!-- Discovery Settings -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Globe class="h-5 w-5" />
            <h3 class="text-lg font-medium">Discovery</h3>
        </div>
        <p class="text-sm text-muted-foreground">
            Control whether others can discover your profile.
        </p>

        <div class="grid gap-4">
            <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                    <Label>Allow Discovery</Label>
                    <p class="text-sm text-muted-foreground">
                        Let others find and connect with you
                    </p>
                </div>
                <Switch
                    checked={settings.allowDiscovery}
                    onCheckedChange={(checked) => updateSetting('allowDiscovery', checked)}
                />
            </div>
        </div>
    </div>

    <div class="border-t pt-6"></div>

    <!-- Device Management -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Smartphone class="h-5 w-5" />
            <h3 class="text-lg font-medium">Device Management</h3>
        </div>
        <p class="text-sm text-muted-foreground">
            Manage your devices for multi-device sync. Select which device to use for syncing your journal entries.
        </p>

        {#if isLoadingDevices}
            <p class="text-sm text-muted-foreground">Loading devices...</p>
        {:else}
            <div class="space-y-4">
                <!-- Current Device Display -->
                {#if currentDevice}
                    <div class="p-4 bg-muted rounded-md">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium">Active Device</p>
                                <p class="text-lg">{currentDevice.name}</p>
                                <p class="text-xs text-muted-foreground mt-1">
                                    ID: {currentDevice.id}
                                </p>
                                {#if currentDevice.last_sync}
                                    <p class="text-xs text-muted-foreground">
                                        Last synced: {formatDate(currentDevice.last_sync)}
                                    </p>
                                {/if}
                            </div>
                            {#if currentDevice.os}
                                <div class="text-right">
                                    <p class="text-xs text-muted-foreground">{currentDevice.os}</p>
                                    {#if currentDevice.arch}
                                        <p class="text-xs text-muted-foreground">{currentDevice.arch}</p>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}

                <!-- Device Selection Dropdown -->
                <div class="space-y-2">
                    <Label for="device-select">Select Device</Label>
                    <Select.Root
                        value={currentDeviceId || undefined}
                        onValueChange={(value: string | undefined) => {
                            if (value) {
                                handleDeviceSelect(value);
                            }
                        }}
                    >
                        <Select.Trigger id="device-select" class="w-full" disabled={isLoadingDevices}>
                            <Select.Value placeholder="Select a device" />
                        </Select.Trigger>
                        <Select.Content>
                            {#each devices as device}
                                <Select.Item value={device.id} label={device.is_active ? `${device.name} (Active)` : device.name}>
                                    {device.is_active ? `${device.name} (Active)` : device.name}
                                </Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>

                <!-- Device List -->
                {#if devices.length > 0}
                    <div class="space-y-2">
                        <Label>All Devices</Label>
                        <div class="space-y-2">
                            {#each devices as device}
                                <div class="flex items-center justify-between p-3 border rounded-md">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2">
                                            <p class="font-medium">{device.name}</p>
                                            {#if device.is_active}
                                                <span class="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">Active</span>
                                            {/if}
                                        </div>
                                        <p class="text-xs text-muted-foreground mt-1">
                                            {device.id}
                                        </p>
                                        {#if device.last_sync}
                                            <p class="text-xs text-muted-foreground">
                                                Last synced: {formatDate(device.last_sync)}
                                            </p>
                                        {:else}
                                            <p class="text-xs text-muted-foreground">Never synced</p>
                                        {/if}
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            on:click={() => startEditDevice(device)}
                                        >
                                            <Edit2 class="h-4 w-4" />
                                        </Button>
                                        {#if !device.is_active}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                on:click={() => handleDeleteDevice(device.id)}
                                            >
                                                <Trash2 class="h-4 w-4 text-destructive" />
                                            </Button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Create Device Button -->
                <Button
                    variant="outline"
                    on:click={() => {
                        showCreateDevice = true;
                        newDeviceName = '';
                    }}
                    class="w-full"
                >
                    <Plus class="mr-2 h-4 w-4" />
                    Create New Device
                </Button>

                <!-- Create Device Dialog -->
                {#if showCreateDevice}
                    <div class="p-4 border rounded-md space-y-4">
                        <div class="space-y-2">
                            <Label for="new-device-name">Device Name</Label>
                            <Input
                                id="new-device-name"
                                bind:value={newDeviceName}
                                placeholder="e.g., My Laptop, Work Computer"
                            />
                        </div>
                        <div class="flex gap-2">
                            <Button
                                on:click={handleCreateDevice}
                                disabled={!newDeviceName.trim()}
                            >
                                Create
                            </Button>
                            <Button
                                variant="outline"
                                on:click={() => {
                                    showCreateDevice = false;
                                    newDeviceName = '';
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                {/if}

                <!-- Edit Device Dialog -->
                {#if showEditDevice && editingDevice}
                    <div class="p-4 border rounded-md space-y-4">
                        <div class="space-y-2">
                            <Label for="edit-device-name">Device Name</Label>
                            <Input
                                id="edit-device-name"
                                bind:value={editDeviceName}
                                placeholder="Device name"
                            />
                        </div>
                        <div class="flex gap-2">
                            <Button
                                on:click={handleUpdateDeviceName}
                                disabled={!editDeviceName.trim()}
                            >
                                Update
                            </Button>
                            <Button
                                variant="outline"
                                on:click={() => {
                                    showEditDevice = false;
                                    editingDevice = null;
                                    editDeviceName = '';
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    <div class="border-t pt-6"></div>

    <!-- Language Settings -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Globe class="h-5 w-5" />
            <h3 class="text-lg font-medium">Language</h3>
        </div>
        <p class="text-sm text-muted-foreground">
            Set your preferred language for the interface.
        </p>

        <div class="grid gap-4">
            <div class="space-y-2">
                <Label for="language">Language</Label>
                <Select.Root
                    value={settings.language}
                    onValueChange={(value: string | undefined) => {
                        if (value) {
                            updateSetting('language', value);
                        }
                    }}
                >
                    <Select.Trigger id="language" class="w-full" disabled={isLoading}>
                        <Select.Value placeholder="Select language" />
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="en">English</Select.Item>
                        <Select.Item value="es">Español</Select.Item>
                        <Select.Item value="fr">Français</Select.Item>
                        <Select.Item value="de">Deutsch</Select.Item>
                        <Select.Item value="it">Italiano</Select.Item>
                        <Select.Item value="pt">Português</Select.Item>
                        <Select.Item value="ja">日本語</Select.Item>
                        <Select.Item value="zh">中文</Select.Item>
                        <Select.Item value="ko">한국어</Select.Item>
                    </Select.Content>
                </Select.Root>
            </div>
        </div>
    </div>

    <div class="border-t pt-6"></div>

    <!-- Reset Section -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <RotateCcw class="h-5 w-5 text-destructive" />
            <h3 class="text-lg font-medium text-destructive">Danger Zone</h3>
        </div>
        <p class="text-sm text-muted-foreground">
            Reset all account settings to their default values.
        </p>

        <Button
            variant="destructive"
            on:click={resetSettings}
            disabled={isLoading}
        >
            <RotateCcw class="mr-2 h-4 w-4" />
            Reset Account Settings
        </Button>
    </div>
</div>


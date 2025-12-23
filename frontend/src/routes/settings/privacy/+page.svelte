<!-- src/routes/settings/privacy/+page.svelte -->
<script lang="ts">
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import { Switch } from "$lib/components/ui/switch";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { toast } from "svelte-sonner";
    import * as Select from "$lib/components/ui/select";
    import { Shield, Lock, Eye, Key, RotateCcw } from "lucide-svelte";

    // Use settings service for reactive state
    let settings = $derived(SettingsService.privacy);
    let loadingState = $derived(SettingsService.loadingStates.privacy);
    let isLoading = $derived(loadingState.loading);
    let hasError = $derived(loadingState.error !== null);
    
    // Update settings with auto-sync
    async function updateSetting<K extends keyof typeof settings>(
        key: K, 
        value: typeof settings[K]
    ) {
        await SettingsService.updateSettings('privacy', { [key]: value });
    }

    const securityLevels = [
        { value: "low", label: "Basic" },
        { value: "medium", label: "Standard" },
        { value: "high", label: "Enhanced" },
        { value: "custom", label: "Custom" },
    ];

    // Reset settings to defaults
    async function resetSettings() {
        await SettingsService.resetCategory('privacy');
    }
</script>

<div class="space-y-8">
    <!-- Security Settings -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Shield class="h-5 w-5" />
            <h3 class="text-lg font-medium">Security Settings</h3>
        </div>

        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                    <Label>Two-Factor Authentication</Label>
                    <p class="text-sm text-muted-foreground">
                        Add an extra layer of security to your account
                    </p>
                </div>
                <Switch
                    checked={settings.twoFactorEnabled}
                    onCheckedChange={(checked) => updateSetting('twoFactorEnabled', checked)}
                    disabled={isLoading}
                />
            </div>

            <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                    <Label>Login Notifications</Label>
                    <p class="text-sm text-muted-foreground">
                        Get notified of new login attempts
                    </p>
                </div>
                <Switch
                    checked={settings.loginNotifications}
                    onCheckedChange={(checked) => updateSetting('loginNotifications', checked)}
                    disabled={isLoading}
                />
            </div>

            <div class="space-y-2">
                <Label>Security Level</Label>
                <Select.Root 
                    value={settings.securityLevel}
                    onValueChange={(value) => value && updateSetting('securityLevel', value as any)}
                >
                    <Select.Trigger class="w-full" disabled={isLoading}>
                        <Select.Value placeholder="Select security level" />
                    </Select.Trigger>
                    <Select.Content>
                        {#each securityLevels as level}
                            <Select.Item value={level.value}>
                                {level.label}
                            </Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>
        </div>
    </div>

    <!-- Privacy Settings -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Eye class="h-5 w-5" />
            <h3 class="text-lg font-medium">Privacy Settings</h3>
        </div>

        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                    <Label>Activity Logging</Label>
                    <p class="text-sm text-muted-foreground">
                        Track your account activity for security
                    </p>
                </div>
                <Switch
                    checked={settings.activityLogging}
                    onCheckedChange={(checked) => updateSetting('activityLogging', checked)}
                    disabled={isLoading}
                />
            </div>

            <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                    <Label>Public Profile</Label>
                    <p class="text-sm text-muted-foreground">
                        Make your profile visible to others
                    </p>
                </div>
                <Switch
                    checked={settings.publicProfile}
                    onCheckedChange={(checked) => updateSetting('publicProfile', checked)}
                    disabled={isLoading}
                />
            </div>

            <div class="space-y-2">
                <Label>Data Sharing</Label>
                <Select.Root 
                    value={settings.dataSharing}
                    onValueChange={(value) => value && updateSetting('dataSharing', value as any)}
                >
                    <Select.Trigger class="w-full" disabled={isLoading}>
                        <Select.Value placeholder="Select data sharing level" />
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="none">No sharing</Select.Item>
                        <Select.Item value="minimal">Minimal</Select.Item>
                        <Select.Item value="standard">Standard</Select.Item>
                        <Select.Item value="full">Full</Select.Item>
                    </Select.Content>
                </Select.Root>
            </div>
        </div>
    </div>

    <!-- Password Management -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Key class="h-5 w-5" />
            <h3 class="text-lg font-medium">Password Management</h3>
        </div>

        <div class="space-y-4">
            <div class="space-y-2">
                <Label>Last Password Change</Label>
                <p class="text-sm text-muted-foreground">
                    January 1, 2024
                </p>
            </div>

            <!-- Actions & Status -->
            <div class="flex justify-between items-center">
                <Button 
                    variant="outline" 
                    on:click={resetSettings}
                    disabled={isLoading}
                >
                    <RotateCcw class="h-4 w-4 mr-2" />
                    Reset to Defaults
                </Button>
                
                <div class="flex items-center gap-2">
                    {#if hasError}
                        <p class="text-sm text-destructive">
                            {loadingState.error}
                        </p>
                    {:else if loadingState.lastSynced}
                        <p class="text-sm text-muted-foreground">
                            Auto-saved {new Date(loadingState.lastSynced).toLocaleTimeString()}
                        </p>
                    {/if}
                    
                    {#if isLoading}
                        <div class="flex items-center gap-2 text-sm text-muted-foreground">
                            <div class="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                            Saving...
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>

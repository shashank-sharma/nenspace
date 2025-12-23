<!-- src/routes/settings/notifications/+page.svelte -->
<script lang="ts">
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Label } from "$lib/components/ui/label";
    import { Switch } from "$lib/components/ui/switch";
    import { Input } from "$lib/components/ui/input";
    import * as Select from "$lib/components/ui/select";
    import { Separator } from "$lib/components/ui/separator";
    import { Card } from "$lib/components/ui/card";
    import { toast } from "svelte-sonner";
    import { Bell, Volume2, Mail, Clock, LayoutDashboard, RotateCcw } from "lucide-svelte";

    // Use settings service for reactive state
    let settings = $derived(SettingsService.notifications);
    let loadingState = $derived(SettingsService.loadingStates.notifications);
    let isLoading = $derived(loadingState.loading);
    let hasError = $derived(loadingState.error !== null);
    
    // Update settings with auto-sync
    async function updateSetting<K extends keyof typeof settings>(
        key: K, 
        value: typeof settings[K]
    ) {
        await SettingsService.updateSettings('notifications', { [key]: value });
    }

    const notificationTypes = [
        {
            value: "system",
            label: "System Notifications",
            description: "Important updates about your account and system",
        },
        {
            value: "task",
            label: "Task Updates",
            description: "Changes and reminders for your tasks",
        },
        {
            value: "habit",
            label: "Habit Reminders",
            description: "Daily reminders for your habits",
        },
        {
            value: "focus",
            label: "Focus Sessions",
            description: "Updates about your focus sessions",
        },
        {
            value: "calendar",
            label: "Calendar Events",
            description: "Upcoming events and meeting reminders",
        },
        {
            value: "email",
            label: "Email Notifications",
            description: "New email and message alerts",
        },
    ];

    const digestFrequencies = [
        { value: "never", label: "Never" },
        { value: "daily", label: "Daily Digest" },
        { value: "weekly", label: "Weekly Digest" },
    ];

    const priorityLevels = [
        { value: "all", label: "All Notifications" },
        { value: "important", label: "Important Only" },
        { value: "urgent", label: "Urgent Only" },
        { value: "custom", label: "Custom" },
    ];

    // Reset settings to defaults
    async function resetSettings() {
        await SettingsService.resetCategory('notifications');
    }
    
    function toggleNotificationType(type: string) {
        const currentTypes = settings.typesEnabled;
        const newTypes = currentTypes.includes(type)
            ? currentTypes.filter(t => t !== type)
            : [...currentTypes, type];
        updateSetting('typesEnabled', newTypes);
    }
</script>

<div class="space-y-8">
        <!-- General Notifications -->
        <div class="space-y-4">
            <div class="flex items-center gap-2">
                <Bell class="h-5 w-5" />
                <h3 class="text-lg font-medium">General Notifications</h3>
            </div>

            <div class="grid gap-4">
                <div class="flex items-center justify-between">
                    <div class="space-y-0.5">
                        <Label>Desktop Notifications</Label>
                        <p class="text-sm text-muted-foreground">
                            Show notifications on your desktop
                        </p>
                    </div>
                    <Switch
                        checked={settings.desktopNotifications}
                        onCheckedChange={(checked) => updateSetting('desktopNotifications', checked)}
                        disabled={isLoading}
                    />
                </div>

                <div class="flex items-center justify-between">
                    <div class="space-y-0.5">
                        <Label>Notification Sounds</Label>
                        <p class="text-sm text-muted-foreground">
                            Play sounds for notifications
                        </p>
                    </div>
                    <Switch
                        checked={settings.soundEnabled}
                        onCheckedChange={(checked) => updateSetting('soundEnabled', checked)}
                        disabled={isLoading}
                    />
                </div>

                <div class="space-y-2">
                    <Label>Priority Level</Label>
                    <Select.Root 
                        value={settings.priorityLevel}
                        onValueChange={(value) => value && updateSetting('priorityLevel', value as any)}
                    >
                        <Select.Trigger class="w-full" disabled={isLoading}>
                            <Select.Value placeholder="Select priority level" />
                        </Select.Trigger>
                        <Select.Content>
                            {#each priorityLevels as level}
                                <Select.Item value={level.value}
                                    >{level.label}</Select.Item
                                >
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>
            </div>
        </div>

        <Separator />

        <!-- Email Notifications -->
        <div class="space-y-4">
            <div class="flex items-center gap-2">
                <Mail class="h-5 w-5" />
                <h3 class="text-lg font-medium">Email Notifications</h3>
            </div>

            <div class="space-y-4">
                <div class="flex items-center justify-between">
                    <div class="space-y-0.5">
                        <Label>Email Notifications</Label>
                        <p class="text-sm text-muted-foreground">
                            Receive notifications via email
                        </p>
                    </div>
                    <Switch
                        checked={settings.emailEnabled}
                        onCheckedChange={(checked) => updateSetting('emailEnabled', checked)}
                        disabled={isLoading}
                    />
                </div>

                {#if settings.emailEnabled}
                    <div class="space-y-2">
                        <Label>Email Digest Frequency</Label>
                        <Select.Root 
                            value={settings.emailDigestFrequency}
                            onValueChange={(value) => value && updateSetting('emailDigestFrequency', value as any)}
                        >
                            <Select.Trigger class="w-full" disabled={isLoading}>
                                <Select.Value
                                    placeholder="Select digest frequency"
                                />
                            </Select.Trigger>
                            <Select.Content>
                                {#each digestFrequencies as frequency}
                                    <Select.Item value={frequency.value}
                                        >{frequency.label}</Select.Item
                                    >
                                {/each}
                            </Select.Content>
                        </Select.Root>
                    </div>
                {/if}
            </div>
        </div>

        <Separator />

        <!-- Notification Types -->
        <div class="space-y-4">
            <div class="flex items-center gap-2">
                <LayoutDashboard class="h-5 w-5" />
                <h3 class="text-lg font-medium">Notification Types</h3>
            </div>

            <div class="grid gap-4">
                {#each notificationTypes as type}
                    <Card class="p-4">
                        <div class="flex items-center justify-between">
                            <div class="space-y-0.5">
                                <Label>{type.label}</Label>
                                <p class="text-sm text-muted-foreground">
                                    {type.description}
                                </p>
                            </div>
                            <Switch
                                checked={settings.typesEnabled.includes(
                                    type.value,
                                )}
                                onCheckedChange={() =>
                                    toggleNotificationType(type.value)}
                                disabled={isLoading}
                            />
                        </div>
                    </Card>
                {/each}
            </div>
        </div>

        <Separator />

        <!-- Quiet Hours -->
        <div class="space-y-4">
            <div class="flex items-center gap-2">
                <Clock class="h-5 w-5" />
                <h3 class="text-lg font-medium">Quiet Hours</h3>
            </div>

            <div class="space-y-4">
                <p class="text-sm text-muted-foreground">
                    Set a time range when notifications will be muted (except
                    for urgent notifications)
                </p>

                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <Label for="quiet-hours-start">Start Time</Label>
                        <Input
                            id="quiet-hours-start"
                            type="time"
                            value={settings.quietHoursStart}
                            on:input={(e) => updateSetting('quietHoursStart', e.currentTarget.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div class="space-y-2">
                        <Label for="quiet-hours-end">End Time</Label>
                        <Input
                            id="quiet-hours-end"
                            type="time"
                            value={settings.quietHoursEnd}
                            on:input={(e) => updateSetting('quietHoursEnd', e.currentTarget.value)}
                            disabled={isLoading}
                        />
                    </div>
                </div>
            </div>
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

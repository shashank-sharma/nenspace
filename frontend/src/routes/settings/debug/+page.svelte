<!-- src/routes/settings/debug/+page.svelte -->
<script lang="ts">
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import { Switch } from "$lib/components/ui/switch";
    import { Button } from "$lib/components/ui/button";
    import { Label } from "$lib/components/ui/label";
    import { RotateCcw } from "lucide-svelte";
    import type { DebugSettings } from "$lib/types/settings.types";

    // Use settings service for reactive state
    let settings = $derived(SettingsService.debug);
    let loadingState = $derived(SettingsService.loadingStates.debug);
    let isLoading = $derived(loadingState.loading);
    let hasError = $derived(loadingState.error !== null);
    
    // Update settings with auto-sync
    async function updateSetting<K extends keyof DebugSettings>(
        key: K, 
        value: DebugSettings[K]
    ) {
        await SettingsService.updateSettings('debug', { [key]: value });
    }

    // Reset settings to defaults
    async function resetSettings() {
        await SettingsService.resetCategory('debug');
    }
</script>

<div class="space-y-8">
    <div>
        <h3 class="text-lg font-medium mb-1">Debug Settings</h3>
        <p class="text-sm text-muted-foreground">
            Developer tools and debugging options
        </p>
    </div>

    <!-- General Debug Settings -->
    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <div class="space-y-0.5">
                <Label>Show Debug Button</Label>
                <p class="text-sm text-muted-foreground">
                    Show the debug launcher in the bottom-right corner
                </p>
            </div>
            <Switch 
                checked={settings.showDebugButton} 
                onCheckedChange={(checked) => updateSetting('showDebugButton', checked)}
                disabled={isLoading}
            />
        </div>

        <div class="flex items-center justify-between">
            <div class="space-y-0.5">
                <Label>Console Logging</Label>
                <p class="text-sm text-muted-foreground">
                    Enable detailed console logging for debugging
                </p>
            </div>
            <Switch 
                checked={settings.enableConsoleLogging} 
                onCheckedChange={(checked) => updateSetting('enableConsoleLogging', checked)}
                disabled={isLoading}
            />
        </div>

        <div class="flex items-center justify-between">
            <div class="space-y-0.5">
                <Label>Performance Monitoring</Label>
                <p class="text-sm text-muted-foreground">
                    Track and log component render times
                </p>
            </div>
            <Switch 
                checked={settings.enablePerformanceMonitoring} 
                onCheckedChange={(checked) => updateSetting('enablePerformanceMonitoring', checked)}
                disabled={isLoading}
            />
        </div>

        <div class="flex items-center justify-between">
            <div class="space-y-0.5">
                <Label>Network Logging</Label>
                <p class="text-sm text-muted-foreground">
                    Log all API requests and responses
                </p>
            </div>
            <Switch 
                checked={settings.enableNetworkLogging} 
                onCheckedChange={(checked) => updateSetting('enableNetworkLogging', checked)}
                disabled={isLoading}
            />
        </div>

        <div class="flex items-center justify-between">
            <div class="space-y-0.5">
                <Label>State Logging</Label>
                <p class="text-sm text-muted-foreground">
                    Log all state changes and updates
                </p>
            </div>
            <Switch 
                checked={settings.enableStateLogging} 
                onCheckedChange={(checked) => updateSetting('enableStateLogging', checked)}
                disabled={isLoading}
            />
        </div>

        <div class="flex items-center justify-between">
            <div class="space-y-0.5">
                <Label>Grid Overlay</Label>
                <p class="text-sm text-muted-foreground">
                    Show a visual grid overlay for layout debugging
                </p>
            </div>
            <Switch 
                checked={settings.showGridOverlay} 
                onCheckedChange={(checked) => updateSetting('showGridOverlay', checked)}
                disabled={isLoading}
            />
        </div>

        <div class="flex items-center justify-between">
            <div class="space-y-0.5">
                <Label>Component Boundaries</Label>
                <p class="text-sm text-muted-foreground">
                    Highlight component boundaries for debugging
                </p>
            </div>
            <Switch 
                checked={settings.showComponentBoundaries} 
                onCheckedChange={(checked) => updateSetting('showComponentBoundaries', checked)}
                disabled={isLoading}
            />
        </div>

        <div class="flex items-center justify-between">
            <div class="space-y-0.5">
                <Label>Accessibility Checks</Label>
                <p class="text-sm text-muted-foreground">
                    Enable real-time accessibility validation
                </p>
            </div>
            <Switch 
                checked={settings.enableAccessibilityChecks} 
                onCheckedChange={(checked) => updateSetting('enableAccessibilityChecks', checked)}
                disabled={isLoading}
            />
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


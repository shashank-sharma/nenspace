<!-- src/routes/settings/appearance/+page.svelte -->
<script lang="ts">
    import { ThemeService } from "$lib/services/theme.service.svelte";
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import { FontService } from "$lib/services/font.service.svelte";
    import { fonts } from "$lib/config/fonts.config";
    import { Button } from "$lib/components/ui/button";
    import { Label } from "$lib/components/ui/label";
    import * as RadioGroup from "$lib/components/ui/radio-group";
    import * as Select from "$lib/components/ui/select";
    import { Switch } from "$lib/components/ui/switch";
    import { toast } from "svelte-sonner";
    import { Sun, Moon, Monitor, Layout, Type, Palette, RotateCcw, Check, Grid3x3, Circle } from "lucide-svelte";
    import type { AppearanceSettings } from "$lib/types/settings.types";
    import BackgroundPattern from "$lib/components/BackgroundPattern.svelte";

    // Use settings service for reactive state
    let settings = $derived(SettingsService.appearance);
    let loadingState = $derived(SettingsService.loadingStates.appearance);
    
    // The theme is synchronized between ThemeService and SettingsService
    let currentTheme = $derived(ThemeService.theme);
    
    // Font preview state
    let previewFontId = $state<string | null>(null);
    let selectedFontId = $derived(settings.fontFamily);
    
    // Update settings with auto-sync
    async function updateSetting<K extends keyof typeof settings>(
        key: K, 
        value: typeof settings[K]
    ) {
        await SettingsService.updateSettings('appearance', { [key]: value });
    }
    
    // Preview font on click (temporary)
    async function previewFont(fontId: string) {
        previewFontId = fontId;
        await FontService.applyFont(fontId);
    }
    
    // Save font selection
    async function saveFontSelection() {
        if (previewFontId) {
            await updateSetting('fontFamily', previewFontId);
            previewFontId = null;
            toast.success('Font saved successfully');
        }
    }
    
    // Cancel preview and revert to saved font
    async function cancelPreview() {
        if (previewFontId) {
            previewFontId = null;
            await FontService.applyFont(settings.fontFamily);
        }
    }
    
    // Handle theme changes - update both services
    async function handleThemeChange(theme: 'light' | 'dark' | 'system') {
        ThemeService.setTheme(theme);
        await SettingsService.updateSettings('appearance', { theme });
    }

    const fontSizes = [
        { value: "small", label: "Small" },
        { value: "normal", label: "Normal" },
        { value: "large", label: "Large" },
        { value: "xl", label: "Extra Large" },
    ];

    const spacingOptions = [
        { value: "compact", label: "Compact" },
        { value: "comfortable", label: "Comfortable" },
        { value: "relaxed", label: "Relaxed" },
    ];

    const accentColors = [
        { value: "blue", label: "Blue" },
        { value: "green", label: "Green" },
        { value: "purple", label: "Purple" },
        { value: "orange", label: "Orange" },
        { value: "pink", label: "Pink" },
    ];

    const borderRadiusOptions = [
        { value: "none", label: "None" },
        { value: "small", label: "Small" },
        { value: "default", label: "Default" },
        { value: "large", label: "Large" },
    ];

    const backgroundTypeOptions = [
        { value: "none", label: "None", icon: null },
        { value: "grid", label: "Grid", icon: Grid3x3 },
        { value: "dot", label: "Dot", icon: Circle },
    ];

    // Reset settings to defaults
    async function resetSettings() {
        await SettingsService.resetCategory('appearance');
    }
    
    // Loading indicator for the entire form
    let isLoading = $derived(loadingState.loading);
    let hasError = $derived(loadingState.error !== null);
</script>

<div class="space-y-8">
    <!-- Theme Settings -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Palette class="h-5 w-5" />
            <h3 class="text-lg font-medium">Theme</h3>
        </div>

        <RadioGroup.Root
            value={currentTheme}
            onValueChange={(v: string | null) => {
                if (v) handleThemeChange(v as "light" | "dark" | "system");
            }}
            class="grid grid-cols-3 gap-2"
            disabled={isLoading}
        >
            <div>
                <RadioGroup.Item
                    value="light"
                    class="sr-only"
                    aria-label="Light"
                >
                    <div
                        class="items-center rounded-md border-2 border-muted p-1 hover:border-accent cursor-pointer"
                        class:border-primary={currentTheme === "light"}
                    >
                        <div class="space-y-2 rounded-sm bg-[#ecedef] p-2">
                            <div
                                class="space-y-2 rounded-md bg-white p-2 shadow-sm"
                            >
                                <div
                                    class="h-2 w-[80px] rounded-lg bg-[#ecedef]"
                                ></div>
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-[#ecedef]"
                                ></div>
                            </div>
                            <div
                                class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm"
                            >
                                <div
                                    class="h-4 w-4 rounded-full bg-[#ecedef]"
                                ></div>
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-[#ecedef]"
                                ></div>
                            </div>
                            <div
                                class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm"
                            >
                                <div
                                    class="h-4 w-4 rounded-full bg-[#ecedef]"
                                ></div>
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-[#ecedef]"
                                ></div>
                            </div>
                        </div>
                        <span class="block w-full p-2 text-center font-normal"
                            >Light</span
                        >
                    </div>
                </RadioGroup.Item>
            </div>
            <div>
                <RadioGroup.Item value="dark" class="sr-only" aria-label="Dark">
                    <div
                        class="items-center rounded-md border-2 border-muted bg-popover p-1 hover:border-accent cursor-pointer"
                        class:border-primary={currentTheme === "dark"}
                    >
                        <div class="space-y-2 rounded-sm bg-slate-950 p-2">
                            <div
                                class="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm"
                            >
                                <div
                                    class="h-2 w-[80px] rounded-lg bg-slate-400"
                                ></div>
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-slate-400"
                                ></div>
                            </div>
                            <div
                                class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm"
                            >
                                <div
                                    class="h-4 w-4 rounded-full bg-slate-400"
                                ></div>
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-slate-400"
                                ></div>
                            </div>
                            <div
                                class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm"
                            >
                                <div
                                    class="h-4 w-4 rounded-full bg-slate-400"
                                ></div>
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-slate-400"
                                ></div>
                            </div>
                        </div>
                        <span class="block w-full p-2 text-center font-normal"
                            >Dark</span
                        >
                    </div>
                </RadioGroup.Item>
            </div>
            <div>
                <RadioGroup.Item
                    value="system"
                    class="sr-only"
                    aria-label="System"
                >
                    <div
                        class="items-center rounded-md border-2 border-muted p-1 hover:border-accent cursor-pointer"
                        class:border-primary={currentTheme === "system"}
                    >
                        <div class="space-y-2 rounded-sm bg-[#ecedef] p-2">
                            <div
                                class="space-y-2 rounded-md bg-white p-2 shadow-sm"
                            >
                                <div
                                    class="h-2 w-[80px] rounded-lg bg-[#ecedef]"
                                ></div>
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-[#ecedef]"
                                ></div>
                            </div>
                            <div
                                class="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm"
                            >
                                <div
                                    class="h-2 w-[80px] rounded-lg bg-slate-400"
                                ></div>
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-slate-400"
                                ></div>
                            </div>
                        </div>
                        <span class="block w-full p-2 text-center font-normal"
                            >System</span
                        >
                    </div>
                </RadioGroup.Item>
            </div>
        </RadioGroup.Root>
    </div>

    <!-- Font Settings -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Type class="h-5 w-5" />
            <h3 class="text-lg font-medium">Typography</h3>
        </div>

        <div class="space-y-4">
            <!-- Font Family Selector -->
            <div class="space-y-3">
                <Label>Font Family</Label>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {#each fonts as font}
                        {@const isSelected = (previewFontId || selectedFontId) === font.id}
                        {@const isPreview = previewFontId === font.id && previewFontId !== selectedFontId}
                        <button
                            type="button"
                            class="relative p-4 rounded-lg border-2 transition-all hover:border-primary/50 cursor-pointer text-left {isSelected ? 'border-primary' : 'border-muted'} {isPreview ? 'ring-2 ring-primary/20' : ''}"
                            onclick={() => previewFont(font.id)}
                            disabled={isLoading}
                        >
                            {#if isSelected}
                                <div class="absolute top-2 right-2">
                                    <Check class="h-4 w-4 text-primary" />
                                </div>
                            {/if}
                            <div class="space-y-2">
                                <div class="font-medium" style="font-family: {font.family}, {font.fallback}">
                                    {font.name}
                                </div>
                                <div 
                                    class="text-sm text-muted-foreground"
                                    style="font-family: {font.family}, {font.fallback}"
                                >
                                    The quick brown fox jumps over the lazy dog
                                </div>
                                <div 
                                    class="text-xs text-muted-foreground"
                                    style="font-family: {font.family}, {font.fallback}"
                                >
                                    0123456789 !@#$%^&*
                                </div>
                            </div>
                        </button>
                    {/each}
                </div>
                
                {#if previewFontId && previewFontId !== selectedFontId}
                    <div class="flex items-center gap-2 pt-2">
                        <Button 
                            size="sm" 
                            onclick={saveFontSelection}
                            disabled={isLoading}
                        >
                            Save Font Selection
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline"
                            onclick={cancelPreview}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <span class="text-sm text-muted-foreground">
                            Previewing {fonts.find(f => f.id === previewFontId)?.name || previewFontId}
                        </span>
                    </div>
                {/if}
            </div>

            <!-- Font Size -->
            <div class="space-y-2">
                <Label>Font Size</Label>
                <Select.Root 
                    value={settings.fontSize}
                    onValueChange={(value: string | undefined) => value && updateSetting('fontSize', value as AppearanceSettings['fontSize'])}
                >
                    <Select.Trigger class="w-full" disabled={isLoading}>
                        <Select.Value placeholder="Select font size" />
                    </Select.Trigger>
                    <Select.Content>
                        {#each fontSizes as size}
                            <Select.Item value={size.value} label={size.label}
                                >{size.label}</Select.Item
                            >
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>
        </div>
    </div>

    <!-- Layout Settings -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Layout class="h-5 w-5" />
            <h3 class="text-lg font-medium">Layout</h3>
        </div>

        <div class="space-y-4">
            <div class="space-y-2">
                <Label>Spacing</Label>
                <Select.Root 
                    value={settings.spacing}
                    onValueChange={(value: string | undefined) => value && updateSetting('spacing', value as AppearanceSettings['spacing'])}
                >
                    <Select.Trigger class="w-full" disabled={isLoading}>
                        <Select.Value placeholder="Select spacing" />
                    </Select.Trigger>
                    <Select.Content>
                        {#each spacingOptions as option}
                            <Select.Item
                                value={option.value}
                                label={option.label}>{option.label}</Select.Item
                            >
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>

            <div class="space-y-2">
                <Label>Border Radius</Label>
                <Select.Root 
                    value={settings.borderRadius}
                    onValueChange={(value: string | undefined) => value && updateSetting('borderRadius', value as AppearanceSettings['borderRadius'])}
                >
                    <Select.Trigger class="w-full" disabled={isLoading}>
                        <Select.Value placeholder="Select border radius" />
                    </Select.Trigger>
                    <Select.Content>
                        {#each borderRadiusOptions as option}
                            <Select.Item
                                value={option.value}
                                label={option.label}>{option.label}</Select.Item
                            >
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>

            <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                    <Label>Animations</Label>
                    <p class="text-sm text-muted-foreground">
                        Enable or disable animations
                    </p>
                </div>
                <Switch 
                    checked={settings.animationsEnabled} 
                    onCheckedChange={(checked) => updateSetting('animationsEnabled', checked)}
                    disabled={isLoading}
                />
            </div>

            <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                    <Label>Collapsed Sidebar</Label>
                    <p class="text-sm text-muted-foreground">
                        Start with sidebar collapsed
                    </p>
                </div>
                <Switch 
                    checked={settings.sidebarCollapsed} 
                    onCheckedChange={(checked) => updateSetting('sidebarCollapsed', checked)}
                    disabled={isLoading}
                />
            </div>

            <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                    <Label>Status Indicator</Label>
                    <p class="text-sm text-muted-foreground">
                        Show status indicator at top of screen
                    </p>
                </div>
                <Switch 
                    checked={settings.showStatusIndicator} 
                    onCheckedChange={(checked) => updateSetting('showStatusIndicator', checked)}
                    disabled={isLoading}
                />
            </div>

            {#if settings.showStatusIndicator}
                <div class="space-y-3">
                    <Label>Status Indicator Expansion</Label>
                    <p class="text-sm text-muted-foreground">
                        How the status indicator expands when showing notifications
                    </p>
                    <RadioGroup.Root
                        value={settings.statusIndicatorExpansionMode}
                        onValueChange={(v: string | null) => {
                            if (v) updateSetting('statusIndicatorExpansionMode', v as 'edge' | 'center');
                        }}
                        class="grid grid-cols-2 gap-3"
                        disabled={isLoading}
                    >
                        <label
                            for="expansion-center"
                            class="relative rounded-lg border-2 p-4 cursor-pointer transition-all hover:border-accent {settings.statusIndicatorExpansionMode === 'center' ? 'border-primary' : 'border-muted'}"
                        >
                            <RadioGroup.Item
                                id="expansion-center"
                                value="center"
                                class="sr-only"
                                aria-label="Center expansion"
                            />
                            {#if settings.statusIndicatorExpansionMode === 'center'}
                                <div class="absolute top-2 right-2">
                                    <Check class="h-4 w-4 text-primary" />
                                </div>
                            {/if}
                            <div class="space-y-2">
                                <span class="font-medium">Center</span>
                                <p class="text-xs text-muted-foreground">
                                    Expands equally from both sides
                                </p>
                            </div>
                        </label>
                        <label
                            for="expansion-edge"
                            class="relative rounded-lg border-2 p-4 cursor-pointer transition-all hover:border-accent {settings.statusIndicatorExpansionMode === 'edge' ? 'border-primary' : 'border-muted'}"
                        >
                            <RadioGroup.Item
                                id="expansion-edge"
                                value="edge"
                                class="sr-only"
                                aria-label="Edge expansion"
                            />
                            {#if settings.statusIndicatorExpansionMode === 'edge'}
                                <div class="absolute top-2 right-2">
                                    <Check class="h-4 w-4 text-primary" />
                                </div>
                            {/if}
                            <div class="space-y-2">
                                <span class="font-medium">Edge</span>
                                <p class="text-xs text-muted-foreground">
                                    Expands from the right side
                                </p>
                            </div>
                        </label>
                    </RadioGroup.Root>
                </div>
            {/if}
        </div>
    </div>

    <!-- Background Pattern Settings -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Grid3x3 class="h-5 w-5" />
            <h3 class="text-lg font-medium">Background Pattern</h3>
        </div>

        <div class="space-y-4">
            <div class="space-y-3">
                <Label>Pattern Type</Label>
                <RadioGroup.Root
                    value={settings.backgroundType}
                    onValueChange={(v: string | null) => {
                        if (v) updateSetting('backgroundType', v as AppearanceSettings['backgroundType']);
                    }}
                    class="grid grid-cols-3 gap-3"
                    disabled={isLoading}
                >
                    {#each backgroundTypeOptions as option}
                        {@const Icon = option.icon}
                        {@const optionId = `bg-pattern-${option.value}`}
                        <label
                            for={optionId}
                            class="relative rounded-lg border-2 p-4 cursor-pointer transition-all hover:border-accent h-full block {settings.backgroundType === option.value ? 'border-primary' : 'border-muted'}"
                        >
                            <RadioGroup.Item
                                id={optionId}
                                value={option.value}
                                class="sr-only"
                                aria-label={option.label}
                            />
                            {#if settings.backgroundType === option.value}
                                <div class="absolute top-2 right-2">
                                    <Check class="h-4 w-4 text-primary" />
                                </div>
                            {/if}
                            
                            <div class="space-y-2">
                                {#if option.icon}
                                    <div class="flex items-center gap-2">
                                        <Icon class="h-4 w-4" />
                                        <span class="font-medium">{option.label}</span>
                                    </div>
                                {:else}
                                    <span class="font-medium">{option.label}</span>
                                {/if}
                                
                                <!-- Preview Box -->
                                <div class="relative h-24 w-full rounded border border-border overflow-hidden bg-background">
                                    <BackgroundPattern type={option.value as 'none' | 'grid' | 'dot'} />
                                </div>
                            </div>
                        </label>
                    {/each}
                </RadioGroup.Root>
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

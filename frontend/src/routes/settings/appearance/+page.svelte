<!-- src/routes/settings/appearance/+page.svelte -->
<script lang="ts">
    import { pb } from "$lib/config/pocketbase";
    import { Button } from "$lib/components/ui/button";
    import { Label } from "$lib/components/ui/label";
    import * as RadioGroup from "$lib/components/ui/radio-group";
    import * as Select from "$lib/components/ui/select";
    import { Switch } from "$lib/components/ui/switch";
    import { toast } from "svelte-sonner";
    import { Sun, Moon, Monitor, Layout, Type, Palette } from "lucide-svelte";
    import { getContext } from "svelte";

    // Get theme context that you set up in your layout
    const { theme, toggleTheme } = getContext("theme");

    let settings = {
        theme: $theme,
        fontSize: "normal",
        spacing: "comfortable",
        animationsEnabled: true,
        borderRadius: "default",
        accentColor: "blue",
        sidebarCollapsed: false,
    };

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

    async function saveSettings() {
        try {
            // Here you would typically save to PocketBase
            // await pb.collection('user_appearance_settings').update(id, settings);
            theme.set(settings.theme);
            toast.success("Appearance settings updated successfully");
        } catch (error) {
            toast.error("Failed to update appearance settings");
        }
    }

    function resetSettings() {
        settings = {
            theme: "light",
            fontSize: "normal",
            spacing: "comfortable",
            animationsEnabled: true,
            borderRadius: "default",
            accentColor: "blue",
            sidebarCollapsed: false,
        };
        toast.success("Settings reset to defaults");
    }
</script>

<div class="space-y-8">
    <!-- Theme Settings -->
    <div class="space-y-4">
        <div class="flex items-center gap-2">
            <Palette class="h-5 w-5" />
            <h3 class="text-lg font-medium">Theme</h3>
        </div>

        <RadioGroup.Root value={settings.theme} class="grid grid-cols-3 gap-2">
            <div>
                <RadioGroup.Item
                    value="light"
                    class="sr-only"
                    aria-label="Light"
                >
                    <div
                        class="items-center rounded-md border-2 border-muted p-1 hover:border-accent cursor-pointer"
                        class:border-primary={settings.theme === "light"}
                    >
                        <div class="space-y-2 rounded-sm bg-[#ecedef] p-2">
                            <div
                                class="space-y-2 rounded-md bg-white p-2 shadow-sm"
                            >
                                <div
                                    class="h-2 w-[80px] rounded-lg bg-[#ecedef]"
                                />
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-[#ecedef]"
                                />
                            </div>
                            <div
                                class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm"
                            >
                                <div
                                    class="h-4 w-4 rounded-full bg-[#ecedef]"
                                />
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-[#ecedef]"
                                />
                            </div>
                            <div
                                class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm"
                            >
                                <div
                                    class="h-4 w-4 rounded-full bg-[#ecedef]"
                                />
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-[#ecedef]"
                                />
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
                        class:border-primary={settings.theme === "dark"}
                    >
                        <div class="space-y-2 rounded-sm bg-slate-950 p-2">
                            <div
                                class="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm"
                            >
                                <div
                                    class="h-2 w-[80px] rounded-lg bg-slate-400"
                                />
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-slate-400"
                                />
                            </div>
                            <div
                                class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm"
                            >
                                <div
                                    class="h-4 w-4 rounded-full bg-slate-400"
                                />
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-slate-400"
                                />
                            </div>
                            <div
                                class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm"
                            >
                                <div
                                    class="h-4 w-4 rounded-full bg-slate-400"
                                />
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-slate-400"
                                />
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
                        class:border-primary={settings.theme === "system"}
                    >
                        <div class="space-y-2 rounded-sm bg-[#ecedef] p-2">
                            <div
                                class="space-y-2 rounded-md bg-white p-2 shadow-sm"
                            >
                                <div
                                    class="h-2 w-[80px] rounded-lg bg-[#ecedef]"
                                />
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-[#ecedef]"
                                />
                            </div>
                            <div
                                class="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm"
                            >
                                <div
                                    class="h-2 w-[80px] rounded-lg bg-slate-400"
                                />
                                <div
                                    class="h-2 w-[100px] rounded-lg bg-slate-400"
                                />
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
            <div class="space-y-2">
                <Label>Font Size</Label>
                <Select.Root bind:value={settings.fontSize}>
                    <Select.Trigger class="w-full">
                        <Select.Value placeholder="Select font size" />
                    </Select.Trigger>
                    <Select.Content>
                        {#each fontSizes as size}
                            <Select.Item value={size.value}
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
                <Select.Root bind:value={settings.spacing}>
                    <Select.Trigger class="w-full">
                        <Select.Value placeholder="Select spacing" />
                    </Select.Trigger>
                    <Select.Content>
                        {#each spacingOptions as option}
                            <Select.Item value={option.value}
                                >{option.label}</Select.Item
                            >
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>

            <div class="space-y-2">
                <Label>Border Radius</Label>
                <Select.Root bind:value={settings.borderRadius}>
                    <Select.Trigger class="w-full">
                        <Select.Value placeholder="Select border radius" />
                    </Select.Trigger>
                    <Select.Content>
                        {#each borderRadiusOptions as option}
                            <Select.Item value={option.value}
                                >{option.label}</Select.Item
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
                    on:change={() =>
                        (settings.animationsEnabled =
                            !settings.animationsEnabled)}
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
                    on:change={() =>
                        (settings.sidebarCollapsed =
                            !settings.sidebarCollapsed)}
                />
            </div>
        </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-between">
        <Button variant="outline" on:click={resetSettings}>
            Reset to Defaults
        </Button>
        <Button on:click={saveSettings}>Save Changes</Button>
    </div>
</div>

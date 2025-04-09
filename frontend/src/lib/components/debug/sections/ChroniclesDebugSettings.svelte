<script lang="ts">
    import { browser } from "$app/environment";
    import { writable } from "svelte/store";
    import { slide } from "svelte/transition";
    import { Switch } from "$lib/components/ui/switch";
    import { Button } from "$lib/components/ui/button";
    import { CloudSun, Settings } from "lucide-svelte";

    // Import chronicle store and weather types
    import { chroniclesStore } from "$lib/features/chronicles/stores/chronicles.store";

    // Define weather types - copied from ChronicleJournalFlow
    const weatherTypes = [
        { id: "sunny", label: "Sunny Day", icon: CloudSun },
        { id: "cloudy", label: "Cloudy Day", icon: CloudSun },
        { id: "rainy", label: "Rainy Day", icon: CloudSun },
        { id: "stormy", label: "Stormy Day", icon: CloudSun },
    ];

    // STEP 1: Define storage keys
    const STORAGE_KEY = "chroniclesDebugSettings";
    const DEBUG_ENABLED_KEY = "debugChroniclesEnabled";

    // STEP 2: Define settings interface
    interface ChroniclesDebugSettings {
        currentWeather: string;
        enableAnimations: boolean;
        reduceMotion: boolean;
        showJsonData: boolean;
    }

    // Default settings
    const defaultSettings: ChroniclesDebugSettings = {
        currentWeather: "sunny",
        enableAnimations: true,
        reduceMotion: false,
        showJsonData: false,
    };

    // STEP 3: Create stores
    const debugSettings = writable<ChroniclesDebugSettings>(
        browser
            ? JSON.parse(
                  localStorage.getItem(STORAGE_KEY) ||
                      JSON.stringify(defaultSettings),
              )
            : defaultSettings,
    );

    const isDebugEnabled = writable<boolean>(
        browser ? localStorage.getItem(DEBUG_ENABLED_KEY) === "true" : false,
    );

    // STEP 4: Set up localStorage persistence
    debugSettings.subscribe((value) => {
        if (browser) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(value));

            // Publish an event that ChronicleJournalFlow can listen to
            document.dispatchEvent(
                new CustomEvent("chronicles-debug-settings-changed", {
                    detail: value,
                }),
            );
        }
    });

    isDebugEnabled.subscribe((value) => {
        if (browser) {
            localStorage.setItem(DEBUG_ENABLED_KEY, value.toString());

            // Reset to defaults if debug is disabled
            if (!value) {
                debugSettings.set(defaultSettings);
            }
        }
    });

    // STEP 5: Helper functions
    function updateSetting<K extends keyof ChroniclesDebugSettings>(
        key: K,
        value: ChroniclesDebugSettings[K],
    ) {
        debugSettings.update((settings) => ({
            ...settings,
            [key]: value,
        }));
    }

    function setWeather(weatherId: string) {
        updateSetting("currentWeather", weatherId);
    }

    // Calculate today's events
    let todayEvents = [];

    // Update todayEvents when chroniclesStore changes
    chroniclesStore.subscribe((state) => {
        const today = new Date().toISOString().split("T")[0];
        todayEvents = (state.entries || []).filter(
            (entry) => entry.date && entry.date.startsWith(today),
        );
    });
</script>

<div class="space-y-4">
    <!-- Main toggle -->
    <div class="flex items-center justify-between">
        <label
            for="chronicles-debug-toggle"
            class="flex items-center text-sm gap-2"
        >
            <CloudSun size={16} class="text-amber-400" />
            <span>Enable Chronicles Debug Mode</span>
        </label>
        <Switch
            id="chronicles-debug-toggle"
            checked={$isDebugEnabled}
            onCheckedChange={(checked) => {
                $isDebugEnabled = checked;
            }}
        />
    </div>

    <!-- Settings UI -->
    {#if $isDebugEnabled}
        <div
            class="pt-2 border-t border-muted"
            transition:slide={{ duration: 150 }}
        >
            <!-- Weather Theme Controls Section -->
            <div class="mb-4">
                <div class="text-xs font-medium mb-2 flex items-center">
                    <span class="flex-1">Background Theme</span>
                    <span
                        class="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                        >Visual</span
                    >
                </div>
                <div class="grid grid-cols-4 gap-2">
                    {#each weatherTypes as type}
                        <button
                            class="p-1.5 rounded-md transition-all flex flex-col items-center {$debugSettings.currentWeather ===
                            type.id
                                ? 'bg-primary/20 border border-primary/50'
                                : 'bg-muted hover:bg-muted/80 border border-transparent'}"
                            on:click={() => setWeather(type.id)}
                            title={type.label}
                        >
                            <svelte:component
                                this={type.icon}
                                class="h-4 w-4 mb-1"
                            />
                            <span class="text-[10px]"
                                >{type.label.split(" ")[0]}</span
                            >
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Animation Controls -->
            <div class="mb-4">
                <div class="text-xs font-medium mb-2 flex items-center">
                    <span class="flex-1">Animation Settings</span>
                    <span
                        class="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                        >Performance</span
                    >
                </div>
                <div class="flex items-center justify-between mb-2">
                    <label class="text-xs">Enable Animations</label>
                    <Switch
                        checked={$debugSettings.enableAnimations}
                        onCheckedChange={(checked) =>
                            updateSetting("enableAnimations", checked)}
                    />
                </div>
                <div class="flex items-center justify-between">
                    <label class="text-xs">Reduce Motion</label>
                    <Switch
                        checked={$debugSettings.reduceMotion}
                        onCheckedChange={(checked) =>
                            updateSetting("reduceMotion", checked)}
                    />
                </div>
            </div>

            <!-- JSON Data Debug Toggle -->
            <div class="mb-4">
                <div class="text-xs font-medium mb-2 flex items-center">
                    <span class="flex-1">Data Visibility</span>
                    <span
                        class="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                        >Debug</span
                    >
                </div>
                <div class="flex items-center justify-between">
                    <label class="text-xs">Show JSON Data</label>
                    <Switch
                        checked={$debugSettings.showJsonData}
                        onCheckedChange={(checked) =>
                            updateSetting("showJsonData", checked)}
                    />
                </div>
            </div>

            <!-- Chronicle Data Debug -->
            <div>
                <div class="text-xs font-medium mb-2 flex items-center">
                    <span class="flex-1">Chronicle Data</span>
                    <span
                        class="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                        >Debug</span
                    >
                </div>
                <div class="text-xs space-y-1">
                    <div
                        class="flex justify-between items-center bg-muted/50 p-1 rounded"
                    >
                        <span>Current Step:</span>
                        <span class="font-mono"
                            >{$chroniclesStore.currentStep}/5</span
                        >
                    </div>
                    <div
                        class="flex justify-between items-center bg-muted/50 p-1 rounded"
                    >
                        <span>Events Today:</span>
                        <span class="font-mono">{todayEvents.length}</span>
                    </div>
                    <div
                        class="flex justify-between items-center bg-muted/50 p-1 rounded"
                    >
                        <span>Selected Mood:</span>
                        <span class="font-mono"
                            >{$chroniclesStore.currentEntry?.mood ||
                                "none"}</span
                        >
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>

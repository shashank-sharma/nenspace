<script lang="ts">
    import { browser } from "$app/environment";
    import { writable } from "svelte/store";
    import { slide } from "svelte/transition";
    import { Switch } from "$lib/components/ui/switch";
    import { Button } from "$lib/components/ui/button";
    import { Settings, AlertCircle } from "lucide-svelte";

    // STEP 1: Define your storage keys with a meaningful prefix
    // to avoid conflicts with other debug settings
    const STORAGE_KEY = "templatePageDebugSettings";
    const DEBUG_ENABLED_KEY = "debugTemplatePageEnabled";

    // STEP 2: Define your settings with their default values
    interface TemplateSettings {
        // Add your settings properties here
        exampleSetting1: boolean;
        exampleSetting2: boolean;
        exampleSetting3: string;
    }

    // Default settings
    const defaultSettings: TemplateSettings = {
        exampleSetting1: true,
        exampleSetting2: false,
        exampleSetting3: "default",
    };

    // STEP 3: Create writable stores for your settings and enabled state
    const debugSettings = writable<TemplateSettings>(
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

    // STEP 4: Set up persistence to localStorage
    debugSettings.subscribe((value) => {
        if (browser) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(value));

            // You can also publish changes to other components here
            // For example, via a custom event or a shared store
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

    // STEP 5: Helper function to update a specific setting
    function updateSetting<K extends keyof TemplateSettings>(
        key: K,
        value: TemplateSettings[K],
    ) {
        debugSettings.update((settings) => ({
            ...settings,
            [key]: value,
        }));
    }
</script>

<!-- STEP 6: Create your UI -->
<div class="space-y-4">
    <!-- Main toggle -->
    <div class="flex items-center justify-between">
        <label
            for="template-debug-toggle"
            class="flex items-center text-sm gap-2"
        >
            <Settings size={16} class="text-purple-400" />
            <span>Enable Template Debug Settings</span>
        </label>
        <Switch
            id="template-debug-toggle"
            checked={$isDebugEnabled}
            onCheckedChange={(checked) => {
                $isDebugEnabled = checked;
            }}
        />
    </div>

    <!-- Settings UI - shown only when debug is enabled -->
    {#if $isDebugEnabled}
        <div
            class="pt-2 border-t border-muted"
            transition:slide={{ duration: 150 }}
        >
            <div class="mb-2 text-sm text-muted-foreground">
                Template Settings
            </div>

            <div class="space-y-3">
                <!-- Example toggle setting -->
                <div class="flex items-center justify-between">
                    <label for="example-setting1-toggle" class="text-sm">
                        Example Setting 1
                    </label>
                    <Switch
                        id="example-setting1-toggle"
                        checked={$debugSettings.exampleSetting1}
                        onCheckedChange={(checked) => {
                            updateSetting("exampleSetting1", checked);
                        }}
                    />
                </div>

                <!-- Example toggle setting 2 -->
                <div class="flex items-center justify-between">
                    <label for="example-setting2-toggle" class="text-sm">
                        Example Setting 2
                    </label>
                    <Switch
                        id="example-setting2-toggle"
                        checked={$debugSettings.exampleSetting2}
                        onCheckedChange={(checked) => {
                            updateSetting("exampleSetting2", checked);
                        }}
                    />
                </div>

                <!-- Add more settings UI controls as needed -->
            </div>

            <!-- Optional: Add information about how to use these settings -->
            <div
                class="mt-4 text-xs bg-muted/50 p-2 rounded-md flex gap-2 items-start"
            >
                <AlertCircle
                    size={14}
                    class="text-blue-400 mt-0.5 flex-shrink-0"
                />
                <p>
                    This is a template component. Replace this text with
                    information about how these debug settings affect the page.
                </p>
            </div>
        </div>
    {/if}
</div>

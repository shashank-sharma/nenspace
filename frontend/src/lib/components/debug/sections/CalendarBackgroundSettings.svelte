<script lang="ts">
    import { browser } from "$app/environment";
    import { writable } from "svelte/store";
    import { slide } from "svelte/transition";
    import { Switch } from "$lib/components/ui/switch";
    import { Button } from "$lib/components/ui/button";
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from "$lib/components/ui/select";
    import { Calendar, CheckCircle2 } from "lucide-svelte";

    // Create store for calendar background theme
    const STORAGE_KEY = "calendarBackgroundTheme";
    const calendarBgTheme = writable<string>(
        browser ? localStorage.getItem(STORAGE_KEY) || "default" : "default",
    );

    // Theme options
    const themes = [
        { id: "default", name: "Default" },
        { id: "minimal", name: "Minimal" },
        { id: "gradient", name: "Gradient" },
        { id: "dark", name: "Dark Contrast" },
    ];

    // Helper to determine if a theme is active
    let activeTheme = $calendarBgTheme;

    // Debug flag to enable/disable these settings
    const DEBUG_ENABLED_KEY = "debugCalendarBgEnabled";
    const isDebugEnabled = writable<boolean>(
        browser ? localStorage.getItem(DEBUG_ENABLED_KEY) === "true" : false,
    );

    // Save theme to localStorage when it changes
    calendarBgTheme.subscribe((value) => {
        if (browser) {
            localStorage.setItem(STORAGE_KEY, value);
            activeTheme = value;

            // Add a data attribute to the body or html for theme application
            document.documentElement.setAttribute("data-calendar-theme", value);
        }
    });

    // Save debug enabled state to localStorage
    isDebugEnabled.subscribe((value) => {
        if (browser) {
            localStorage.setItem(DEBUG_ENABLED_KEY, value.toString());

            // If debug is disabled, reset to default theme
            if (!value) {
                calendarBgTheme.set("default");
            }
        }
    });

    // Handle theme change
    function setTheme(themeId: string) {
        calendarBgTheme.set(themeId);
    }
</script>

<div class="space-y-4">
    <div class="flex items-center justify-between">
        <label
            for="calendar-debug-toggle"
            class="flex items-center text-sm gap-2"
        >
            <Calendar size={16} class="text-blue-400" />
            <span>Enable Calendar Theme Debug</span>
        </label>
        <Switch
            id="calendar-debug-toggle"
            checked={$isDebugEnabled}
            onCheckedChange={(checked) => {
                $isDebugEnabled = checked;
            }}
        />
    </div>

    {#if $isDebugEnabled}
        <div
            class="pt-2 border-t border-muted"
            transition:slide={{ duration: 150 }}
        >
            <div class="mb-2 text-sm text-muted-foreground">
                Background Theme
            </div>

            <div class="grid gap-2">
                {#each themes as theme}
                    <Button
                        variant={activeTheme === theme.id
                            ? "default"
                            : "outline"}
                        size="sm"
                        class="justify-start"
                        on:click={() => setTheme(theme.id)}
                    >
                        <span class="flex items-center gap-2">
                            {#if activeTheme === theme.id}
                                <CheckCircle2
                                    size={14}
                                    class="text-primary-foreground"
                                />
                            {/if}
                            {theme.name}
                        </span>
                    </Button>
                {/each}
            </div>
        </div>
    {/if}
</div>

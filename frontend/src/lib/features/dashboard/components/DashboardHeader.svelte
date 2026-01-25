<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Search, Bell, Settings, Sun, Moon, Keyboard, Bug, X } from "lucide-svelte";
    import CommandPalette from "$lib/components/CommandPalette.svelte";
    import NotificationCenter from "$lib/features/notifications/components/NotificationCenter.svelte";
    import GlobalSyncIndicator from "$lib/components/GlobalSyncIndicator.svelte";
    import { ThemeService } from "$lib/services/theme.service.svelte";
    import DebugPanel from "$lib/components/debug/DebugPanel.svelte";
    import { DebugService } from "$lib/services/debug.service.svelte";
    import { HealthService } from "$lib/services/health.service.svelte";
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import * as Tooltip from "$lib/components/ui/tooltip";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher<{
        "show-shortcuts": void;
    }>();

    // Access theme via ThemeService
    let debugSettings = $derived(SettingsService.debug);
    let shouldShowDebugButton = $derived(debugSettings.showDebugButton);

    function handleShortcutsClick() {
        dispatch("show-shortcuts");
    }

    let debugButtonClass = $derived.by(() => {
        const base = "debug-toggle";
        const active = DebugService.isEnabled ? "active" : "";
        const border = HealthService.status.connected === true
            ? "border-green-500"
            : HealthService.status.connected === null
                ? "border-yellow-500"
                : "border-red-500";
        return `${base} ${active} ${border}`.trim();
    });

    // let showCommandPalette = true;
</script>

<Tooltip.Provider>
    <header class="border-b bg-card">
        <div class="flex h-16 items-center px-4 gap-4">
            <div class="flex-1">
                <!-- <form class="max-w-sm">
                    <div class="relative">
                        <Search
                            class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                        />
                        <Input
                            type="search"
                            placeholder="Search..."
                            class="pl-8"
                            on:focus={() => (showCommandPalette = true)}
                        />
                    </div>
                </form> -->
            </div>

            <div class="flex items-center gap-2">
                <!-- <Button variant="ghost" size="icon" on:click={toggleTheme}>
                    <svelte:component
                        this={$theme === "dark" ? Sun : Moon}
                        class="h-5 w-5"
                    />
                    <span class="sr-only">Toggle theme</span>
                </Button> -->

                <GlobalSyncIndicator />
                <NotificationCenter />
                
                <!-- Keyboard shortcuts button -->
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        <Button
                            variant="ghost"
                            size="icon"
                            on:click={handleShortcutsClick}
                            aria-label="Show keyboard shortcuts"
                        >
                            <Keyboard class="h-5 w-5" />
                        </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                        <p>Keyboard Shortcuts</p>
                    </Tooltip.Content>
                </Tooltip.Root>

                <!-- Debug button -->
                {#if shouldShowDebugButton}
                    <Tooltip.Root>
                        <Tooltip.Trigger>
                            <Button
                                variant="ghost"
                                size="icon"
                                class={debugButtonClass}
                                on:click={DebugService.toggle}
                                title="Toggle Debug Panel"
                            >
                                {#if DebugService.isEnabled}
                                    <X class="h-5 w-5" />
                                {:else}
                                    <Bug class="h-5 w-5" />
                                {/if}
                            </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                            <p>Toggle Debug Panel</p>
                        </Tooltip.Content>
                    </Tooltip.Root>
                {/if}
            </div>
        </div>

        <CommandPalette />
        
        <!-- Debug panel (rendered outside header for positioning) -->
        {#if shouldShowDebugButton && DebugService.isEnabled}
            <DebugPanel
                enabled={DebugService.isEnabled}
                on:close={DebugService.toggle}
            />
        {/if}
    </header>
</Tooltip.Provider>

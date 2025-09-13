<script lang="ts">
    import { onMount, setContext } from "svelte";
    import { navigating } from "$app/stores";
    import { Toaster } from "$lib/components/ui/sonner";
    import { fade } from "svelte/transition";
    import Loading from "$lib/components/Loading.svelte";
    import { theme } from "$lib/stores/theme.store";
    import "../app.css";
    import ThemeInitializer from "$lib/components/ThemeInitializer.svelte";
    import { initPwa } from "$lib/features/pwa/services";
    import { Button } from "$lib/components/ui/button";
    import { RefreshCw } from "lucide-svelte";
    import { browser } from "$app/environment";
    import UpdateDetector from "$lib/features/pwa/components/UpdateDetector.svelte";
    import OfflineIndicator from "$lib/features/pwa/components/OfflineIndicator.svelte";
    import { toast } from "svelte-sonner";
    import BottomRightControls from "$lib/components/BottomRightControls.svelte";
    import ShortcutsHelpPanel from "$lib/components/ShortcutsHelpPanel.svelte";
    import DebugLauncher from "$lib/components/debug/DebugLauncher.svelte";
    let isLoading = true;
    let isDebugMode = false;
    let showShortcuts = false;

    setContext("theme", {
        current: theme,
    });

    // PWA initialization
    let pwaInitFinished = false;
    let pwaUpdateAvailable = false;

    onMount(async () => {
        if (browser) {
            // Initialize PWA service
            console.log("PWA Debug Mode:", isDebugMode);

            try {
                await initPwa();
                console.log("Service Worker registered");
                pwaInitFinished = true;
            } catch (err) {
                console.error("Failed to initialize PWA:", err);
            }

            // Data will be initialized only when needed in specific routes
        }

        // Page fully loaded
        setTimeout(() => {
            isLoading = false;
        }, 300);
    });

    function handlePwaUpdateAvailable() {
        pwaUpdateAvailable = true;
    }

    function reload() {
        if (browser) {
            window.location.reload();
        }
    }

    function handleShowShortcuts() {
        showShortcuts = true;
    }

    function handleCloseShortcuts() {
        showShortcuts = false;
    }
</script>

<ThemeInitializer />

{#if browser && pwaInitFinished}
    <UpdateDetector on:update-available={handlePwaUpdateAvailable} />
{/if}

<!-- Offline indicator -->
<OfflineIndicator />

<!-- PWA update notification -->
{#if pwaUpdateAvailable}
    <div
        transition:fade={{ duration: 200 }}
        class="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full bg-card border rounded-lg shadow-lg p-4 flex items-center justify-between"
    >
        <span>A new version is available!</span>
        <Button variant="outline" size="sm" on:click={reload}>
            <RefreshCw class="mr-2 h-4 w-4" />
            Update Now
        </Button>
    </div>
{/if}

{#if $navigating}
    <div
        class="fixed inset-0 bg-background/30 backdrop-blur-sm flex items-center justify-center z-50"
    >
        <Loading />
    </div>
{/if}

{#if isLoading}
    <div
        class="fixed inset-0 bg-background flex items-center justify-center z-50"
        transition:fade={{ duration: 300 }}
    >
        <Loading />
    </div>
{/if}

<Toaster />

<!-- Bottom right controls -->
<BottomRightControls on:show-shortcuts={handleShowShortcuts} />
<div class="fixed bottom-4 right-4 z-50">
    <DebugLauncher />
</div>
<ShortcutsHelpPanel visible={showShortcuts} on:close={handleCloseShortcuts} />

<main class="">
    <slot />
</main>

<style>
    @font-face {
        font-family: "Gilroy";
        src: url("/fonts/Gilroy.woff2");
    }

    :global(html) {
        height: 100%;
        margin: 0;
        padding: 0;
        font-family: Gilroy, serif;
    }
    .app-container {
        min-height: 100vh;
        background-color: hsl(var(--background));
        color: hsl(var(--foreground));
    }

    :global(body) {
        height: 100%;
        min-height: 100%;
        overflow-x: hidden;
    }

    main {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 100vh;
    }
</style>

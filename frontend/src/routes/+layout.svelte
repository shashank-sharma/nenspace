<script lang="ts">
    import type { Snippet } from "svelte";
    import { onMount } from "svelte";
    import { navigating, page } from "$app/stores";
    import { fade } from "svelte/transition";
    import { onNavigate } from "$app/navigation";
    import Loading from "$lib/components/Loading.svelte";
    import PageTransition from "$lib/components/PageTransition.svelte";
    import { ThemeService } from "$lib/services/theme.service.svelte";
    import { FontService } from "$lib/services/font.service.svelte";
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import { NotificationSyncService } from "$lib/features/status-indicator";
    import "../app.css";
    import { browser } from "$app/environment";
    import { usePlatform } from "$lib/hooks/usePlatform.svelte";
    import LimitedFunctionalityBanner from "$lib/components/platform/LimitedFunctionalityBanner.svelte";

    // PWA-only imports (dynamically loaded - excluded from Tauri builds)
    // These are imported at runtime ONLY in PWA/Web mode
    import { Button } from "$lib/components/ui/button";
    import { RefreshCw } from "lucide-svelte";

    // NOTE: RealtimeService and Sync Adapters moved to dashboard/+layout.svelte
    // They only load when authenticated and viewing dashboard, not on homepage/auth pages

    let { children } = $props<{ children: Snippet }>();
    let isLoading = $state(true);
    let showShortcuts = $state(false);

    // Platform detection
    const platform = usePlatform();

    // PWA-specific state (only used in PWA/Web, not Tauri)
    let pwaInitFinished = $state(false);
    let pwaUpdateAvailable = $state(false);

    // Dynamically loaded PWA components (null until loaded)
    let UpdateDetector: any = $state(null);
    let OfflineIndicator: any = $state(null);

    // Check if current route is dashboard to determine transition type
    let isDashboardRoute = $derived($page.url.pathname.startsWith("/dashboard"));

    // Handle navigation for transitions
    onNavigate((navigation) => {
        // Navigation state is handled by PageTransition component
        if (navigation?.to) {
            // Navigation will be handled by the transition system
        }
    });

    // One-time initialization on mount
    onMount(() => {
        // Initialize notification sync for Tauri (works across all routes)
        NotificationSyncService.initialize().catch((err) => {
            console.error('[RootLayout] Failed to initialize notification sync:', err);
        });
        if (browser) {
            // Initialize font service with default font
            // Font will be updated when settings load
            FontService.initialize();
            // Log platform info for debugging
            console.log(`[App] Platform: ${platform.summary}`);
            console.log(
                `[App] Tauri: ${platform.isTauri}, PWA: ${platform.isPWA}, Mobile: ${platform.isMobile}`,
            );

            // PWA initialization (ONLY in PWA/Web, NOT in Tauri)
            // Dynamic imports ensure PWA code is completely excluded from Tauri builds
            if (!platform.isTauri) {
                // Dynamically import PWA modules (tree-shaken out of Tauri builds)
                Promise.all([
                    import("$lib/features/pwa/services/pwa.service.svelte"),
                    import(
                        "$lib/features/pwa/components/UpdateDetector.svelte"
                    ),
                    import(
                        "$lib/features/pwa/components/OfflineIndicator.svelte"
                    ),
                ])
                    .then(
                        ([pwaModule, updateDetectorModule, offlineModule]) => {
                            // PwaService auto-initializes on import
                            UpdateDetector = updateDetectorModule.default;
                            OfflineIndicator = offlineModule.default;
                            pwaInitFinished = true;
                        },
                    )
                    .catch((err) => {
                        console.error("[App] Failed to load PWA modules:", err);
                    });
            }

            // NOTE: RealtimeService initialization moved to dashboard/+layout.svelte
            // It only initializes when user is authenticated and viewing dashboard

            setTimeout(() => {
                isLoading = false;
            }, 300);
        }
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

<!-- PWA-ONLY Components (dynamically loaded - zero bundle impact on Tauri) -->
{#if !platform.isTauri && pwaInitFinished}
    {#if UpdateDetector}
        <UpdateDetector on:update-available={handlePwaUpdateAvailable} />
    {/if}

    <!-- Offline indicator (bottom banner) -->
    {#if OfflineIndicator}
        <OfflineIndicator />
    {/if}

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

<!-- Platform-aware Limited Functionality Banner (all platforms) -->
<LimitedFunctionalityBanner />

<main class="">
    {#if isDashboardRoute}
        <!-- Dashboard routes handle their own transitions -->
        {@render children()}
    {:else}
        <!-- Non-dashboard routes use page transitions -->
        <PageTransition type="page" duration={350}>
            {@render children()}
        </PageTransition>
    {/if}
</main>

<style>
    /* Font loading is handled by FontService */
    /* @font-face declarations are added dynamically */

    :global(html) {
        height: 100%;
        margin: 0;
        padding: 0;
        /* Font is applied via FontService, not hardcoded */
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

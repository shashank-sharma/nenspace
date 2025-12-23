<script lang="ts">
    import DashboardLayout from "$lib/features/dashboard/components/DashboardLayout.svelte";
    import { DASHBOARD_SECTIONS } from "$lib/features/dashboard/constants";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { authService } from "$lib/services/authService.svelte";
    import { HealthService } from "$lib/services/health.service.svelte"; // Import for automatic initialization
    import { RealtimeService } from "$lib/services/realtime.service.svelte"; // Dashboard-only: real-time notifications
    import { SettingsService } from "$lib/services/settings.service.svelte"; // Preload settings for dashboard
    import StatusIndicator from "$lib/components/StatusIndicator.svelte";
    import ShortcutsHelpPanel from "$lib/components/ShortcutsHelpPanel.svelte";
    import { Toaster } from "$lib/components/ui/sonner";
    import type { Snippet } from "svelte";

    // Register feature sync services (DASHBOARD-ONLY - not loaded on homepage/auth)
    import "$lib/features/food-log/services/food-log-sync-adapter";
    import "$lib/features/tasks/services/task-sync-adapter";
    import "$lib/features/credentials/services/credentials-sync-adapter";
    import "$lib/features/inventory/services/inventory-sync-adapter";
    import "$lib/features/journal/services/journal-sync-adapter";

    let { children } = $props<{ children: Snippet }>();
    const sections = DASHBOARD_SECTIONS;
    let showShortcuts = $state(false);
    
    // Reactive settings access
    let debugSettings = $derived(SettingsService.debug);
    let appearanceSettings = $derived(SettingsService.appearance);
    let shouldShowDebugButton = $derived(debugSettings.showDebugButton);
    let shouldShowStatusIndicator = $derived(appearanceSettings.showStatusIndicator);

    $effect(() => {
        if (!authService.isAuthenticated) {
            goto("/auth/login");
        }
    });

    // Initialize dashboard-only services
    onMount(() => {
        // Preload user settings first (critical for UI state)
        // This will also trigger font application via applyGlobalSettings()
        SettingsService.ensureLoaded().catch((err) => {
            console.error("[Dashboard] Failed to preload settings:", err);
        });
        
        // Initialize realtime notifications (only in dashboard)
        // Note: NotificationSyncService is initialized at root layout level
        RealtimeService.initialize().catch((err) => {
            console.error(
                "[Dashboard] Failed to initialize realtime service:",
                err,
            );
        });

        // Cleanup on unmount
        return () => {
            RealtimeService.cleanup().catch((err) => {
                console.error(
                    "[Dashboard] Failed to cleanup realtime service:",
                    err,
                );
            });
        };
    });

    function handleShowShortcuts() {
        showShortcuts = true;
    }

    function handleCloseShortcuts() {
        showShortcuts = false;
    }
</script>

{#if authService.isAuthenticated}
    <!-- Toaster for dashboard -->
    <Toaster />

    <!-- Island notification (top-center) - handles both notifications and network status -->
    {#if shouldShowStatusIndicator}
        <StatusIndicator />
    {/if}
    
    <ShortcutsHelpPanel
        visible={showShortcuts}
        on:close={handleCloseShortcuts}
    />

    <DashboardLayout {sections} onShowShortcuts={handleShowShortcuts}>
        {@render children()}
    </DashboardLayout>
{:else}
    <div
        class="flex items-center justify-center h-screen bg-background text-foreground"
    >
        <div class="text-center">
            <h1 class="text-3xl font-bold">You are not logged in</h1>
            <p class="text-muted-foreground">Redirecting to login page...</p>
        </div>
    </div>
{/if}

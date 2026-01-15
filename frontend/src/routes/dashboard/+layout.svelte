<script lang="ts">
    import DashboardLayout from "$lib/features/dashboard/components/DashboardLayout.svelte";
    import { DASHBOARD_SECTIONS } from "$lib/features/dashboard/constants";
    import { goto } from "$app/navigation";
    import { authService } from "$lib/services/authService.svelte";
    import { HealthService } from "$lib/services/health.service.svelte"; // Import for automatic initialization
    import { SettingsService } from "$lib/services/settings.service.svelte"; // Preload settings for dashboard
    import StatusIndicator from "$lib/components/StatusIndicator.svelte";
    import ShortcutsHelpPanel from "$lib/components/ShortcutsHelpPanel.svelte";
    import DashboardLoading from "$lib/components/DashboardLoading.svelte";
    import { Toaster } from "$lib/components/ui/sonner";
    import { onMount } from "svelte";
    import { onNavigate } from "$app/navigation";
    import type { Snippet } from "svelte";
    import { usePlatform } from "$lib/hooks/usePlatform.svelte";

    // Register feature sync services (DASHBOARD-ONLY - not loaded on homepage/auth)
    import "$lib/features/food-log/services/food-log-sync-adapter";
    import "$lib/features/tasks/services/task-sync-adapter";
    import "$lib/features/credentials/services/credentials-sync-adapter";
    import "$lib/features/inventory/services/inventory-sync-adapter";
    import "$lib/features/journal/services/journal-sync-adapter";

    let { children } = $props<{ children: Snippet }>();
    const sections = DASHBOARD_SECTIONS;
    let showShortcuts = $state(false);
    
    // Platform detection
    const platform = usePlatform();
    
    // Reactive settings access
    let debugSettings = $derived(SettingsService.debug);
    let appearanceSettings = $derived(SettingsService.appearance);
    let shouldShowDebugButton = $derived(debugSettings.showDebugButton);
    // Hide StatusIndicator in Tauri since there's already a separate floating status indicator window
    let shouldShowStatusIndicator = $derived(
        appearanceSettings.showStatusIndicator && !platform.isTauri
    );

    // Debug: log status indicator visibility
    $effect(() => {
        console.log('[Dashboard] StatusIndicator visibility:', {
            isTauri: platform.isTauri,
            showStatusIndicatorSetting: appearanceSettings.showStatusIndicator,
            shouldShowStatusIndicator
        });
    });

    $effect(() => {
        if (!authService.isAuthenticated) {
            goto("/auth/login");
        }
    });

    // Cleanup on unmount
    onMount(() => {
        return () => {
            // Cleanup is handled by individual services
        };
    });

    // Handle navigation for transitions
    onNavigate((navigation) => {
        // Navigation state is handled by PageTransition component
        // This hook ensures navigation completes properly
        if (navigation?.to) {
            // Navigation will be handled by the transition system
        }
    });

    function handleShowShortcuts() {
        showShortcuts = true;
    }

    function handleCloseShortcuts() {
        showShortcuts = false;
    }
</script>

{#if authService.isAuthenticated}
    <DashboardLoading>
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
    </DashboardLoading>
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

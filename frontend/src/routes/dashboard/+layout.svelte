<script lang="ts">
    import DashboardLayout from "$lib/features/dashboard/components/DashboardLayout.svelte";
    import { DASHBOARD_SECTIONS } from "$lib/features/dashboard/constants";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { authService } from "$lib/services/authService.svelte";
    import { HealthService } from "$lib/services/health.service.svelte"; // Import for automatic initialization
    import { RealtimeService } from "$lib/services/realtime.service.svelte"; // Dashboard-only: real-time notifications
    import StatusIndicator from "$lib/components/StatusIndicator.svelte";
    import BottomRightControls from "$lib/components/BottomRightControls.svelte";
    import DebugLauncher from "$lib/components/debug/DebugLauncher.svelte";
    import ShortcutsHelpPanel from "$lib/components/ShortcutsHelpPanel.svelte";
    import { Toaster } from "$lib/components/ui/sonner";
    import type { Snippet } from "svelte";

    // Register feature sync services (DASHBOARD-ONLY - not loaded on homepage/auth)
    import "$lib/features/food-log/services/food-log-sync-adapter";
    import "$lib/features/tasks/services/task-sync-adapter";
    import "$lib/features/credentials/services/credentials-sync-adapter";

    let { children } = $props<{ children: Snippet }>();
    const sections = DASHBOARD_SECTIONS;
    let showShortcuts = $state(false);

    $effect(() => {
        if (!authService.isAuthenticated) {
            goto("/auth/login");
        }
    });

    // Initialize dashboard-only services
    onMount(() => {
        // Initialize realtime notifications (only in dashboard)
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
    <StatusIndicator />

    <!-- Bottom right controls -->
    <BottomRightControls on:show-shortcuts={handleShowShortcuts} />
    <div class="fixed bottom-4 right-4 z-50">
        <DebugLauncher />
    </div>
    <ShortcutsHelpPanel
        visible={showShortcuts}
        on:close={handleCloseShortcuts}
    />

    <DashboardLayout {sections}>
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

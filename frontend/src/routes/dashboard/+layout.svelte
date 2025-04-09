<script lang="ts">
    import DashboardLayout from "$lib/features/dashboard/components/DashboardLayout.svelte";
    import { DASHBOARD_SECTIONS } from "$lib/features/dashboard/constants";
    import { onMount, onDestroy } from "svelte";
    import { goto } from "$app/navigation";
    import { authIsValid } from "$lib/services/authService";
    import { notificationStore } from "$lib/features/notifications/stores/notifications.store";
    import { checkBackendHealth } from "$lib/config/pocketbase";

    onMount(() => {
        console.log("onMount dashboard layout");
        if (!authIsValid()) {
            goto("/auth/login");
        }

        // Run health check once when dashboard loads
        checkBackendHealth();
    });
</script>

<DashboardLayout sections={DASHBOARD_SECTIONS}>
    <slot />
</DashboardLayout>

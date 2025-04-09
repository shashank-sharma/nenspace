<script lang="ts">
    import { onMount } from "svelte";
    import { dashboardStore } from "../stores/dashboard.store";
    import { DashboardService } from "../services/dashboard.service";
    import { toast } from "svelte-sonner";
    import StatsGrid from "./StatsGrid.svelte";
    import RecentActivity from "./RecentActivity.svelte";
    import StatusIndicator from "$lib/components/StatusIndicator.svelte";

    onMount(async () => {
        try {
            dashboardStore.setLoading(true);
            const stats = await DashboardService.getStats();
            dashboardStore.setStats(stats);
        } catch (error) {
            toast.error("Failed to load dashboard data");
        } finally {
            dashboardStore.setLoading(false);
        }
    });
</script>

<StatusIndicator />

<div class="container mx-auto p-4">
    <div class="space-y-6">
        <StatsGrid />
        <RecentActivity />
    </div>
</div>

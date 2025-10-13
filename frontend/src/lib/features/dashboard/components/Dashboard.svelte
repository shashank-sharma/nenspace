<script lang="ts">
    import { DashboardService } from "../services/dashboard.service";
    import { IslandNotificationService } from "$lib/services/island-notification.service.svelte";
    import { toast } from "svelte-sonner";
    import StatsGrid from "./StatsGrid.svelte";
    import RecentActivity from "./RecentActivity.svelte";
    import type { DashboardStats } from "../types";
    import { onMount } from "svelte";

    let stats = $state<DashboardStats | null>(null);
    let isLoading = $state(true);
    let error = $state<string | null>(null);

    async function loadDashboardData() {
        isLoading = true;
        error = null;
        try {
            stats = await DashboardService.getStats();
            IslandNotificationService.success("Page loaded");
        } catch (e) {
            error = "Failed to load dashboard data";
            toast.error(error);
            IslandNotificationService.error("Failed to load dashboard");
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        loadDashboardData();
    });
</script>

<div class="container mx-auto p-4">
    <div class="space-y-6">
        <StatsGrid {stats} {isLoading} />
        <RecentActivity />
    </div>
</div>

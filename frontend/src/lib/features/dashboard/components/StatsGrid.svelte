<script lang="ts">
    import { Card } from "$lib/components/ui/card";
    import { CheckSquare, Calendar, Briefcase, ListTodo } from "lucide-svelte";
    import type { DashboardStats } from "../types";

    let { stats, isLoading } = $props<{
        stats: DashboardStats | null;
        isLoading: boolean;
    }>();

    const statCards = [
        {
            title: "Total Tasks",
            icon: ListTodo,
            getValue: (stats: DashboardStats | null) => stats?.totalTasks ?? 0,
            color: "text-primary",
            bgColor: "bg-primary/10",
        },
        {
            title: "Completed",
            icon: CheckSquare,
            getValue: (stats: DashboardStats | null) =>
                stats?.completedTasks ?? 0,
            color: "text-completed",
            bgColor: "bg-completed/10",
        },
        {
            title: "Upcoming Events",
            icon: Calendar,
            getValue: (stats: DashboardStats | null) =>
                stats?.upcomingEvents ?? 0,
            color: "text-secondary",
            bgColor: "bg-secondary/10",
        },
        {
            title: "Active Projects",
            icon: Briefcase,
            getValue: (stats: DashboardStats | null) =>
                stats?.activeProjects ?? 0,
            color: "text-accent",
            bgColor: "bg-accent/10",
        },
    ];
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {#each statCards as card}
        <Card class="p-6 bg-card">
            <div class="flex items-center space-x-4">
                <div class={`p-3 rounded-full ${card.bgColor}`}>
                    <svelte:component
                        this={card.icon}
                        class={`h-6 w-6 ${card.color}`}
                    />
                </div>
                <div>
                    <p class="text-sm text-muted-foreground">{card.title}</p>
                    {#if isLoading}
                        <div
                            class="h-8 w-16 bg-muted animate-pulse rounded-md mt-1"
                        ></div>
                    {:else}
                        <h3 class="text-2xl font-bold">
                            {card.getValue(stats)}
                        </h3>
                    {/if}
                </div>
            </div>
        </Card>
    {/each}
</div>

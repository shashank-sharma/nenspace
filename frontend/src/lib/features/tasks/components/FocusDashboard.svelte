<script lang="ts">
    import type { Task } from "../types";
    import { Badge } from "$lib/components/ui/badge";
    import * as Card from "$lib/components/ui/card";
    import { AlertCircle, Calendar, Clock, Flame } from "lucide-svelte";
    import { createEventDispatcher } from "svelte";

    let { tasks = [], onQuickAdd } = $props<{
        tasks: Task[];
        onQuickAdd?: (category: string) => void;
    }>();

    const dispatch = createEventDispatcher();

    // Calculate focus metrics
    const focusMetrics = $derived.by(() => {
        const now = new Date();
        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );

        const dueToday = tasks.filter((task: Task) => {
            if (!task.due || task.completed) return false;
            const dueDate = new Date(task.due);
            const dueDateOnly = new Date(
                dueDate.getFullYear(),
                dueDate.getMonth(),
                dueDate.getDate(),
            );
            return dueDateOnly.getTime() === today.getTime();
        });

        const overdue = tasks.filter((task: Task) => {
            if (!task.due || task.completed) return false;
            const dueDate = new Date(task.due);
            return dueDate < now;
        });

        const highPriority = tasks.filter(
            (task: Task) => !task.completed && task.priority === 3,
        );

        const completed = tasks.filter((task: Task) => task.completed).length;
        const total = tasks.length;
        const completionRate =
            total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
            dueToday,
            overdue,
            highPriority,
            completed,
            total,
            completionRate,
        };
    });
</script>

<div class="focus-dashboard mb-8 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
        <div>
            <h2 class="text-2xl font-bold flex items-center gap-2">
                <span
                    class="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent"
                >
                    Focus Now
                </span>
            </h2>
            <p class="text-sm text-muted-foreground mt-1">
                Your most important tasks
            </p>
        </div>
    </div>

    <!-- Metrics Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Due Today -->
        <Card.Root
            class="hover:shadow-md transition-shadow cursor-pointer group"
            on:click={() => dispatch("filter", { dueDate: "today" })}
        >
            <Card.Content class="pt-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-muted-foreground">
                            Due Today
                        </p>
                        <p
                            class="text-3xl font-bold mt-2 group-hover:scale-110 transition-transform"
                        >
                            {focusMetrics.dueToday.length}
                        </p>
                    </div>
                    <div
                        class="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"
                    >
                        <Calendar
                            class="h-6 w-6 text-blue-600 dark:text-blue-400"
                        />
                    </div>
                </div>
            </Card.Content>
        </Card.Root>

        <!-- Overdue -->
        <Card.Root
            class="hover:shadow-md transition-shadow cursor-pointer group {focusMetrics
                .overdue.length > 0
                ? 'border-red-200 dark:border-red-900'
                : ''}"
            on:click={() => dispatch("filter", { dueDate: "overdue" })}
        >
            <Card.Content class="pt-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-muted-foreground">
                            Overdue
                        </p>
                        <p
                            class="text-3xl font-bold mt-2 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform"
                        >
                            {focusMetrics.overdue.length}
                        </p>
                    </div>
                    <div
                        class="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"
                    >
                        <AlertCircle
                            class="h-6 w-6 text-red-600 dark:text-red-400"
                        />
                    </div>
                </div>
            </Card.Content>
        </Card.Root>

        <!-- High Priority -->
        <Card.Root
            class="hover:shadow-md transition-shadow cursor-pointer group"
            on:click={() => dispatch("filter", { priority: 3 })}
        >
            <Card.Content class="pt-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-muted-foreground">
                            High Priority
                        </p>
                        <p
                            class="text-3xl font-bold mt-2 group-hover:scale-110 transition-transform"
                        >
                            {focusMetrics.highPriority.length}
                        </p>
                    </div>
                    <div
                        class="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center"
                    >
                        <Flame
                            class="h-6 w-6 text-orange-600 dark:text-orange-400"
                        />
                    </div>
                </div>
            </Card.Content>
        </Card.Root>

        <!-- Progress -->
        <Card.Root class="hover:shadow-md transition-shadow">
            <Card.Content class="pt-6">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <p class="text-sm font-medium text-muted-foreground">
                            Progress
                        </p>
                        <p class="text-3xl font-bold mt-2">
                            {focusMetrics.completionRate}%
                        </p>
                        <p class="text-xs text-muted-foreground mt-1">
                            {focusMetrics.completed} of {focusMetrics.total}
                        </p>
                    </div>
                    <div
                        class="h-12 w-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm"
                    >
                        {focusMetrics.completionRate}%
                    </div>
                </div>
                <!-- Progress bar -->
                <div class="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        class="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500 ease-out"
                        style="width: {focusMetrics.completionRate}%"
                    ></div>
                </div>
            </Card.Content>
        </Card.Root>
    </div>
</div>

<style>
    .focus-dashboard :global(.group:hover) {
        transform: translateY(-2px);
    }
</style>

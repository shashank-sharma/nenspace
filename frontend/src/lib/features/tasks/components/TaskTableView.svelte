<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import type { Task } from "../types";
    import {
        Table,
        TableBody,
        TableCell,
        TableHead,
        TableHeader,
        TableRow,
    } from "$lib/components/ui/table";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import {
        Circle,
        CheckCircle2,
        MoreHorizontal,
        Flame,
        AlertCircle,
        Calendar,
        Tag,
        CheckSquare,
        Repeat,
        ArrowUpDown,
        ArrowUp,
        ArrowDown,
    } from "lucide-svelte";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { cn } from "$lib/utils";
    import {
        STATUS_COLORS,
        getPriorityConfig,
        getRecurrenceLabel,
    } from "../constants";
    import { usePagination } from "$lib/hooks";
    import Pagination from "$lib/components/Pagination.svelte";

    let {
        tasks,
        subtaskCounts,
        sortBy = null,
        sortOrder = "asc",
    }: {
        tasks: Task[];
        subtaskCounts: Map<string, { total: number; completed: number }>;
        sortBy?: "title" | "priority" | "due" | "category" | null;
        sortOrder?: "asc" | "desc";
    } = $props();

    const dispatch = createEventDispatcher();

    // Use pagination hook with getter function for reactivity
    const pagination = usePagination({
        items: () => tasks,
        initialPageSize: 10,
        pageSizeOptions: [10, 20, 30, 50, 100],
    });

    function handleSort(column: "title" | "priority" | "due" | "category") {
        if (sortBy === column) {
            // Toggle order if same column
            dispatch("sort", {
                sortBy: column,
                sortOrder: sortOrder === "asc" ? "desc" : "asc",
            });
        } else {
            // Default to asc for new column
            dispatch("sort", { sortBy: column, sortOrder: "asc" });
        }
    }

    function formatDate(dateString?: string): string {
        if (!dateString) return "—";
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.ceil(
            (date.getTime() - now.getTime()) / (1000 * 3600 * 24),
        );

        if (diffDays < 0) return "Overdue";
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Tomorrow";
        if (diffDays <= 7) return `${diffDays}d`;
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    }

    function handleToggleComplete(task: Task) {
        dispatch("quick-complete", task);
    }

    function handleEditTask(task: Task) {
        dispatch("select", task);
    }

    function handleDeleteTask(task: Task) {
        dispatch("delete", task);
    }
</script>

<div class="rounded-md border">
    <Table>
        <TableHeader>
            <TableRow>
                <TableHead class="w-12"></TableHead>
                <TableHead>
                    <button
                        onclick={() => handleSort("title")}
                        class="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                        Task
                        {#if sortBy === "title"}
                            {#if sortOrder === "asc"}
                                <ArrowUp class="h-3 w-3" />
                            {:else}
                                <ArrowDown class="h-3 w-3" />
                            {/if}
                        {:else}
                            <ArrowUpDown class="h-3 w-3 opacity-50" />
                        {/if}
                    </button>
                </TableHead>
                <TableHead class="w-32">
                    <button
                        onclick={() => handleSort("category")}
                        class="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                        Status
                        {#if sortBy === "category"}
                            {#if sortOrder === "asc"}
                                <ArrowUp class="h-3 w-3" />
                            {:else}
                                <ArrowDown class="h-3 w-3" />
                            {/if}
                        {:else}
                            <ArrowUpDown class="h-3 w-3 opacity-50" />
                        {/if}
                    </button>
                </TableHead>
                <TableHead class="w-28">
                    <button
                        onclick={() => handleSort("priority")}
                        class="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                        Priority
                        {#if sortBy === "priority"}
                            {#if sortOrder === "asc"}
                                <ArrowUp class="h-3 w-3" />
                            {:else}
                                <ArrowDown class="h-3 w-3" />
                            {/if}
                        {:else}
                            <ArrowUpDown class="h-3 w-3 opacity-50" />
                        {/if}
                    </button>
                </TableHead>
                <TableHead class="w-28">
                    <button
                        onclick={() => handleSort("due")}
                        class="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                        Due Date
                        {#if sortBy === "due"}
                            {#if sortOrder === "asc"}
                                <ArrowUp class="h-3 w-3" />
                            {:else}
                                <ArrowDown class="h-3 w-3" />
                            {/if}
                        {:else}
                            <ArrowUpDown class="h-3 w-3 opacity-50" />
                        {/if}
                    </button>
                </TableHead>
                <TableHead class="w-12"></TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {#if tasks.length === 0}
                <TableRow>
                    <TableCell colspan={6} class="h-24 text-center">
                        <div class="text-muted-foreground">
                            No tasks found. Create one to get started.
                        </div>
                    </TableCell>
                </TableRow>
            {:else}
                {#each pagination.paginatedItems as task}
                    <TableRow
                        class="cursor-pointer"
                        onclick={() => handleEditTask(task)}
                    >
                        <!-- Checkbox -->
                        <TableCell>
                            <button
                                onclick={(e: MouseEvent) => {
                                    e.stopPropagation();
                                    handleToggleComplete(task);
                                }}
                                class="flex items-center justify-center"
                                aria-label={task.completed
                                    ? "Mark as incomplete"
                                    : "Mark as complete"}
                            >
                                {#if task.completed}
                                    <CheckCircle2
                                        class="h-5 w-5 text-green-500"
                                    />
                                {:else}
                                    <Circle
                                        class="h-5 w-5 text-muted-foreground hover:text-primary transition-colors"
                                    />
                                {/if}
                            </button>
                        </TableCell>

                        <!-- Task Title & Description -->
                        <TableCell>
                            <div class="flex flex-col gap-1">
                                <div
                                    class="font-medium {task.completed
                                        ? 'line-through text-muted-foreground'
                                        : ''}"
                                >
                                    {task.title}
                                </div>
                                {#if task.description}
                                    <div
                                        class="text-sm text-muted-foreground line-clamp-1 rich-text"
                                    >
                                        {@html task.description}
                                    </div>
                                {/if}
                                <!-- Subtasks & Tags -->
                                {#if (subtaskCounts.get(task.id)?.total || 0) > 0 || (task.tags && task.tags.length > 0)}
                                    <div class="flex items-center gap-2 mt-1">
                                        {#if (subtaskCounts.get(task.id)?.total || 0) > 0}
                                            <div
                                                class="flex items-center gap-1 text-xs text-muted-foreground"
                                            >
                                                <CheckSquare class="h-3 w-3" />
                                                {subtaskCounts.get(task.id)
                                                    ?.completed || 0} / {subtaskCounts.get(
                                                    task.id,
                                                )?.total || 0}
                                            </div>
                                        {/if}
                                        {#if task.tags && task.tags.length > 0}
                                            <div class="flex gap-1">
                                                {#each task.tags.slice(0, 2) as tag}
                                                    <Badge
                                                        variant="secondary"
                                                        class="text-[10px] px-1.5 py-0"
                                                    >
                                                        {tag}
                                                    </Badge>
                                                {/each}
                                                {#if task.tags.length > 2}
                                                    <Badge
                                                        variant="secondary"
                                                        class="text-[10px] px-1.5 py-0"
                                                    >
                                                        +{task.tags.length - 2}
                                                    </Badge>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </TableCell>

                        <!-- Status (Category) -->
                        <TableCell>
                            <Badge
                                class={cn(
                                    "capitalize",
                                    STATUS_COLORS[task.category] ||
                                        "bg-gray-100 text-gray-700",
                                )}
                            >
                                {task.category}
                            </Badge>
                        </TableCell>

                        <!-- Priority -->
                        <TableCell>
                            <Badge
                                class={getPriorityConfig(task.priority).color}
                            >
                                {getPriorityConfig(task.priority).label}
                            </Badge>
                        </TableCell>

                        <!-- Due Date -->
                        <TableCell>
                            {#if task.due}
                                <div
                                    class="text-sm {new Date(task.due) <
                                    new Date()
                                        ? 'text-red-600 dark:text-red-400 font-medium'
                                        : 'text-muted-foreground'}"
                                >
                                    {formatDate(task.due)}
                                </div>
                            {:else}
                                <span class="text-muted-foreground">—</span>
                            {/if}
                        </TableCell>

                        <!-- Actions -->
                        <TableCell>
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger
                                    class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                                    onclick={(e) => e.stopPropagation()}
                                >
                                    <MoreHorizontal class="h-4 w-4" />
                                    <span class="sr-only">Open menu</span>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content align="end">
                                    <DropdownMenu.Label
                                        >Actions</DropdownMenu.Label
                                    >
                                    <DropdownMenu.Separator />
                                    <DropdownMenu.Item
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            handleEditTask(task);
                                        }}
                                    >
                                        Edit task
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            handleToggleComplete(task);
                                        }}
                                    >
                                        {task.completed
                                            ? "Mark incomplete"
                                            : "Mark complete"}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Separator />
                                    <DropdownMenu.Item
                                        class="text-destructive"
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteTask(task);
                                        }}
                                    >
                                        Delete
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Root>
                        </TableCell>
                    </TableRow>
                {/each}
            {/if}
        </TableBody>
    </Table>

    <!-- Pagination Controls -->
    {#if tasks.length > 0}
        <Pagination
            bind:currentPage={pagination.currentPage}
            bind:pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
        />
    {/if}
</div>

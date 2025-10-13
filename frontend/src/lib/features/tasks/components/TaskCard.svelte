<script lang="ts">
    import { fade, scale } from "svelte/transition";
    import { Button } from "$lib/components/ui/button";
    import {
        Trash2,
        CheckCircle2,
        Circle,
        AlertCircle,
        Calendar,
        Flame,
        CheckSquare,
        Repeat,
        Tag,
        RefreshCw,
        XCircle,
    } from "lucide-svelte";
    import type { Task, LocalTask } from "../types";
    import { createEventDispatcher } from "svelte";
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import { Badge } from "$lib/components/ui/badge";
    import { categoryBorderColors, PRIORITY_CONFIG } from "../constants";

    let {
        task,
        subtaskCount = 0,
        completedSubtasks = 0,
    } = $props<{
        task: Task;
        subtaskCount?: number;
        completedSubtasks?: number;
    }>();

    // Check if task has sync status (offline metadata)
    const localTask = task as LocalTask;
    const hasSyncStatus = $derived(
        localTask.syncStatus && localTask.syncStatus !== "synced",
    );

    const dispatch = createEventDispatcher();

    let showDeleteDialog = $state(false);
    let isHovered = $state(false);

    function handleClick() {
        dispatch("select");
    }

    function handleDeleteClick(e: MouseEvent) {
        e.stopPropagation();
        showDeleteDialog = true;
    }

    function handleQuickComplete(e: MouseEvent) {
        e.stopPropagation();
        dispatch("quick-complete");
    }

    function confirmDelete() {
        dispatch("delete");
        showDeleteDialog = false;
    }

    // Priority config
    const priorityConfig = $derived(PRIORITY_CONFIG[task.priority || 1]);

    // Check if task is overdue
    const isOverdue = $derived(
        task.due && !task.completed && new Date(task.due) < new Date(),
    );

    // Due date badge color
    const dueDateColor = $derived.by(() => {
        if (!task.due || task.completed)
            return "bg-muted text-muted-foreground";
        const dueDate = new Date(task.due);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today to the start of the day
        const diffDays = Math.ceil(
            (dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24),
        );

        if (diffDays < 0)
            return "bg-destructive/20 text-destructive-foreground";
        if (diffDays === 0) return "bg-primary/20 text-primary";
        if (diffDays <= 3) return "bg-secondary/20 text-secondary";
        return "bg-accent/20 text-accent";
    });

    // Recurrence label
    const recurrenceLabel = $derived.by(() => {
        if (!task.recurrence_frequency || task.recurrence_frequency === "none")
            return "";
        const frequency = task.recurrence_frequency;
        const interval = task.recurrence_interval || 1;
        if (interval === 1) {
            return `Repeats ${frequency}`;
        }
        return `Every ${interval} ${frequency === "daily" ? "days" : frequency === "weekly" ? "weeks" : frequency === "monthly" ? "months" : "years"}`;
    });
</script>

<div
    class="group relative border-l-4 {categoryBorderColors[task.category] ??
        'border-l-muted'} rounded-lg p-3 mb-3
           shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer
           {isOverdue ? 'ring-2 ring-destructive/50' : ''}
           {task.completed ? 'bg-completed/20 opacity-60' : 'bg-card'}"
    transition:fade
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
    onclick={handleClick}
    onkeydown={(e) => e.key === "Enter" && handleClick()}
    role="button"
    tabindex="0"
    aria-label="Edit task: {task.title}"
>
    <div class="flex justify-between items-start gap-3">
        <!-- Quick Complete Checkbox -->
        <button
            class="flex-shrink-0 mt-0.5 hover:scale-110 transition-transform"
            onclick={handleQuickComplete}
            aria-label={task.completed
                ? "Mark as incomplete"
                : "Mark as complete"}
        >
            {#if task.completed}
                <div transition:scale>
                    <CheckCircle2 class="h-5 w-5 text-completed" />
                </div>
            {:else}
                <Circle
                    class="h-5 w-5 text-muted-foreground hover:text-primary transition-colors"
                />
            {/if}
        </button>

        <!-- Task Content -->
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
                <span
                    class="font-medium {task.completed
                        ? 'line-through text-muted-foreground'
                        : ''}"
                >
                    {task.title}
                </span>

                <!-- Priority Badge -->
                {#if task.priority && task.priority > 1 && !task.completed}
                    <span
                        class="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded {priorityConfig.color}"
                    >
                        {#if task.priority === 3}
                            <Flame class="h-3 w-3" />
                        {:else if task.priority === 2}
                            <AlertCircle class="h-3 w-3" />
                        {/if}
                        {priorityConfig.label}
                    </span>
                {/if}

                <!-- Sync Status Badges -->
                {#if localTask.syncStatus === "pending"}
                    <Badge
                        variant="outline"
                        class="text-[10px] py-0 px-1.5 gap-0.5 border-primary/50 text-primary"
                        title="Waiting to sync"
                    >
                        <RefreshCw class="h-2.5 w-2.5" />
                        Pending
                    </Badge>
                {:else if localTask.syncStatus === "failed"}
                    <Badge
                        variant="outline"
                        class="text-[10px] py-0 px-1.5 gap-0.5 border-destructive/50 text-destructive"
                        title="Sync failed - will retry"
                    >
                        <XCircle class="h-2.5 w-2.5" />
                        Failed
                    </Badge>
                {/if}
            </div>

            {#if task.description}
                <div
                    class="text-sm text-muted-foreground mt-1.5 line-clamp-2 rich-text {task.completed
                        ? 'line-through'
                        : ''}"
                >
                    {@html task.description}
                </div>
            {/if}

            <!-- Subtasks Progress -->
            {#if subtaskCount > 0}
                <div class="mt-2 flex items-center gap-2">
                    <CheckSquare class="h-3.5 w-3.5 text-muted-foreground" />
                    <span class="text-xs text-muted-foreground">
                        {completedSubtasks} / {subtaskCount} subtasks
                    </span>
                    <div
                        class="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[100px]"
                    >
                        <div
                            class="h-full bg-primary transition-all duration-300"
                            style="width: {subtaskCount > 0
                                ? (completedSubtasks / subtaskCount) * 100
                                : 0}%"
                        ></div>
                    </div>
                </div>
            {/if}

            <!-- Tags & Recurrence -->
            {#if (task.tags && task.tags.length > 0) || (task.recurrence_frequency && task.recurrence_frequency !== "none")}
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                    <!-- Tags -->
                    {#if task.tags && task.tags.length > 0}
                        {#each task.tags.slice(0, 3) as tag}
                            <Badge
                                variant="secondary"
                                class="text-[10px] py-0 px-1.5 gap-0.5"
                            >
                                <Tag class="h-2.5 w-2.5" />
                                {tag}
                            </Badge>
                        {/each}
                        {#if task.tags.length > 3}
                            <Badge
                                variant="secondary"
                                class="text-[10px] py-0 px-1.5"
                            >
                                +{task.tags.length - 3}
                            </Badge>
                        {/if}
                    {/if}

                    <!-- Recurrence Badge -->
                    {#if task.recurrence_frequency && task.recurrence_frequency !== "none"}
                        <Badge
                            variant="outline"
                            class="text-[10px] py-0 px-1.5 gap-0.5 border-secondary/50 text-secondary"
                        >
                            <Repeat class="h-2.5 w-2.5" />
                            {recurrenceLabel}
                        </Badge>
                    {/if}
                </div>
            {/if}

            <!-- Due Date Badge -->
            {#if task.due && !task.completed}
                <div class="flex items-center gap-1.5 mt-2">
                    <span
                        class="text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1 {dueDateColor}"
                    >
                        <Calendar class="h-3 w-3" />
                        {new Date(task.due).toLocaleDateString()}
                    </span>
                    {#if isOverdue}
                        <span
                            class="text-xs font-bold text-destructive animate-pulse"
                        >
                            Overdue!
                        </span>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- Quick Actions (Show on hover) -->
        <div
            class="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
            <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                on:click={handleDeleteClick}
                aria-label="Delete task"
            >
                <Trash2 class="h-4 w-4" />
            </Button>
        </div>
    </div>
</div>

<!-- Confirm Delete Dialog -->
<AlertDialog.Root bind:open={showDeleteDialog}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Delete Task</AlertDialog.Title>
            <AlertDialog.Description>
                Are you sure you want to delete "{task.title}"?
                <p class="text-sm text-destructive mt-2">
                    This action cannot be undone.
                </p>
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel on:click={() => (showDeleteDialog = false)}>
                Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
                on:click={confirmDelete}
                class="bg-destructive text-destructive-foreground"
            >
                Delete
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>

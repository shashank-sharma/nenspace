<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import type { Task } from "../types";
    import TaskCard from "./TaskCard.svelte";
    import TaskQuickAdd from "./TaskQuickAdd.svelte";
    import { Plus } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import {
        categories,
        categoryTextColors,
        categoryAccentColors,
    } from "../constants";

    let {
        categoryTasks,
        subtaskCounts,
        showQuickAdd,
        quickAddCategory,
        showCompletedTasks,
    }: {
        categoryTasks: Array<{
            value: string;
            label: string;
            color: string;
            tasks: Task[];
        }>;
        subtaskCounts: Map<string, { total: number; completed: number }>;
        showQuickAdd: boolean;
        quickAddCategory: string;
        showCompletedTasks: boolean;
    } = $props();

    const dispatch = createEventDispatcher();

    function handleQuickAdd(category: string) {
        dispatch("quick-add", category);
    }

    function handleQuickAddSubmit(event: CustomEvent) {
        dispatch("quick-add-submit", event.detail);
    }

    function handleQuickAddClose() {
        dispatch("quick-add-close");
    }

    function handleTaskSelect(task: Task) {
        dispatch("select", task);
    }

    function handleQuickComplete(task: Task) {
        dispatch("quick-complete", task);
    }

    function handleTaskDelete(taskId: string) {
        dispatch("delete", taskId);
    }
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {#each categoryTasks as category}
        <div class="flex flex-col h-full">
            <!-- Category Header -->
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                    <div
                        class="h-8 w-1 rounded-full bg-gradient-to-b {categoryAccentColors[
                            category.value
                        ]}"
                    ></div>
                    <div>
                        <h2
                            class="text-lg font-semibold {categoryTextColors[
                                category.value
                            ]}"
                        >
                            {category.label}
                        </h2>
                        <p class="text-xs text-muted-foreground">
                            {category.tasks.length} task{category.tasks
                                .length !== 1
                                ? "s"
                                : ""}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8 {categoryTextColors[category.value]}"
                    on:click={() => handleQuickAdd(category.value)}
                >
                    <Plus class="h-4 w-4" />
                </Button>
            </div>

            <!-- Category Column -->
            <div
                class="flex-1 {category.color} rounded-xl p-4 min-h-[500px] border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-colors"
            >
                {#if showQuickAdd && quickAddCategory === category.value}
                    <TaskQuickAdd
                        category={category.value}
                        on:add={handleQuickAddSubmit}
                        on:close={handleQuickAddClose}
                    />
                {/if}

                {#each category.tasks as task (task.id)}
                    <TaskCard
                        {task}
                        subtaskCount={subtaskCounts.get(task.id)?.total || 0}
                        completedSubtasks={subtaskCounts.get(task.id)
                            ?.completed || 0}
                        on:select={() => handleTaskSelect(task)}
                        on:quick-complete={() => handleQuickComplete(task)}
                        on:delete={() => handleTaskDelete(task.id)}
                    />
                {/each}

                {#if category.tasks.length === 0 && !showQuickAdd}
                    <div class="text-center text-muted-foreground py-12">
                        <p class="text-sm font-medium">All clear!</p>
                        <p class="text-xs mt-1">No tasks in this category</p>
                        <Button
                            variant="ghost"
                            size="sm"
                            class="mt-4"
                            on:click={() => handleQuickAdd(category.value)}
                        >
                            <Plus class="h-3 w-3 mr-1" />
                            Add First Task
                        </Button>
                    </div>
                {/if}
            </div>
        </div>
    {/each}
</div>

<script lang="ts">
    import {
        TasksService,
        TaskSyncService,
    } from "$lib/features/tasks/services";
    import {
        categories,
        categoryTextColors,
        categoryBorderColors,
        categoryAccentColors,
        KEYBOARD_SHORTCUTS,
    } from "../constants";
    import type { Task, TaskFilter } from "../types";
    import TaskDrawer from "./TaskDrawer.svelte";
    import TaskTableView from "./TaskTableView.svelte";
    import TaskKanbanView from "./TaskKanbanView.svelte";
    import FocusDashboard from "./FocusDashboard.svelte";
    import FilterBar from "./FilterBar.svelte";
    import KeyboardShortcuts from "./KeyboardShortcuts.svelte";
    import { filterTasks } from "../utils/filter-tasks";
    import { sortTasks } from "../utils/sort-tasks";
    import { Plus, LayoutGrid, Table2 } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { onMount, onDestroy } from "svelte";
    import { DebugSettings, createPageDebug } from "$lib/utils/debug-helper";
    import { withErrorHandling } from "$lib/utils/error-handler.util";
    import { useModalState, useDebouncedFilter } from "$lib/hooks";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import QuickAddDialog from "$lib/components/QuickAddDialog.svelte";
    import ButtonControl from "$lib/components/debug/controls/ButtonControl.svelte";
    import SwitchControl from "$lib/components/debug/controls/SwitchControl.svelte";
    import { toast } from "svelte-sonner";

    // Debug settings with automatic localStorage management
    const debugSettings = new DebugSettings("tasksDebugSettings", {
        showCompletedTasks: true,
        autoRefresh: false,
    });

    // Reactive state for template usage
    let showCompletedTasks = $state(debugSettings.get("showCompletedTasks"));
    let autoRefresh = $state(debugSettings.get("autoRefresh"));

    // Component State
    let tasks = $state<Task[]>([]);
    let isLoading = $state(true);
    let filter = $state<TaskFilter>({ searchQuery: "" });
    let subtaskCounts = $state<
        Map<string, { total: number; completed: number }>
    >(new Map());

    // UI State - Modal Management with useModalState
    const modals = useModalState<Task>();
    let showQuickAdd = $state(false);
    let quickAddCategory = $state("");
    let showQuickAddDialog = $state(false); // For table view quick add
    let showKeyboardShortcuts = $state(false);
    let currentView = $state<"table" | "kanban">("table"); // Default to table view

    // Filtered and sorted tasks based on current filter
    const filteredTasks = $derived(
        sortTasks(
            filterTasks(tasks, filter),
            filter.sortBy || null,
            filter.sortOrder,
        ),
    );

    // Derived State - Tasks by category
    const categoryTasks = $derived(
        categories.map((cat) => ({
            ...cat,
            tasks: filteredTasks
                .filter((task) => task.category === cat.value)
                .filter((task) => showCompletedTasks || !task.completed),
        })),
    );

    // Statistics
    const stats = $derived.by(() => {
        const completed = filteredTasks.filter((t) => t.completed).length;
        return {
            total: filteredTasks.length,
            completed,
            active: filteredTasks.length - completed,
        };
    });

    // Auto-refresh interval
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    $effect(() => {
        if (autoRefresh) {
            refreshInterval = setInterval(() => {
                loadTasks(false);
            }, 30000); // 30 seconds
        } else if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }

        // Cleanup on destroy
        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
        };
    });

    // Debounced filter - using reusable hook
    useDebouncedFilter(
        () => filter,
        () => loadTasks(true),
        300,
    );

    // Data Loading
    async function loadTasks(reset = false) {
        if (isLoading && !reset) return;

        isLoading = true;

        try {
            const result = await TasksService.fetchTasks(
                filter.searchQuery,
                filter.category || undefined,
            );
            tasks = result;

            // Load subtask counts for each task
            await loadSubtaskCounts();
        } catch (error) {
            console.error("Error loading tasks:", error);
            toast.error("Failed to load tasks");
        } finally {
            isLoading = false;
        }
    }

    // Load subtask counts for all tasks (efficient single query)
    async function loadSubtaskCounts() {
        try {
            // ✅ Single API call to get ALL subtasks
            const allSubtasksGrouped =
                await TasksService.fetchAllSubtasksGrouped();

            // Build counts map
            const counts = new Map();
            allSubtasksGrouped.forEach((subtasks, parentId) => {
                counts.set(parentId, {
                    total: subtasks.length,
                    completed: subtasks.filter((st) => st.completed).length,
                });
            });

            subtaskCounts = counts;
        } catch (error) {
            console.error("Failed to load subtask counts:", error);
        }
    }

    // Task Operations
    function handleQuickAdd(category: string) {
        quickAddCategory = category;
        showQuickAdd = true;
    }

    function handleNewTaskClick() {
        if (currentView === "table") {
            // Table view: Open quick add dialog
            showQuickAddDialog = true;
        } else {
            // Kanban view: Open inline quick add
            handleQuickAdd("focus");
        }
    }

    async function handleQuickAddSubmit(
        event: CustomEvent<{ title: string; category: string }>,
    ) {
        await withErrorHandling(
            () =>
                TasksService.createTask({
                    title: event.detail.title,
                    category: event.detail.category,
                    description: "",
                    completed: false,
                    priority: 1,
                    reminder: false,
                }),
            {
                successMessage: "Task created!",
                errorMessage: "Failed to create task",
                onSuccess: async () => {
                    showQuickAdd = false;
                    quickAddCategory = "";
                    await loadTasks(true);
                },
            },
        );
    }

    async function handleQuickAddDialogSubmit(data: {
        title: string;
        selectedValue?: string;
    }) {
        await withErrorHandling(
            () =>
                TasksService.createTask({
                    title: data.title,
                    category: data.selectedValue || "focus",
                    description: "",
                    completed: false,
                    priority: 1,
                    reminder: false,
                }),
            {
                successMessage: "Task created!",
                errorMessage: "Failed to create task",
                onSuccess: async () => {
                    await loadTasks(true);
                },
            },
        );
    }

    async function handleTaskSaveWithSubtasks(data: {
        task: Partial<Task>;
        pendingSubtasks: string[];
    }) {
        await withErrorHandling(
            async () => {
                // 1. Create parent task
                const createdTask = await TasksService.createTask(data.task);

                // 2. Create all subtasks
                if (data.pendingSubtasks.length > 0) {
                    await Promise.all(
                        data.pendingSubtasks.map((subtaskTitle) =>
                            TasksService.createSubtask(
                                createdTask.id,
                                subtaskTitle,
                            ),
                        ),
                    );
                }
                return createdTask;
            },
            {
                successMessage:
                    data.pendingSubtasks.length > 0
                        ? `Task created with ${data.pendingSubtasks.length} subtasks`
                        : "Task created!",
                errorMessage: "Failed to create task with subtasks",
                onSuccess: async () => {
                    modals.closeAll();
                    await loadTasks(true);
                },
            },
        );
    }

    function handleTaskSelect(task: Task) {
        modals.openEdit(task);
    }

    async function handleQuickComplete(task: Task) {
        const wasCompleted = task.completed;

        await withErrorHandling(
            () =>
                TasksService.updateTask(task.id, { completed: !wasCompleted }),
            {
                successMessage: !wasCompleted ? "Task completed!" : undefined,
                errorMessage: "Failed to update task",
                showToast: wasCompleted, // Only show toast on un-complete
                onSuccess: () => {
                    // Update local state
                    tasks = tasks.map((t) =>
                        t.id === task.id
                            ? { ...t, completed: !wasCompleted }
                            : t,
                    );
                },
            },
        );
    }

    async function handleTaskSave(taskData: Partial<Task>) {
        const isUpdate = !!modals.selectedItem?.id;

        await withErrorHandling(
            () =>
                isUpdate
                    ? TasksService.updateTask(modals.selectedItem!.id, taskData)
                    : TasksService.createTask(taskData),
            {
                successMessage: isUpdate ? "Task updated!" : "Task created!",
                errorMessage: `Failed to ${isUpdate ? "update" : "create"} task`,
                onSuccess: async () => {
                    modals.closeAll();
                    await loadTasks(true);
                },
            },
        );
    }

    async function handleTaskDelete(taskId: string) {
        await withErrorHandling(() => TasksService.deleteTask(taskId), {
            successMessage: "Task deleted!",
            errorMessage: "Failed to delete task",
            onSuccess: async () => {
                modals.closeAll();
                await loadTasks(true);
            },
        });
    }

    function handleDrawerClose() {
        modals.closeAll();
    }

    function handleFilterUpdate(event: CustomEvent) {
        filter = event.detail;
    }

    function handleFocusFilter(event: CustomEvent) {
        filter = { ...filter, ...event.detail };
    }

    // Keyboard shortcuts
    function handleKeyPress(event: KeyboardEvent) {
        // Don't trigger if user is typing in an input
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
            // Allow Escape to clear focus
            if (event.key === "Escape") {
                target.blur();
            }
            return;
        }

        switch (event.key) {
            case KEYBOARD_SHORTCUTS.HELP:
                event.preventDefault();
                showKeyboardShortcuts = !showKeyboardShortcuts;
                break;
            case KEYBOARD_SHORTCUTS.NEW_TASK:
                event.preventDefault();
                handleQuickAdd("focus");
                break;
            case KEYBOARD_SHORTCUTS.SEARCH:
                event.preventDefault();
                const searchInput = document.querySelector(
                    'input[type="text"]',
                ) as HTMLInputElement;
                searchInput?.focus();
                break;
            case KEYBOARD_SHORTCUTS.COMPLETE:
                if (modals.selectedItem) {
                    event.preventDefault();
                    handleQuickComplete(modals.selectedItem);
                }
                break;
            case KEYBOARD_SHORTCUTS.EDIT:
                if (modals.selectedItem) {
                    event.preventDefault();
                    modals.editModalOpen = true;
                }
                break;
            case "1":
            case "2":
            case "3":
            case "4":
                event.preventDefault();
                const categoryIndex = parseInt(event.key) - 1;
                if (categories[categoryIndex]) {
                    handleQuickAdd(categories[categoryIndex].value);
                }
                break;
            case "Escape":
                modals.closeAll();
                showKeyboardShortcuts = false;
                break;
        }
    }

    // Lifecycle
    onMount(() => {
        loadTasks(true);

        // Listen for sync events to refresh tasks
        const handleTasksSynced = () => {
            console.log("🔄 Tasks synced, refreshing...");
            loadTasks(true);
        };
        window.addEventListener("tasks-synced", handleTasksSynced);

        // Add keyboard listener
        window.addEventListener("keydown", handleKeyPress);

        // Register debug panel
        const cleanup = createPageDebug("tasks-feature", "Tasks Feature")
            .addButton("refresh-tasks", "Refresh Tasks", () => loadTasks(true))
            .addButton("force-sync", "Force Sync Now", () =>
                TaskSyncService.forceSyncNow(),
            )
            .addSwitch(
                "show-completed",
                "Show Completed",
                showCompletedTasks,
                (checked: boolean) => {
                    showCompletedTasks = checked;
                    debugSettings.update("showCompletedTasks", checked);
                },
                "Toggle visibility of completed tasks",
            )
            .addSwitch(
                "auto-refresh",
                "Auto Refresh",
                autoRefresh,
                (checked: boolean) => {
                    autoRefresh = checked;
                    debugSettings.update("autoRefresh", checked);
                },
                "Automatically refresh tasks every 30s",
            )
            .register({
                ButtonControl: ButtonControl as any,
                SwitchControl: SwitchControl as any,
                SelectControl: null,
            });

        return () => {
            cleanup();
            window.removeEventListener("tasks-synced", handleTasksSynced);
            window.removeEventListener("keydown", handleKeyPress);
            if (refreshInterval) clearInterval(refreshInterval);
        };
    });
</script>

<div class="container mx-auto p-4 max-w-screen-2xl">
    <!-- Page Header -->
    <div class="mb-8">
        <div class="flex items-center justify-between mb-2">
            <div>
                <h1
                    class="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"
                >
                    Tasks
                </h1>
                <p class="text-muted-foreground mt-1">
                    {stats.active} active · {stats.completed} completed · Press
                    <kbd class="px-2 py-1 text-xs font-mono bg-muted rounded"
                        >?</kbd
                    > for shortcuts
                </p>
            </div>
            <div class="flex items-center gap-2">
                <!-- View Toggle -->
                <div
                    class="inline-flex items-center rounded-md border border-input bg-background"
                >
                    <Button
                        variant={currentView === "table" ? "default" : "ghost"}
                        size="sm"
                        class="rounded-r-none"
                        on:click={() => (currentView = "table")}
                        aria-label="Table view"
                    >
                        <Table2 class="h-4 w-4" />
                    </Button>
                    <Button
                        variant={currentView === "kanban" ? "default" : "ghost"}
                        size="sm"
                        class="rounded-l-none"
                        on:click={() => (currentView = "kanban")}
                        aria-label="Kanban view"
                    >
                        <LayoutGrid class="h-4 w-4" />
                    </Button>
                </div>

                <Button size="sm" class="gap-2" on:click={handleNewTaskClick}>
                    <Plus class="h-4 w-4" />
                    New Task
                    <span
                        class="hidden sm:inline text-xs text-muted-foreground ml-1"
                        >(N)</span
                    >
                </Button>
            </div>
        </div>
    </div>

    <!-- Focus Dashboard -->
    <FocusDashboard {tasks} on:filter={handleFocusFilter} />

    <!-- Filter Bar -->
    <div class="mb-6">
        <FilterBar bind:filter on:change={handleFilterUpdate} />
    </div>

    <!-- View Content -->
    {#if currentView === "table"}
        <!-- Table View -->
        <TaskTableView
            tasks={filteredTasks}
            {subtaskCounts}
            sortBy={filter.sortBy || null}
            sortOrder={filter.sortOrder || "asc"}
            on:select={(e) => handleTaskSelect(e.detail)}
            on:quick-complete={(e) => handleQuickComplete(e.detail)}
            on:delete={(e) => handleTaskDelete(e.detail.id)}
            on:sort={(e) => {
                filter.sortBy = e.detail.sortBy;
                filter.sortOrder = e.detail.sortOrder;
            }}
        />
    {:else}
        <!-- Kanban View -->
        <TaskKanbanView
            {categoryTasks}
            {subtaskCounts}
            {showQuickAdd}
            {quickAddCategory}
            {showCompletedTasks}
            on:quick-add={(e) => handleQuickAdd(e.detail)}
            on:quick-add-submit={handleQuickAddSubmit}
            on:quick-add-close={() => {
                showQuickAdd = false;
                quickAddCategory = "";
            }}
            on:select={(e) => handleTaskSelect(e.detail)}
            on:quick-complete={(e) => handleQuickComplete(e.detail)}
            on:delete={(e) => handleTaskDelete(e.detail)}
        />
    {/if}

    <!-- Loading Skeleton -->
    {#if isLoading && tasks.length === 0}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            {#each categories as category}
                <div class="flex flex-col">
                    <div class="h-8 bg-muted rounded mb-4 animate-pulse"></div>
                    <div
                        class="{category.color} rounded-lg p-4 min-h-[500px] space-y-3"
                    >
                        {#each [1, 2, 3] as i}
                            <div
                                class="bg-card/50 rounded-lg p-3 animate-pulse border-l-4"
                            >
                                <div
                                    class="h-4 bg-muted rounded w-3/4 mb-2"
                                ></div>
                                <div class="h-3 bg-muted rounded w-1/2"></div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {:else if isLoading}
        <div
            class="fixed bottom-4 right-4 bg-background border rounded-lg p-3 shadow-lg z-50"
        >
            <p class="text-sm text-muted-foreground">Refreshing tasks...</p>
        </div>
    {/if}
</div>

<!-- Task Drawer -->
<TaskDrawer
    bind:open={modals.editModalOpen}
    selectedTask={modals.selectedItem}
    onsave={handleTaskSave}
    onsavewithsubtasks={handleTaskSaveWithSubtasks}
    ondelete={handleTaskDelete}
    onclose={handleDrawerClose}
/>

<!-- Quick Add Dialog (for table view) -->
<QuickAddDialog
    bind:open={showQuickAddDialog}
    title="Quick Add Task"
    titleLabel="Task Title"
    titlePlaceholder="What needs to be done?"
    selectLabel="Category"
    selectOptions={categories.map((c) => ({ value: c.value, label: c.label }))}
    confirmText="Create Task"
    onconfirm={handleQuickAddDialogSubmit}
/>

<!-- Keyboard Shortcuts Dialog -->
<KeyboardShortcuts bind:open={showKeyboardShortcuts} />

<style>
    kbd {
        box-shadow:
            0 1px 0 rgba(0, 0, 0, 0.2),
            0 0 0 2px rgba(255, 255, 255, 0.7) inset;
    }
</style>

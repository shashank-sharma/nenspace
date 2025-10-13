<script lang="ts">
    import { format } from "date-fns";
    import * as Drawer from "$lib/components/ui/drawer";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import {
        X,
        Calendar,
        Trash2,
        Flame,
        AlertCircle,
        Zap,
        Check,
        ChevronDown,
        ChevronUp,
        Tag,
        Plus,
        CheckSquare,
        Circle,
        CheckCircle2,
        Repeat,
    } from "lucide-svelte";
    import DateTimePicker from "$lib/components/DateTimePicker.svelte";
    import {
        categories,
        categoryTextColors,
        categoryBorderColors,
    } from "../constants";
    import { required, validateWithToast } from "$lib/utils";
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import type { Task } from "../types";
    import { Badge } from "$lib/components/ui/badge";
    import { TasksService } from "../services";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";

    let {
        open = $bindable(),
        selectedTask = null,
        onsave,
        onsavewithsubtasks,
        ondelete,
        onclose,
    } = $props<{
        open?: boolean;
        selectedTask: Task | null;
        onsave?: (task: Partial<Task>) => void;
        onsavewithsubtasks?: (data: {
            task: Partial<Task>;
            pendingSubtasks: string[];
        }) => void;
        ondelete?: (taskId: string) => void;
        onclose?: () => void;
    }>();
    let taskDueDate = $state<Date | undefined>(undefined);
    let showDeleteDialog = $state(false);
    let showAdvanced = $state(false);

    // Detect if mobile or desktop
    let isMobile = $state(false);

    onMount(() => {
        // Initial check
        isMobile = window.innerWidth < 768; // md breakpoint

        // Listen for resize
        const handleResize = () => {
            isMobile = window.innerWidth < 768;
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    });

    // New features state
    let subtasks = $state<Task[]>([]);
    let newSubtaskTitle = $state("");
    let pendingSubtasks = $state<string[]>([]); // For create mode
    let tags = $state<string[]>([]);
    let newTag = $state("");
    let recurrenceFrequency = $state<
        "none" | "daily" | "weekly" | "monthly" | "yearly"
    >("none");
    let recurrenceInterval = $state(1);
    let recurrenceUntilDate = $state<Date | undefined>(undefined);

    let editedTask = $state<Task>({
        id: "",
        title: "",
        description: "",
        category: "focus",
        completed: false,
        priority: 1,
        due: "",
        reminder: false,
        created: "",
        updated: "",
        user: "",
        collectionId: "",
        collectionName: "",
        tags: [],
        parent_id: null,
        recurrence_frequency: "none",
        recurrence_interval: 1,
        recurrence_until: null,
        recurrence_parent: null,
    });

    const isCreateMode = $derived(!editedTask?.id);

    // Priority options with visual indicators
    const priorityOptions = [
        {
            value: 1,
            label: "Low",
            icon: "💤",
            color: "text-muted-foreground",
            bg: "bg-muted/50",
        },
        {
            value: 2,
            label: "Medium",
            icon: "⚡",
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-100 dark:bg-blue-900/30",
        },
        {
            value: 3,
            label: "High",
            icon: "🔥",
            color: "text-red-600 dark:text-red-400",
            bg: "bg-red-100 dark:bg-red-900/30",
        },
    ];

    // Watch for selectedTask changes
    $effect(() => {
        if (selectedTask && open) {
            editedTask = { ...selectedTask };
            taskDueDate = selectedTask.due
                ? new Date(selectedTask.due)
                : undefined;
            tags = selectedTask.tags || [];
            recurrenceFrequency = selectedTask.recurrence_frequency || "none";
            recurrenceInterval = selectedTask.recurrence_interval || 1;
            recurrenceUntilDate = selectedTask.recurrence_until
                ? new Date(selectedTask.recurrence_until)
                : undefined;

            // Load subtasks if editing
            if (selectedTask.id) {
                loadSubtasks(selectedTask.id);
            }
        } else if (open && !selectedTask) {
            // Reset form for new task
            editedTask = {
                id: "",
                title: "",
                description: "",
                category: "focus",
                completed: false,
                priority: 1,
                due: "",
                reminder: false,
                created: "",
                updated: "",
                user: "",
                collectionId: "",
                collectionName: "",
                tags: [],
                parent_id: null,
                recurrence_frequency: "none",
                recurrence_interval: 1,
                recurrence_until: null,
                recurrence_parent: null,
            };
            taskDueDate = undefined;
            tags = [];
            subtasks = [];
            pendingSubtasks = [];
            newSubtaskTitle = "";
            recurrenceFrequency = "none";
            recurrenceInterval = 1;
            recurrenceUntilDate = undefined;
            showAdvanced = false;
        }
    });

    async function handleSave() {
        // Validation using validation utility
        if (
            !validateWithToast(editedTask, {
                title: [required("Please enter a task title")],
            })
        ) {
            return;
        }

        const taskData = {
            ...editedTask,
            due: taskDueDate?.toISOString(),
            tags,
            recurrence_frequency: recurrenceFrequency,
            recurrence_interval: recurrenceInterval,
            recurrence_until: recurrenceUntilDate?.toISOString() || null,
        };

        // If creating a new task with pending subtasks
        if (isCreateMode && pendingSubtasks.length > 0) {
            onsavewithsubtasks?.({
                task: taskData,
                pendingSubtasks,
            });
        } else {
            onsave?.(taskData);
        }
    }

    function handleDelete() {
        ondelete?.(editedTask.id);
    }

    function handleClose() {
        onclose?.();
    }

    function togglePriority(priority: number) {
        editedTask.priority = priority;
    }

    function toggleComplete() {
        editedTask.completed = !editedTask.completed;
    }

    // Subtask management
    async function handleAddSubtask() {
        if (!newSubtaskTitle.trim()) return;

        // Create mode: add to pending list
        if (isCreateMode) {
            pendingSubtasks = [...pendingSubtasks, newSubtaskTitle.trim()];
            newSubtaskTitle = "";
            return;
        }

        // Edit mode: create subtask immediately
        if (!editedTask.id) return;

        try {
            const created = await TasksService.createSubtask(
                editedTask.id,
                newSubtaskTitle,
            );
            subtasks = [...subtasks, created];
            newSubtaskTitle = "";
        } catch (error) {
            console.error("Failed to add subtask:", error);
        }
    }

    function removePendingSubtask(index: number) {
        pendingSubtasks = pendingSubtasks.filter((_, i) => i !== index);
    }

    async function toggleSubtask(subtask: Task) {
        try {
            await TasksService.updateTask(subtask.id, {
                completed: !subtask.completed,
            });
            subtasks = subtasks.map((st) =>
                st.id === subtask.id ? { ...st, completed: !st.completed } : st,
            );
        } catch (error) {
            console.error("Failed to toggle subtask:", error);
        }
    }

    async function deleteSubtask(subtaskId: string) {
        try {
            await TasksService.deleteTask(subtaskId);
            subtasks = subtasks.filter((st) => st.id !== subtaskId);
        } catch (error) {
            console.error("Failed to delete subtask:", error);
        }
    }

    // Tag management
    function addTag() {
        const tag = newTag.trim();
        if (tag && !tags.includes(tag)) {
            tags = [...tags, tag];
            newTag = "";
        }
    }

    function removeTag(tag: string) {
        tags = tags.filter((t) => t !== tag);
    }

    function handleTagKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            addTag();
        }
    }

    // Quick keyboard shortcuts
    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSave();
        }
    }

    async function loadSubtasks(taskId: string) {
        try {
            subtasks = await TasksService.fetchSubtasks(taskId);
        } catch (error) {
            console.error("Failed to load subtasks:", error);
        }
    }
</script>

{#snippet formContent()}
    <div
        class="space-y-4 overflow-y-auto"
        style="max-height: calc(100vh - 200px)"
        onkeydown={handleKeydown}
        role="form"
        tabindex="-1"
    >
        <!-- Title & Description -->
        <div class="space-y-3">
            <Input
                placeholder="What needs to be done?"
                bind:value={editedTask.title}
                class="text-lg font-medium"
                autofocus
            />
            <Textarea
                placeholder="Add more details... (optional)"
                bind:value={editedTask.description}
                class="min-h-[80px] resize-none"
                rows={3}
            />
        </div>

        <!-- Grid Layout for Desktop -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Priority -->
            <div class="space-y-2">
                <div
                    class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                >
                    <Flame class="h-3.5 w-3.5" />
                    Priority
                </div>
                <div class="grid grid-cols-3 gap-2">
                    {#each priorityOptions as option}
                        <button
                            onclick={() => togglePriority(option.value)}
                            class="p-3 rounded-lg border-2 transition-all hover:scale-105
                                   {editedTask.priority === option.value
                                ? `${option.bg} border-current ${option.color}`
                                : 'border-muted bg-muted/20 hover:bg-muted/40'}"
                        >
                            <div class="text-2xl mb-1">{option.icon}</div>
                            <div class="text-[10px] font-medium">
                                {option.label}
                            </div>
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Due Date -->
            <div class="space-y-2">
                <div
                    class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                >
                    <Calendar class="h-3.5 w-3.5" />
                    Due Date
                </div>
                <DateTimePicker on:change={(e) => (taskDueDate = e.detail)} />
                {#if taskDueDate}
                    <div class="flex items-center gap-2">
                        <Badge variant="outline" class="text-xs">
                            {taskDueDate.toLocaleDateString()} at {taskDueDate.toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                            )}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            class="h-6 text-xs"
                            on:click={() => (taskDueDate = undefined)}
                        >
                            Clear
                        </Button>
                    </div>
                {/if}
            </div>

            <!-- Category -->
            <div class="space-y-2">
                <div
                    class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                >
                    <Tag class="h-3.5 w-3.5" />
                    Category
                </div>
                <div class="grid grid-cols-2 gap-2">
                    {#each categories as cat}
                        <button
                            onclick={() => (editedTask.category = cat.value)}
                            class="p-2 rounded-lg border-2 text-left transition-all hover:scale-105
                                   {editedTask.category === cat.value
                                ? `border-current ${categoryTextColors[cat.value]} ${cat.color}`
                                : 'border-muted bg-muted/20 hover:bg-muted/40'}"
                        >
                            <div class="font-medium text-xs">
                                {cat.label}
                            </div>
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Tags -->
            <div class="space-y-2">
                <div
                    class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                >
                    <Tag class="h-3.5 w-3.5" />
                    Tags
                </div>
                <div class="space-y-2">
                    <div class="flex flex-wrap gap-1.5 min-h-[32px]">
                        {#each tags as tag}
                            <Badge
                                variant="secondary"
                                class="text-xs py-1 px-2 gap-1"
                            >
                                {tag}
                                <button
                                    onclick={() => removeTag(tag)}
                                    class="ml-0.5 hover:text-destructive"
                                    aria-label="Remove tag"
                                >
                                    ×
                                </button>
                            </Badge>
                        {/each}
                    </div>
                    <div class="flex gap-2">
                        <Input
                            placeholder="Add tag..."
                            bind:value={newTag}
                            onkeydown={handleTagKeydown}
                            class="h-8 text-xs flex-1"
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            on:click={addTag}
                            class="h-8 w-8 p-0"
                            disabled={!newTag.trim()}
                        >
                            <Plus class="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Recurrence (Full Width) -->
        <div class="space-y-2">
            <div
                class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
                <Repeat class="h-3.5 w-3.5" />
                Repeat
            </div>
            <div class="flex gap-2">
                <select
                    bind:value={recurrenceFrequency}
                    class="h-9 text-sm flex-1 rounded-md border border-input bg-background px-3"
                >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                </select>

                {#if recurrenceFrequency !== "none"}
                    <Input
                        type="number"
                        bind:value={recurrenceInterval}
                        min="1"
                        class="h-9 w-24 text-sm"
                        placeholder="Every"
                    />
                {/if}
            </div>
            {#if recurrenceFrequency !== "none"}
                <div class="space-y-2 pt-2 pl-4 border-l-2 border-muted">
                    <p class="text-xs text-muted-foreground">
                        Task will repeat every {recurrenceInterval}
                        {recurrenceFrequency === "daily"
                            ? "day(s)"
                            : recurrenceFrequency === "weekly"
                              ? "week(s)"
                              : recurrenceFrequency === "monthly"
                                ? "month(s)"
                                : "year(s)"}
                    </p>
                    <div class="space-y-1.5">
                        <p class="text-xs font-medium text-muted-foreground">
                            Repeat until (optional):
                        </p>
                        <DateTimePicker
                            on:change={(e) => (recurrenceUntilDate = e.detail)}
                        />
                        {#if recurrenceUntilDate}
                            <div class="flex items-center gap-2">
                                <Badge variant="secondary" class="text-xs">
                                    Ends {recurrenceUntilDate.toLocaleDateString()}
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="h-6 text-xs"
                                    on:click={() =>
                                        (recurrenceUntilDate = undefined)}
                                >
                                    Clear
                                </Button>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>

        <!-- Subtasks (Full Width) -->
        <div class="space-y-2">
            <div
                class="flex items-center justify-between text-xs font-medium text-muted-foreground"
            >
                <div class="flex items-center gap-1.5">
                    <CheckSquare class="h-3.5 w-3.5" />
                    {#if isCreateMode}
                        Subtasks ({pendingSubtasks.length})
                    {:else}
                        Subtasks ({subtasks.filter((st) => st.completed).length}
                        / {subtasks.length})
                    {/if}
                </div>
            </div>

            <div class="space-y-2">
                {#if isCreateMode}
                    <!-- Pending subtasks in create mode -->
                    {#each pendingSubtasks as pendingSubtask, index}
                        <div
                            class="flex items-center gap-2 p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors group"
                        >
                            <Circle class="h-4 w-4 text-muted-foreground" />
                            <span class="flex-1 text-sm">
                                {pendingSubtask}
                            </span>
                            <button
                                onclick={() => removePendingSubtask(index)}
                                class="opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Remove subtask"
                            >
                                <X class="h-3.5 w-3.5 text-destructive" />
                            </button>
                        </div>
                    {/each}
                {:else}
                    <!-- Actual subtasks in edit mode -->
                    {#each subtasks as subtask}
                        <div
                            class="flex items-center gap-2 p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors group"
                        >
                            <button
                                onclick={() => toggleSubtask(subtask)}
                                class="flex-shrink-0"
                                aria-label="Toggle subtask"
                            >
                                {#if subtask.completed}
                                    <CheckCircle2
                                        class="h-4 w-4 text-green-500"
                                    />
                                {:else}
                                    <Circle
                                        class="h-4 w-4 text-muted-foreground"
                                    />
                                {/if}
                            </button>
                            <span
                                class="flex-1 text-sm {subtask.completed
                                    ? 'line-through text-muted-foreground'
                                    : ''}"
                            >
                                {subtask.title}
                            </span>
                            <button
                                onclick={() => deleteSubtask(subtask.id)}
                                class="opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Delete subtask"
                            >
                                <X class="h-3.5 w-3.5 text-destructive" />
                            </button>
                        </div>
                    {/each}
                {/if}

                <!-- Add subtask input -->
                <div class="flex gap-2">
                    <Input
                        placeholder="Add subtask..."
                        bind:value={newSubtaskTitle}
                        onkeydown={(e) =>
                            e.key === "Enter" && handleAddSubtask()}
                        class="h-9 text-sm flex-1"
                    />
                    <Button
                        size="sm"
                        variant="ghost"
                        on:click={handleAddSubtask}
                        class="h-9 w-9 p-0"
                        disabled={!newSubtaskTitle.trim()}
                    >
                        <Plus class="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    </div>
{/snippet}

{#snippet headerContent()}
    <div class="flex items-center gap-3">
        {#if !isCreateMode}
            <button
                onclick={toggleComplete}
                class="flex-shrink-0 hover:scale-110 transition-transform"
                aria-label="Toggle complete"
            >
                {#if editedTask.completed}
                    <div
                        class="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
                    >
                        <Check
                            class="h-5 w-5 text-green-600 dark:text-green-400"
                        />
                    </div>
                {:else}
                    <div
                        class="h-8 w-8 rounded-full border-2 border-muted-foreground/30 hover:border-primary transition-colors"
                    ></div>
                {/if}
            </button>
        {/if}
        <div>
            <p class="text-xl md:text-2xl font-bold">
                {isCreateMode ? "New Task" : "Edit Task"}
            </p>
            {#if !isCreateMode && editedTask.created}
                <p class="text-xs text-muted-foreground mt-0.5">
                    Created {new Date(editedTask.created).toLocaleDateString()}
                </p>
            {/if}
        </div>
    </div>
{/snippet}

<!-- Mobile: Drawer -->
{#if isMobile}
    <Drawer.Root bind:open>
        <Drawer.Content class="max-h-[90vh]">
            <Drawer.Header class="border-b pb-3 pt-4">
                <div class="flex items-center justify-between">
                    {@render headerContent()}
                    <Button variant="ghost" size="icon" on:click={handleClose}>
                        <X class="h-4 w-4" />
                    </Button>
                </div>
            </Drawer.Header>

            <div class="p-4">
                {@render formContent()}
            </div>

            <Drawer.Footer class="border-t pt-3 flex-row gap-2">
                {#if !isCreateMode}
                    <Button
                        variant="destructive"
                        size="sm"
                        on:click={() => (showDeleteDialog = true)}
                        class="flex-shrink-0"
                    >
                        <Trash2 class="h-4 w-4" />
                    </Button>
                {/if}
                <Button
                    variant="outline"
                    size="sm"
                    on:click={handleClose}
                    class="flex-1"
                >
                    Cancel
                </Button>
                <Button
                    size="sm"
                    on:click={handleSave}
                    disabled={!editedTask.title.trim()}
                    class="flex-1"
                >
                    {isCreateMode ? "Create" : "Save"}
                </Button>
            </Drawer.Footer>
        </Drawer.Content>
    </Drawer.Root>
{:else}
    <!-- Desktop: Modal Dialog -->
    <Dialog.Root bind:open>
        <Dialog.Content class="max-w-3xl max-h-[90vh] p-0">
            <Dialog.Header class="border-b pb-4 pt-6 px-6">
                <div class="flex items-center justify-between">
                    {@render headerContent()}
                </div>
            </Dialog.Header>

            <div class="px-6 py-4">
                {@render formContent()}
            </div>

            <div class="border-t px-6 py-4 flex items-center justify-between">
                <div>
                    {#if !isCreateMode}
                        <Button
                            variant="destructive"
                            size="sm"
                            on:click={() => (showDeleteDialog = true)}
                        >
                            <Trash2 class="h-4 w-4 mr-2" />
                            Delete Task
                        </Button>
                    {/if}
                </div>
                <div class="flex gap-2">
                    <Button variant="outline" on:click={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        on:click={handleSave}
                        disabled={!editedTask.title.trim()}
                    >
                        {isCreateMode ? "Create Task" : "Save Changes"}
                    </Button>
                </div>
            </div>
        </Dialog.Content>
    </Dialog.Root>
{/if}

<!-- Confirm Delete Dialog -->
<AlertDialog.Root bind:open={showDeleteDialog}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Delete Task</AlertDialog.Title>
            <AlertDialog.Description>
                Are you sure you want to delete "{editedTask.title}"?
                <p class="text-sm text-destructive mt-2">
                    This action cannot be undone. All subtasks will also be
                    deleted.
                </p>
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel on:click={() => (showDeleteDialog = false)}>
                Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
                on:click={handleDelete}
                class="bg-destructive text-destructive-foreground"
            >
                Delete
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>

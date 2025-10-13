<script lang="ts">
    import type { TaskFilter } from "../types";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Badge } from "$lib/components/ui/badge";
    import * as Select from "$lib/components/ui/select";
    import { Search, X, Filter } from "lucide-svelte";
    import { createEventDispatcher } from "svelte";

    let { filter = $bindable({}) } = $props<{
        filter?: TaskFilter;
    }>();

    const dispatch = createEventDispatcher();

    // Active filters count
    const activeFiltersCount = $derived(
        Object.values(filter).filter(
            (v) => v !== null && v !== undefined && v !== "",
        ).length,
    );

    function clearAllFilters() {
        filter = { searchQuery: "" };
        dispatch("change", filter);
    }

    function removeFilter(key: keyof TaskFilter) {
        filter = { ...filter, [key]: key === "searchQuery" ? "" : null };
        dispatch("change", filter);
    }

    function updateFilter(key: keyof TaskFilter, value: any) {
        filter = { ...filter, [key]: value };
        dispatch("change", filter);
    }
</script>

<div class="filter-bar space-y-4">
    <!-- Search and Filters Row -->
    <div class="flex flex-col sm:flex-row gap-3">
        <!-- Search -->
        <div class="relative flex-1">
            <Search
                class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
                type="text"
                placeholder="Search tasks... (Press / to focus)"
                class="pl-10 pr-10"
                bind:value={filter.searchQuery}
                oninput={() => dispatch("change", filter)}
            />
            {#if filter.searchQuery}
                <button
                    class="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-accent rounded p-1 transition-colors"
                    onclick={() => removeFilter("searchQuery")}
                    aria-label="Clear search"
                >
                    <X class="h-4 w-4" />
                </button>
            {/if}
        </div>

        <!-- Priority Filter -->
        <Select.Root
            onSelectedChange={(selected) => {
                const value = selected?.value as string;
                updateFilter(
                    "priority",
                    value === "all" ? null : parseInt(value),
                );
            }}
        >
            <Select.Trigger class="w-full sm:w-[180px]">
                <Filter class="h-4 w-4 mr-2" />
                <Select.Value placeholder="Priority" />
            </Select.Trigger>
            <Select.Content>
                <Select.Item value="all">All Priorities</Select.Item>
                <Select.Item value="3">High</Select.Item>
                <Select.Item value="2">Medium</Select.Item>
                <Select.Item value="1">Low</Select.Item>
            </Select.Content>
        </Select.Root>

        <!-- Due Date Filter -->
        <Select.Root
            onSelectedChange={(selected) => {
                const value = selected?.value;
                updateFilter("dueDate", value === "all" ? null : value);
            }}
        >
            <Select.Trigger class="w-full sm:w-[180px]">
                <Select.Value placeholder="Due Date" />
            </Select.Trigger>
            <Select.Content>
                <Select.Item value="all">All Dates</Select.Item>
                <Select.Item value="overdue">⏰ Overdue</Select.Item>
                <Select.Item value="today">📅 Today</Select.Item>
                <Select.Item value="week">📆 This Week</Select.Item>
            </Select.Content>
        </Select.Root>

        <!-- Status Filter -->
        <Select.Root
            onSelectedChange={(selected) => {
                const value = selected?.value;
                updateFilter("status", value === "all" ? null : value);
            }}
        >
            <Select.Trigger class="w-full sm:w-[180px]">
                <Select.Value placeholder="Status" />
            </Select.Trigger>
            <Select.Content>
                <Select.Item value="all">All Tasks</Select.Item>
                <Select.Item value="active">Active</Select.Item>
                <Select.Item value="completed">Completed</Select.Item>
            </Select.Content>
        </Select.Root>
    </div>

    <!-- Active Filters -->
    {#if activeFiltersCount > 0}
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted-foreground">Active filters:</span>

            {#if filter.priority}
                <Badge variant="secondary" class="gap-1">
                    Priority: {filter.priority === 3
                        ? "High"
                        : filter.priority === 2
                          ? "Medium"
                          : "Low"}
                    <button
                        onclick={() => removeFilter("priority")}
                        class="ml-1 hover:bg-accent rounded-full"
                    >
                        <X class="h-3 w-3" />
                    </button>
                </Badge>
            {/if}

            {#if filter.dueDate}
                <Badge variant="secondary" class="gap-1">
                    Due: {filter.dueDate === "overdue"
                        ? "Overdue"
                        : filter.dueDate === "today"
                          ? "Today"
                          : "This Week"}
                    <button
                        onclick={() => removeFilter("dueDate")}
                        class="ml-1 hover:bg-accent rounded-full"
                    >
                        <X class="h-3 w-3" />
                    </button>
                </Badge>
            {/if}

            {#if filter.status}
                <Badge variant="secondary" class="gap-1">
                    {filter.status === "active" ? "Active" : "Completed"}
                    <button
                        onclick={() => removeFilter("status")}
                        class="ml-1 hover:bg-accent rounded-full"
                    >
                        <X class="h-3 w-3" />
                    </button>
                </Badge>
            {/if}

            <Button
                variant="ghost"
                size="sm"
                onclick={clearAllFilters}
                class="h-6 text-xs"
            >
                Clear all
            </Button>
        </div>
    {/if}
</div>

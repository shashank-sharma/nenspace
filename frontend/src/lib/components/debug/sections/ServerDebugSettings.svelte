<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { serverStore } from "$lib/features/servers/stores";
    import { ServerService } from "$lib/features/servers/services";
    import { toast } from "svelte-sonner";
    import { RefreshCw, Server, Loader2, Trash2 } from "lucide-svelte";
    import { format } from "date-fns";

    async function handleForceRefresh() {
        try {
            await serverStore.refreshServers();
            toast.success("Servers refreshed");
        } catch (error) {
            toast.error("Failed to refresh servers");
            console.error(error);
        }
    }

    async function handleClearCache() {
        ServerService.clearCache();
        toast.success("Cache cleared");
    }

    async function handleResetFilters() {
        serverStore.clearFilter();
        await serverStore.fetchServers(true);
        toast.success("Filters reset");
    }
</script>

<div class="space-y-4">
    <!-- Server Status -->
    <div class="space-y-2">
        <div class="flex items-center justify-between">
            <h4 class="text-sm font-medium">Server Status</h4>
            <Button
                variant="ghost"
                size="sm"
                on:click={handleForceRefresh}
                disabled={serverStore.isRefreshing || serverStore.isLoading}
            >
                {#if serverStore.isRefreshing || serverStore.isLoading}
                    <Loader2 class="h-3 w-3 mr-2 animate-spin" />
                {:else}
                    <RefreshCw class="h-3 w-3 mr-2" />
                {/if}
                Force Refresh
            </Button>
        </div>

        <div class="space-y-1 text-xs">
            <div class="flex justify-between">
                <span class="text-muted-foreground">Total:</span>
                <span class="font-medium">{serverStore.totalItems}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Loaded:</span>
                <span class="font-medium">{serverStore.servers.length}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Active:</span>
                <span class="font-medium text-green-600 dark:text-green-500">
                    {serverStore.activeCount}
                </span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Inactive:</span>
                <span class="font-medium text-muted-foreground">
                    {serverStore.inactiveCount}
                </span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Reachable:</span>
                <span class="font-medium text-green-600 dark:text-green-500">
                    {serverStore.reachableCount}
                </span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Unreachable:</span>
                <span class="font-medium text-red-600 dark:text-red-500">
                    {serverStore.unreachableCount}
                </span>
            </div>
        </div>
    </div>

    <!-- Filter Status -->
    <div class="space-y-2">
        <h4 class="text-sm font-medium">Current Filters</h4>
        <div class="space-y-1 text-xs">
            <div class="flex justify-between">
                <span class="text-muted-foreground">Search Query:</span>
                <span class="font-medium">
                    {serverStore.filter.searchQuery || "None"}
                </span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Active Status:</span>
                <span class="font-medium">
                    {serverStore.filter.isActive !== undefined
                        ? serverStore.filter.isActive
                            ? "Active"
                            : "Inactive"
                        : "All"}
                </span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Reachability:</span>
                <span class="font-medium">
                    {serverStore.filter.isReachable !== undefined
                        ? serverStore.filter.isReachable
                            ? "Reachable"
                            : "Unreachable"
                        : "All"}
                </span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Provider:</span>
                <span class="font-medium">
                    {serverStore.filter.provider || "All"}
                </span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">SSH Enabled:</span>
                <span class="font-medium">
                    {serverStore.filter.sshEnabled !== undefined
                        ? serverStore.filter.sshEnabled
                            ? "Yes"
                            : "No"
                        : "All"}
                </span>
            </div>
        </div>
    </div>

    <!-- Sort Options -->
    <div class="space-y-2">
        <h4 class="text-sm font-medium">Sort Options</h4>
        <div class="space-y-1 text-xs">
            <div class="flex justify-between">
                <span class="text-muted-foreground">Field:</span>
                <span class="font-medium">{serverStore.sortOptions.field}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Order:</span>
                <span class="font-medium">{serverStore.sortOptions.order}</span>
            </div>
        </div>
    </div>

    <!-- Loading State -->
    <div class="space-y-2">
        <h4 class="text-sm font-medium">Loading State</h4>
        <div class="space-y-1 text-xs">
            <div class="flex justify-between">
                <span class="text-muted-foreground">Is Loading:</span>
                <span class="font-medium">
                    {serverStore.isLoading ? "Yes" : "No"}
                </span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Is Refreshing:</span>
                <span class="font-medium">
                    {serverStore.isRefreshing ? "Yes" : "No"}
                </span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Has More Pages:</span>
                <span class="font-medium">
                    {serverStore.hasMorePages ? "Yes" : "No"}
                </span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Current Page:</span>
                <span class="font-medium">{serverStore.page}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Per Page:</span>
                <span class="font-medium">{serverStore.perPage}</span>
            </div>
        </div>
    </div>

    <!-- Error State -->
    {#if serverStore.error}
        <div class="space-y-2">
            <h4 class="text-sm font-medium text-destructive">Error</h4>
            <div class="text-xs text-destructive bg-destructive/10 p-2 rounded">
                {serverStore.error}
            </div>
        </div>
    {/if}

    <!-- Actions -->
    <div class="space-y-2 pt-2 border-t border-border">
        <h4 class="text-sm font-medium">Actions</h4>
        <div class="flex flex-col gap-2">
            <Button
                variant="outline"
                size="sm"
                class="w-full justify-start"
                on:click={handleClearCache}
            >
                <Trash2 class="h-3 w-3 mr-2" />
                Clear Cache
            </Button>
            <Button
                variant="outline"
                size="sm"
                class="w-full justify-start"
                on:click={handleResetFilters}
            >
                <RefreshCw class="h-3 w-3 mr-2" />
                Reset Filters
            </Button>
        </div>
    </div>
</div>


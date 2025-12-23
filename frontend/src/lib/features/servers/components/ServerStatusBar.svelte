<script lang="ts">
    import { Card, CardContent } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { serverStore } from "../stores";
    import { DateUtil } from "$lib/utils";
    import { Server, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-svelte";
    import { cn } from "$lib/utils";
    import { toast } from "svelte-sonner";

    const totalCount = $derived(serverStore.totalItems);
    const activeCount = $derived(serverStore.activeCount);
    const inactiveCount = $derived(serverStore.inactiveCount);
    const reachableCount = $derived(serverStore.reachableCount);
    const unreachableCount = $derived(serverStore.unreachableCount);
    const isLoading = $derived(serverStore.isLoading);
    const isRefreshing = $derived(serverStore.isRefreshing);
    const error = $derived(serverStore.error);

    async function handleRefresh() {
        try {
            await serverStore.refreshServers();
            toast.success("Servers refreshed");
        } catch (error) {
            toast.error("Failed to refresh servers");
        }
    }
</script>

<Card class="server-status-card">
    <CardContent class="p-4">
        <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-6">
                <div class="flex items-center gap-2">
                    <Server class="h-4 w-4 text-muted-foreground" />
                    <span class="text-sm font-medium">
                        {totalCount.toLocaleString()} {totalCount === 1 ? 'server' : 'servers'}
                    </span>
                </div>
                
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <CheckCircle2 class="h-4 w-4 text-green-600 dark:text-green-500" />
                        <span class="text-xs text-muted-foreground">
                            {activeCount} active
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <XCircle class="h-4 w-4 text-muted-foreground" />
                        <span class="text-xs text-muted-foreground">
                            {inactiveCount} inactive
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <CheckCircle2 class="h-4 w-4 text-green-600 dark:text-green-500" />
                        <span class="text-xs text-muted-foreground">
                            {reachableCount} reachable
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <XCircle class="h-4 w-4 text-red-600 dark:text-red-500" />
                        <span class="text-xs text-muted-foreground">
                            {unreachableCount} unreachable
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="flex items-center gap-2">
                {#if error}
                    <div class="flex items-center gap-2 text-xs text-destructive" title={error}>
                        <XCircle class="h-4 w-4" />
                        <span class="max-w-md truncate">Error</span>
                    </div>
                {/if}
                
                <Button
                    size="sm"
                    variant="outline"
                    on:click={handleRefresh}
                    disabled={isRefreshing || isLoading}
                    class="h-8"
                >
                    <RefreshCw class={cn("h-4 w-4 mr-2", (isRefreshing || isLoading) && "animate-spin")} />
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>
        </div>
    </CardContent>
</Card>

<style>
    .server-status-card {
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }
</style>


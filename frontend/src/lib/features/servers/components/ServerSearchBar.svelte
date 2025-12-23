<script lang="ts">
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Search, RefreshCw, X } from "lucide-svelte";
    import { serverStore } from "../stores";
    import { cn } from "$lib/utils";

    let searchQuery = $state("");
    const isLoading = $derived(serverStore.isLoading);
    const isRefreshing = $derived(serverStore.isRefreshing);
    const filter = $derived(serverStore.filter);

    $effect(() => {
        const query = searchQuery;
        if (query === undefined || query === null || query === "") {
            if (serverStore.filter.searchQuery) {
                serverStore.setFilter({ searchQuery: undefined });
                serverStore.fetchServers(true);
            }
            return;
        }
        
        const timeoutId = setTimeout(() => {
            serverStore.searchServers(query);
        }, 300);

        return () => {
            clearTimeout(timeoutId);
        };
    });

    async function handleRefresh() {
        await serverStore.refreshServers();
    }

    function clearSearch() {
        searchQuery = "";
        serverStore.setFilter({ searchQuery: undefined });
        serverStore.fetchServers(true);
    }

    function clearFilter(key: keyof typeof filter) {
        serverStore.setFilter({ [key]: undefined });
        serverStore.fetchServers(true);
    }

    const hasActiveFilters = $derived(
        filter.isActive !== undefined ||
        filter.isReachable !== undefined ||
        filter.provider !== undefined ||
        filter.sshEnabled !== undefined ||
        filter.searchQuery !== undefined
    );
</script>

<Card class="server-search-card">
    <CardContent class="p-4">
        <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
                <div class="relative flex-1">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search servers by name, IP, or provider..."
                        bind:value={searchQuery}
                        class="pl-9"
                    />
                    {#if searchQuery}
                        <Button
                            variant="ghost"
                            size="icon"
                            class="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            on:click={clearSearch}
                        >
                            <X class="h-3 w-3" />
                        </Button>
                    {/if}
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    on:click={handleRefresh}
                    disabled={isRefreshing || isLoading}
                    title="Refresh"
                >
                    <RefreshCw
                        class={cn("h-4 w-4", (isRefreshing || isLoading) && "animate-spin")}
                    />
                </Button>
            </div>

            {#if hasActiveFilters}
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs text-muted-foreground">Active filters:</span>
                    {#if filter.isActive !== undefined}
                        <Badge variant="secondary" class="gap-1">
                            {filter.isActive ? "Active" : "Inactive"}
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-4 w-4 p-0 hover:bg-transparent"
                                on:click={() => clearFilter("isActive")}
                            >
                                <X class="h-3 w-3" />
                            </Button>
                        </Badge>
                    {/if}
                    {#if filter.isReachable !== undefined}
                        <Badge variant="secondary" class="gap-1">
                            {filter.isReachable ? "Reachable" : "Unreachable"}
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-4 w-4 p-0 hover:bg-transparent"
                                on:click={() => clearFilter("isReachable")}
                            >
                                <X class="h-3 w-3" />
                            </Button>
                        </Badge>
                    {/if}
                    {#if filter.provider}
                        <Badge variant="secondary" class="gap-1">
                            Provider: {filter.provider}
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-4 w-4 p-0 hover:bg-transparent"
                                on:click={() => clearFilter("provider")}
                            >
                                <X class="h-3 w-3" />
                            </Button>
                        </Badge>
                    {/if}
                    {#if filter.sshEnabled !== undefined}
                        <Badge variant="secondary" class="gap-1">
                            {filter.sshEnabled ? "SSH Enabled" : "SSH Disabled"}
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-4 w-4 p-0 hover:bg-transparent"
                                on:click={() => clearFilter("sshEnabled")}
                            >
                                <X class="h-3 w-3" />
                            </Button>
                        </Badge>
                    {/if}
                    <Button
                        variant="ghost"
                        size="sm"
                        class="h-6 text-xs"
                        on:click={() => {
                            serverStore.clearFilter();
                            searchQuery = "";
                            serverStore.fetchServers(true);
                        }}
                    >
                        Clear all
                    </Button>
                </div>
            {/if}
        </div>
    </CardContent>
</Card>

<style>
    .server-search-card {
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }
</style>


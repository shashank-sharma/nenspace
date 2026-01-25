<script lang="ts">
    import { onMount } from "svelte";
    import {
        CloudOff,
        RefreshCw,
        CheckCircle,
        AlertCircle,
        UtensilsCrossed,
        CheckSquare,
    } from "lucide-svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import * as Popover from "$lib/components/ui/popover";
    import { UnifiedSyncService } from "$lib/services/unified-sync.service.svelte";
    import type { UnifiedPendingItem } from "$lib/services/unified-sync.service.svelte";
    import { NetworkService } from "$lib/services/network.service.svelte";
    import { toast } from "svelte-sonner";

    // State
    let open = $state(false);
    let pendingItems = $state<UnifiedPendingItem[]>([]);
    let isLoading = $state(false);

    const syncStatus = $derived(UnifiedSyncService.syncStatus);
    const isOnline = $derived(NetworkService.isOnline);
    const totalPending = $derived(
        syncStatus.pendingCount + syncStatus.failedCount,
    );
    const isSyncing = $derived(syncStatus.isSyncing);

    // Load pending items when popover opens
    async function loadPendingItems() {
        if (!open) return;

        isLoading = true;
        try {
            pendingItems = await UnifiedSyncService.getAllPendingItems();
        } catch (error) {
            console.error("Failed to load pending items:", error);
            toast.error("Failed to load pending items");
        } finally {
            isLoading = false;
        }
    }

    // Sync all items
    async function handleSyncAll() {
        if (!isOnline) {
            toast.error("Cannot sync while offline");
            return;
        }

        const initialPendingCount = totalPending;

        try {
            await UnifiedSyncService.syncAll();

            // Reload pending items
            await loadPendingItems();

            // Show success toast
            if (syncStatus.failedCount === 0) {
                toast.success(
                    `✅ Successfully synced ${initialPendingCount} ${initialPendingCount === 1 ? "item" : "items"}`,
                );
            } else if (syncStatus.failedCount < initialPendingCount) {
                toast.warning(
                    `Synced ${initialPendingCount - syncStatus.failedCount} items, ${syncStatus.failedCount} failed`,
                );
            }
        } catch (error) {
            console.error("Sync failed:", error);
            toast.error("Failed to sync items");
        }
    }

    // Retry failed items
    async function handleRetryFailed() {
        if (!isOnline) {
            toast.error("Cannot sync while offline");
            return;
        }

        try {
            await UnifiedSyncService.retryAllFailed();
            await loadPendingItems();
        } catch (error) {
            console.error("Retry failed:", error);
        }
    }

    // Type-specific icons and labels
    const typeConfig: Record<string, { icon: any; label: string }> = {
        "food-log": { icon: UtensilsCrossed, label: "Food Log" },
        task: { icon: CheckSquare, label: "Task" },
        tasks: { icon: CheckSquare, label: "Task" }, // Alias
    };

    function getItemIcon(type: string) {
        return typeConfig[type]?.icon || CheckCircle;
    }

    function getTypeLabel(type: string) {
        return (
            typeConfig[type]?.label ||
            type
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")
        );
    }

    // Watch for open changes
    $effect(() => {
        if (open) {
            loadPendingItems();
        }
    });

    // Auto-refresh when sync completes
    $effect(() => {
        // When pending count goes to 0, close popover
        if (totalPending === 0 && open) {
            setTimeout(() => {
                open = false;
            }, 1000);
        }
    });
</script>

{#if totalPending > 0}
    <Popover.Root bind:open>
        <Popover.Trigger>
            <Button
                variant="ghost"
                size="icon"
                class="relative"
                title="Pending sync items"
            >
                {#if isSyncing}
                    <RefreshCw class="h-5 w-5 animate-spin text-blue-500" />
                {:else if !isOnline}
                    <CloudOff class="h-5 w-5 text-orange-500" />
                {:else if syncStatus.failedCount > 0}
                    <AlertCircle class="h-5 w-5 text-red-500" />
                {:else}
                    <RefreshCw class="h-5 w-5 text-orange-500" />
                {/if}

                {#if totalPending > 0}
                    <Badge
                        variant={syncStatus.failedCount > 0
                            ? "destructive"
                            : "default"}
                        class="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                        {totalPending}
                    </Badge>
                {/if}
            </Button>
        </Popover.Trigger>
        <Popover.Content class="w-80" align="end">
            <div class="space-y-4">
                <div class="space-y-2">
                    <h4 class="font-medium leading-none">Pending Sync</h4>
                    <p class="text-sm text-muted-foreground">
                        {totalPending}
                        {totalPending === 1 ? "item" : "items"} waiting to sync
                    </p>
                    {#if syncStatus.failedCount > 0}
                        <p class="text-sm text-red-600 dark:text-red-400">
                            {syncStatus.failedCount} failed
                        </p>
                    {/if}
                </div>

                {#if isLoading}
                    <div class="flex justify-center py-4">
                        <RefreshCw
                            class="h-6 w-6 animate-spin text-muted-foreground"
                        />
                    </div>
                {:else if pendingItems.length === 0}
                    <div class="text-center py-4 text-sm text-muted-foreground">
                        No pending items
                    </div>
                {:else}
                    <div class="max-h-60 overflow-y-auto space-y-2">
                        {#each pendingItems as item}
                            <div
                                class="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-sm"
                            >
                                <div class="flex-shrink-0 mt-0.5">
                                    {#if item.syncStatus === "failed"}
                                        <AlertCircle
                                            class="h-4 w-4 text-red-500"
                                        />
                                    {:else}
                                        {@const IconComponent = getItemIcon(
                                            item.type,
                                        )}
                                        <IconComponent
                                            class="h-4 w-4 text-muted-foreground"
                                        />
                                    {/if}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="font-medium truncate">
                                        {item.title}
                                    </p>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        <Badge
                                            variant="outline"
                                            class="text-[10px] py-0 px-1"
                                        >
                                            {getTypeLabel(item.type)}
                                        </Badge>
                                        {#if item.category}
                                            <span
                                                class="text-xs text-muted-foreground"
                                            >
                                                {item.category}
                                            </span>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}

                <div class="space-y-2">
                    {#if !isOnline}
                        <div
                            class="flex items-center gap-2 p-2 rounded-md bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400"
                        >
                            <CloudOff class="h-4 w-4" />
                            <span class="text-sm">You're offline</span>
                        </div>
                    {/if}

                    <Button
                        class="w-full"
                        onclick={handleSyncAll}
                        disabled={isSyncing || !isOnline}
                    >
                        {#if isSyncing}
                            <RefreshCw class="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                        {:else}
                            <RefreshCw class="h-4 w-4 mr-2" />
                            Sync All Now
                        {/if}
                    </Button>

                    {#if syncStatus.failedCount > 0}
                        <Button
                            class="w-full"
                            variant="outline"
                            onclick={handleRetryFailed}
                            disabled={isSyncing || !isOnline}
                        >
                            <AlertCircle class="h-4 w-4 mr-2" />
                            Retry Failed ({syncStatus.failedCount})
                        </Button>
                    {/if}
                </div>
            </div>
        </Popover.Content>
    </Popover.Root>
{/if}

<script lang="ts">
    import { FoodLogSyncService } from "../services/food-log-sync.service.svelte";
    import { NetworkService } from "$lib/services/network.service.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import {
        RefreshCw,
        WifiOff,
        Check,
        AlertCircle,
        Cloud,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";

    const syncStatus = $derived(FoodLogSyncService.syncStatus);
    const isOnline = $derived(NetworkService.isOnline);
    const isSyncing = $derived(FoodLogSyncService.isSyncing);

    function handleManualSync() {
        FoodLogSyncService.forceSyncNow();
    }

    function handleRetryFailed() {
        FoodLogSyncService.retryFailedSyncs();
    }
</script>

<div class="flex items-center gap-2">
    <!-- Online/Offline Status -->
    {#if !isOnline}
        <Badge variant="destructive" class="flex items-center gap-1">
            <WifiOff class="h-3 w-3" />
            Offline
        </Badge>
    {:else}
        <Badge variant="secondary" class="flex items-center gap-1">
            <Check class="h-3 w-3" />
            Online
        </Badge>
    {/if}

    <!-- Pending Count -->
    {#if syncStatus.pendingCount > 0}
        <Badge variant="outline" class="flex items-center gap-1">
            <Cloud class="h-3 w-3" />
            {syncStatus.pendingCount}
            {syncStatus.pendingCount === 1 ? "pending" : "pending"}
        </Badge>
    {/if}

    <!-- Failed Count -->
    {#if syncStatus.failedCount > 0}
        <Badge variant="destructive" class="flex items-center gap-1">
            <AlertCircle class="h-3 w-3" />
            {syncStatus.failedCount} failed
        </Badge>
        <Button
            size="sm"
            variant="outline"
            on:click={handleRetryFailed}
            class="h-7"
        >
            Retry
        </Button>
    {/if}

    <!-- Sync Button -->
    {#if isOnline && syncStatus.pendingCount > 0}
        <Button
            size="sm"
            variant="outline"
            on:click={handleManualSync}
            disabled={isSyncing}
            class="h-7"
        >
            <RefreshCw class="h-3 w-3 mr-1 {isSyncing ? 'animate-spin' : ''}" />
            {isSyncing ? "Syncing..." : "Sync Now"}
        </Button>
    {/if}
</div>

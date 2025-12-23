<script lang="ts">
    import { JournalSyncService } from '../services/journal-sync.service.svelte';
    import { NetworkService } from '$lib/services/network.service.svelte';
    import { SettingsService } from '$lib/services/settings.service.svelte';
    import { RefreshCw, CloudOff, CheckCircle, AlertCircle, Clock, ChevronDown, RotateCcw } from 'lucide-svelte';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import { cn } from '$lib/utils';
    import { toast } from 'svelte-sonner';

    const syncStatus = $derived(JournalSyncService.syncStatus);
    const isOnline = $derived(NetworkService.isOnline);
    const syncEnabled = $derived(SettingsService.journal.syncEnabled);
    const lastPullSyncTime = $derived(JournalSyncService.lastPullSyncTime);

    const totalPending = $derived(syncStatus.pendingCount + syncStatus.failedCount);
    const isSyncing = $derived(syncStatus.isSyncing);

    function formatLastSyncTime(timestamp: number | null): string {
        if (!timestamp) return 'Never';
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    async function handleManualSync() {
        try {
            await JournalSyncService.fullSync();
            toast.success('Sync completed');
        } catch (error) {
            console.error('Manual sync failed:', error);
            toast.error('Sync failed');
        }
    }

    async function handleRetryFailed() {
        try {
            await JournalSyncService.retryFailedSyncs();
            toast.success('Retrying failed syncs');
        } catch (error) {
            console.error('Retry failed:', error);
            toast.error('Retry failed');
        }
    }

    async function handleHardRefresh() {
        if (!confirm('Hard refresh will replace all local entries with server data. Any unsynced local changes will be lost. Continue?')) {
            return;
        }
        try {
            const result = await JournalSyncService.hardRefresh();
            toast.success(`Hard refresh completed: ${result.added} entries loaded from server`);
        } catch (error) {
            console.error('Hard refresh failed:', error);
            toast.error('Hard refresh failed');
        }
    }
</script>

<div class="flex items-center gap-2">
    {#if !syncEnabled}
        <Badge variant="outline" class="flex items-center gap-1">
            <CloudOff class="h-3 w-3" />
            Sync Disabled
        </Badge>
    {:else if !isOnline}
        <Badge variant="destructive" class="flex items-center gap-1">
            <CloudOff class="h-3 w-3" />
            Offline
        </Badge>
    {:else if isSyncing}
        <Badge variant="secondary" class="flex items-center gap-1">
            <RefreshCw class="h-3 w-3 animate-spin" />
            Syncing...
        </Badge>
    {:else if syncStatus.failedCount > 0}
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
    {:else if syncStatus.pendingCount > 0}
        <Badge variant="outline" class="flex items-center gap-1">
            <Clock class="h-3 w-3" />
            {syncStatus.pendingCount} pending
        </Badge>
    {:else}
        <Badge variant="secondary" class="flex items-center gap-1">
            <CheckCircle class="h-3 w-3" />
            Synced
        </Badge>
    {/if}

    {#if syncEnabled && isOnline}
        <!-- @ts-ignore - bits-ui type definitions issue -->
        <DropdownMenu.Root>
            <!-- @ts-ignore - bits-ui type definitions issue -->
            <DropdownMenu.Trigger asChild let:builder>
                <Button
                    builders={[builder]}
                    size="sm"
                    variant="outline"
                    disabled={isSyncing}
                    class="h-7"
                    on:click={(e) => e.stopPropagation()}
                >
                    <RefreshCw class={cn("h-3 w-3 mr-1", isSyncing && "animate-spin")} />
                    {isSyncing ? 'Syncing...' : 'Sync'}
                    <ChevronDown class="h-3 w-3 ml-1" />
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
                <DropdownMenu.Item
                    on:click={(e) => {
                        e.stopPropagation();
                        handleManualSync();
                    }}
                    disabled={isSyncing}
                >
                    <RefreshCw class="h-4 w-4 mr-2" />
                    Sync Now
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                    on:click={(e) => {
                        e.stopPropagation();
                        handleHardRefresh();
                    }}
                    disabled={isSyncing}
                    class="text-destructive focus:text-destructive"
                >
                    <RotateCcw class="h-4 w-4 mr-2" />
                    Hard Refresh
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    {/if}

    {#if lastPullSyncTime && syncEnabled}
        <span class="text-xs text-muted-foreground">
            {formatLastSyncTime(lastPullSyncTime)}
        </span>
    {/if}
</div>


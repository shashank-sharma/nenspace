<script lang="ts">
    import { Card, CardContent } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { mailStore } from "../stores";
    import { DateUtil } from "$lib/utils";
    import { Mail, CheckCircle2, Clock, Loader2, RefreshCw, XCircle, AlertTriangle } from "lucide-svelte";
    import { cn } from "$lib/utils";
    import { toast } from "svelte-sonner";

    const syncStatus = $derived(mailStore.syncStatus);
    const isSyncing = $derived(mailStore.isSyncing);
    const messageCount = $derived(syncStatus?.message_count || 0);
    const lastSynced = $derived(syncStatus?.last_synced);
    const isAuthenticated = $derived(mailStore.isAuthenticated);
    const errorMessage = $derived(syncStatus?.error_message);
    const hasError = $derived(syncStatus?.status === "failed");
    const isFailed = $derived(syncStatus?.status === "failed");
    const isInactive = $derived(syncStatus?.status === "inactive" || !syncStatus?.is_active);
    const needsReauth = $derived(syncStatus?.needs_reauth || isInactive);

    async function handleSync() {
        if (!isAuthenticated) {
            toast.error("Please connect your email first");
            return;
        }

        if (needsReauth) {
            toast.error("Please re-authenticate your email account");
            // Trigger re-auth flow
            try {
                const authUrl = await mailStore.startAuth();
                if (authUrl) {
                    window.open(authUrl, '_blank', 'width=600,height=700');
                }
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to start re-authentication");
            }
            return;
        }

        try {
            await mailStore.syncMails();
            toast.success("Email sync started");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to start sync");
        }
    }

    async function handleReauth() {
        try {
            const authUrl = await mailStore.startAuth();
            if (authUrl) {
                window.open(authUrl, '_blank', 'width=600,height=700');
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to start re-authentication");
        }
    }
</script>

<Card class="mail-status-card">
    <CardContent class="p-4">
        <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                    <Mail class="h-4 w-4 text-muted-foreground" />
                    <span class="text-sm font-medium">
                        {messageCount.toLocaleString()} {messageCount === 1 ? 'email' : 'emails'}
                    </span>
                </div>
            </div>
            
            <div class="flex items-center gap-4">
                {#if isSyncing}
                    <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 class="h-4 w-4 animate-spin" />
                        <span>Syncing...</span>
                    </div>
                {:else if needsReauth || isInactive}
                    <div class="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500" title={errorMessage || "Re-authentication required"}>
                        <AlertTriangle class="h-4 w-4" />
                        <span class="max-w-md truncate">Re-authentication required</span>
                    </div>
                {:else if isFailed}
                    <div class="flex items-center gap-2 text-sm text-destructive" title={errorMessage || "Sync failed"}>
                        <XCircle class="h-4 w-4 text-destructive" />
                        <span class="max-w-md truncate">Sync failed</span>
                    </div>
                {:else if syncStatus && (syncStatus.status === "completed" || (syncStatus.last_synced && !isSyncing && !isFailed && !needsReauth))}
                    <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 class="h-4 w-4 text-green-500" />
                        <span>Synced</span>
                    </div>
                {/if}
                
                {#if lastSynced && !isFailed && !needsReauth}
                    <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock class="h-4 w-4" />
                        <span>
                            Last synced: {DateUtil.formatRelative(new Date(lastSynced))}
                        </span>
                    </div>
                {/if}
                
                {#if (isFailed || needsReauth) && errorMessage}
                    <div class="text-xs text-destructive max-w-md truncate" title={errorMessage}>
                        {errorMessage}
                    </div>
                {/if}

                {#if isAuthenticated}
                    {#if needsReauth || isInactive}
                        <Button
                            size="sm"
                            variant="default"
                            on:click={handleReauth}
                            class="h-8 bg-amber-600 hover:bg-amber-700"
                        >
                            <RefreshCw class="h-4 w-4 mr-2" />
                            Re-authenticate
                        </Button>
                    {:else}
                    <Button
                        size="sm"
                        variant="outline"
                        on:click={handleSync}
                        disabled={isSyncing}
                        class="h-8"
                    >
                        <RefreshCw class={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                        {isSyncing ? "Syncing..." : "Sync Now"}
                    </Button>
                    {/if}
                {/if}
            </div>
        </div>
    </CardContent>
</Card>

<style>
    .mail-status-card {
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }
</style>


<script lang="ts">
    import {
        Card,
        CardContent,
    } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { toast } from "svelte-sonner";
    import { calendarStore } from "../stores";
    import { DateUtil } from "$lib/utils";
    import { Calendar, CheckCircle2, Clock, Loader2, RefreshCw, XCircle, AlertTriangle } from "lucide-svelte";
    import { cn } from "$lib/utils";
    import { CalendarService } from "../services";
    import { onDestroy } from "svelte";

    const syncStatus = $derived(calendarStore.syncStatus);
    const isSyncing = $derived(calendarStore.isSyncing);
    const eventCount = $derived(calendarStore.events.length);
    const lastSynced = $derived(syncStatus?.last_synced);
    const hasCalendars = $derived(calendarStore.hasCalendars);
    const syncStatusText = $derived(syncStatus?.sync_status || "");
    const isFailed = $derived(syncStatusText === "failed");
    const isInactive = $derived(syncStatusText === "inactive" || !syncStatus?.is_active);
    const needsReauth = $derived(isInactive);
    const errorMessage = $derived(
        syncStatus?.sync_status?.startsWith('failed:') 
            ? syncStatus.sync_status.replace('failed:', '').trim()
            : null
    );
    let isReauthenticating = $state(false);
    let authWindow: Window | null = null;
    let authMessageHandler: ((event: MessageEvent) => void) | null = null;

    async function handleReauth() {
        if (isReauthenticating) return;
        
        isReauthenticating = true;
        try {
            const authUrl = await CalendarService.startAuth();
            if (authUrl) {
                authWindow = window.open(
                    authUrl,
                    "auth",
                    "width=600,height=800"
                );
                
                // Listen for auth completion
                authMessageHandler = (event: MessageEvent) => {
                    if (event.data === "AUTH_COMPLETE") {
                        if (authMessageHandler) {
                            window.removeEventListener("message", authMessageHandler);
                            authMessageHandler = null;
                        }
                        if (authWindow) {
                            authWindow.close();
                            authWindow = null;
                        }
                        toast.success("Calendar re-authentication successful");
                        // Refresh calendar data
                        calendarStore.fetchCalendars().catch(console.error);
                    }
                };
                window.addEventListener("message", authMessageHandler);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to start re-authentication");
        } finally {
            isReauthenticating = false;
        }
    }

    onDestroy(() => {
        if (authMessageHandler) {
            window.removeEventListener("message", authMessageHandler);
        }
        if (authWindow) {
            authWindow.close();
        }
    });

    async function handleSync() {
        if (!hasCalendars) {
            toast.error("Please connect a calendar first");
            return;
        }

        if (needsReauth) {
            await handleReauth();
            return;
        }

        try {
            await calendarStore.syncCalendars();
            toast.success("Calendar sync started");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to start sync");
        }
    }
</script>

<Card class="calendar-status-card w-full">
    <CardContent class="p-4">
        <div class="flex items-center justify-between gap-4 w-full">
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                    <Calendar class="h-4 w-4 text-muted-foreground" />
                    <span class="text-sm font-medium">
                        {eventCount.toLocaleString()} {eventCount === 1 ? 'event' : 'events'}
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
                {:else if syncStatus && (syncStatusText === "completed" || syncStatusText === "added" || syncStatusText === "success" || (lastSynced && !isSyncing && !isFailed && !needsReauth))}
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

                {#if hasCalendars}
                    {#if needsReauth || isInactive}
                        <Button
                            size="sm"
                            variant="default"
                            on:click={handleReauth}
                            disabled={isReauthenticating}
                            class="h-8 bg-amber-600 hover:bg-amber-700"
                        >
                            <RefreshCw class={cn("h-4 w-4 mr-2", isReauthenticating && "animate-spin")} />
                            {isReauthenticating ? "Authenticating..." : "Re-authenticate"}
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
    .calendar-status-card {
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }
</style>

<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { mailStore, mailMessagesStore } from "$lib/features/mail/stores";
    import { MailService } from "$lib/features/mail/services/mail.service";
    import { toast } from "svelte-sonner";
    import { RefreshCw, Mail, Loader2 } from "lucide-svelte";
    import { format } from "date-fns";

    async function handleForceSync() {
        try {
            await mailStore.syncMails();
            toast.success("Mail sync started");
        } catch (error) {
            toast.error("Failed to start sync");
            console.error(error);
        }
    }

    async function handleRefreshMessages() {
        try {
            await mailMessagesStore.refreshMails();
            toast.success("Messages refreshed");
        } catch (error) {
            toast.error("Failed to refresh messages");
            console.error(error);
        }
    }

    async function handleClearCache() {
        MailService.clearCache();
        toast.success("Cache cleared");
    }
</script>

<div class="space-y-4">
    <!-- Sync Status -->
    <div class="space-y-2">
        <div class="flex items-center justify-between">
            <h4 class="text-sm font-medium">Sync Status</h4>
            <Button
                variant="ghost"
                size="sm"
                on:click={handleForceSync}
                disabled={mailStore.isSyncing}
            >
                {#if mailStore.isSyncing}
                    <Loader2 class="h-3 w-3 mr-2 animate-spin" />
                {:else}
                    <RefreshCw class="h-3 w-3 mr-2" />
                {/if}
                {mailStore.isSyncing ? "Syncing..." : "Force Sync"}
            </Button>
        </div>

        {#if mailStore.syncStatus}
            <div class="space-y-1 text-xs">
                <div class="flex justify-between">
                    <span class="text-muted-foreground">Status:</span>
                    <span class="font-medium">{mailStore.syncStatus.status}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-muted-foreground">Last Synced:</span>
                    <span>
                        {mailStore.syncStatus.last_synced
                            ? format(
                                  new Date(mailStore.syncStatus.last_synced),
                                  "MMM d, yyyy HH:mm"
                              )
                            : "Never"}
                    </span>
                </div>
                <div class="flex justify-between">
                    <span class="text-muted-foreground">Message Count:</span>
                    <span class="font-medium">
                        {mailStore.syncStatus.message_count || 0}
                    </span>
                </div>
            </div>
        {:else}
            <p class="text-xs text-muted-foreground">Not synced</p>
        {/if}
    </div>

    <!-- Messages Status -->
    <div class="space-y-2">
        <div class="flex items-center justify-between">
            <h4 class="text-sm font-medium">Messages</h4>
            <Button
                variant="ghost"
                size="sm"
                on:click={handleRefreshMessages}
                disabled={mailMessagesStore.isLoading}
            >
                {#if mailMessagesStore.isLoading}
                    <Loader2 class="h-3 w-3 mr-2 animate-spin" />
                {:else}
                    <RefreshCw class="h-3 w-3 mr-2" />
                {/if}
                Refresh
            </Button>
        </div>

        <div class="space-y-1 text-xs">
            <div class="flex justify-between">
                <span class="text-muted-foreground">Total:</span>
                <span class="font-medium">{mailMessagesStore.totalItems}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Loaded:</span>
                <span class="font-medium">{mailMessagesStore.messages.length}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Unread:</span>
                <span class="font-medium">{mailMessagesStore.unreadCount}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-muted-foreground">Starred:</span>
                <span class="font-medium">{mailMessagesStore.starredCount}</span>
            </div>
        </div>
    </div>

    <!-- Authentication Status -->
    <div class="space-y-2">
        <h4 class="text-sm font-medium">Authentication</h4>
        <div class="space-y-1 text-xs">
            <div class="flex justify-between">
                <span class="text-muted-foreground">Status:</span>
                <span
                    class={mailStore.isAuthenticated
                        ? "text-green-600 dark:text-green-500 font-medium"
                        : "text-muted-foreground"}
                >
                    {mailStore.isAuthenticated ? "Authenticated" : "Not Authenticated"}
                </span>
            </div>
            {#if mailStore.lastChecked}
                <div class="flex justify-between">
                    <span class="text-muted-foreground">Last Checked:</span>
                    <span>
                        {format(new Date(mailStore.lastChecked), "MMM d, yyyy HH:mm")}
                    </span>
                </div>
            {/if}
        </div>
    </div>

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
                <Mail class="h-3 w-3 mr-2" />
                Clear Cache
            </Button>
        </div>
    </div>
</div>


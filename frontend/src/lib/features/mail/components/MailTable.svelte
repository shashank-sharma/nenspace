<script lang="ts">
    import { onMount } from "svelte";
    import { mailMessagesStore, mailStore } from "../stores";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import {
        Table,
        TableBody,
        TableCell,
        TableHead,
        TableHeader,
        TableRow,
    } from "$lib/components/ui/table";
    import {
        RefreshCw,
        Star,
        Inbox,
        Loader2,
    } from "lucide-svelte";
    import { cn, formatEmailString, formatEmailDate } from "$lib/utils";
    import { fade } from "svelte/transition";
    import type { MailMessage } from "../types";
    import { debounce } from "$lib/utils/debounce.util";

    let searchQuery = $state("");

    function handleMailSelect(mail: MailMessage) {
        mailMessagesStore.selectMail(mail).catch(console.error);
    }

    async function handleRefresh() {
        await mailMessagesStore.refreshMails();
    }

    // Debounced search using effect
    $effect(() => {
        const query = searchQuery;
        if (query === undefined || query === null || query === "") {
            return;
        }
        
        const timeoutId = setTimeout(() => {
            mailMessagesStore.searchMails(query);
        }, 300);

        return () => {
            clearTimeout(timeoutId);
        };
    });

    // Derived state - access properties directly (not as stores)
    const isSyncing = $derived(mailStore.isSyncing);
    const isLoading = $derived(mailMessagesStore.isLoading);
    const hasEmails = $derived(mailMessagesStore.hasMessages);
    const filteredMessages = $derived(mailMessagesStore.filteredMessages);

    onMount(() => {
        if (mailStore.isAuthenticated && !mailMessagesStore.hasAttemptedFetch && !mailMessagesStore.isLoading) {
            mailMessagesStore.fetchMails(true);
        }
    });
</script>

<div class="flex h-full flex-col">
    <div
        class="flex items-center justify-between px-4 py-3 border-b border-border"
    >
        <div class="flex items-center space-x-2">
            <Button
                variant="ghost"
                size="sm"
                class="text-slate-600 dark:text-slate-400"
                on:click={handleRefresh}
                disabled={isSyncing}
            >
                <RefreshCw
                    class={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")}
                />
                <span>{isSyncing ? "Syncing..." : "Refresh"}</span>
            </Button>
        </div>
    </div>

    {#if isLoading}
        <div
            class="flex flex-col items-center justify-center flex-1 p-8"
            in:fade={{ duration: 150 }}
        >
                <Loader2 class="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p class="text-sm text-muted-foreground">
                Loading emails...
            </p>
        </div>
    {:else if !hasEmails}
        <div
            class="flex flex-col items-center justify-center flex-1 p-8"
            in:fade={{ duration: 150 }}
        >
            <div
                class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4"
            >
                <Inbox class="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 class="text-lg font-medium mb-2">
                No emails found
            </h3>
            <p
                class="text-sm text-muted-foreground text-center max-w-xs mb-4"
            >
                Your inbox is empty or emails are still loading. Try refreshing
                or checking back later.
            </p>
            <Button
                variant="outline"
                size="sm"
                on:click={handleRefresh}
                disabled={isSyncing}
            >
                <RefreshCw
                    class={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")}
                />
                <span>Refresh</span>
            </Button>
        </div>
    {:else}
        <div class="overflow-auto flex-1">
            <Table>
                <TableHeader class="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                        <TableHead class="w-10 px-4"></TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead class="text-right w-24">Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {#each filteredMessages as mail (mail.id)}
                        <TableRow
                            class={cn(
                                "cursor-pointer hover:bg-muted/50 transition-colors",
                                mailMessagesStore.selectedMail?.id === mail.id &&
                                    "bg-primary/10 hover:bg-primary/10",
                                mail.is_unread && "font-semibold"
                            )}
                            on:click={() => handleMailSelect(mail)}
                        >
                            <TableCell class="w-10 px-4">
                                <div in:fade={{ duration: 200 }}>
                                    {#if mail.is_unread}
                                        <div
                                            class="w-2 h-2 rounded-full bg-primary"
                                        ></div>
                                    {/if}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div class="flex items-center gap-2">
                                    {#if mail.is_starred}
                                        <Star class="h-3 w-3 fill-primary text-primary" />
                                    {/if}
                                    <span class="truncate max-w-[200px]">
                                        {formatEmailString(mail.from)}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div class="line-clamp-1">{mail.subject || "(No subject)"}</div>
                            </TableCell>
                            <TableCell
                                class="text-right text-xs text-muted-foreground whitespace-nowrap"
                            >
                                {formatEmailDate(mail.received_date)}
                            </TableCell>
                        </TableRow>
                    {/each}
                </TableBody>
            </Table>
        </div>
    {/if}
</div>


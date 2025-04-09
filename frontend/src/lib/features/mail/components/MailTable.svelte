<script lang="ts">
    import { onMount, onDestroy } from "svelte";
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
        Mail,
        MailOpen,
        Inbox,
        Loader2,
    } from "lucide-svelte";
    import { format, formatDistanceToNow } from "date-fns";
    import { page } from "$app/stores";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { cn } from "$lib/utils";
    import { fade, slide } from "svelte/transition";
    import type { MailMessage } from "../types";

    let searchQuery = "";

    function formatEmailString(str: string) {
        const [email] = str.split("<");
        return email?.trim() || str;
    }

    function formatEmailDate(date: string) {
        const messageDate = new Date(date);
        const now = new Date();

        // If it's today, show the time
        if (messageDate.toDateString() === now.toDateString()) {
            return format(messageDate, "h:mm a");
        }

        // If it's this year but not today, show the month and day
        if (messageDate.getFullYear() === now.getFullYear()) {
            return format(messageDate, "MMM d");
        }

        // If it's a different year, include the year
        return format(messageDate, "MMM d, yyyy");
    }

    function handleMailSelect(mail: MailMessage) {
        if (mail.is_unread) {
            mailMessagesStore.markAsRead(mail.id);
        }
        mailMessagesStore.selectMail(mail);
    }

    function handleRefresh() {
        mailMessagesStore.refreshMails();
    }

    // Check if sync is in progress
    $: isSyncing = $mailStore.syncStatus?.status === "in-progress";
    $: isLoading = $mailMessagesStore.isLoading;
    $: hasEmails =
        $mailMessagesStore.messages && $mailMessagesStore.messages.length > 0;

    onMount(() => {
        mailMessagesStore.fetchMails();
    });
</script>

<div class="flex h-full flex-col">
    <div
        class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700"
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
            <Loader2 class="h-8 w-8 animate-spin text-slate-400 mb-4" />
            <p class="text-sm text-slate-500 dark:text-slate-400">
                Loading emails...
            </p>
        </div>
    {:else if !hasEmails}
        <div
            class="flex flex-col items-center justify-center flex-1 p-8"
            in:fade={{ duration: 150 }}
        >
            <div
                class="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4"
            >
                <Inbox class="h-8 w-8 text-slate-400" />
            </div>
            <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">
                No emails found
            </h3>
            <p
                class="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs mb-4"
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
                <TableHeader
                    class="bg-slate-50 dark:bg-slate-800/50 sticky top-0"
                >
                    <TableRow>
                        <TableHead class="w-10 px-4"></TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead class="text-right w-24">Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {#each $mailMessagesStore.messages as mail (mail.id)}
                        <TableRow
                            class={cn(
                                "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                                $mailMessagesStore.selectedMail?.id ===
                                    mail.id &&
                                    "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/20",
                                mail.is_unread && "font-medium",
                            )}
                            on:click={() => handleMailSelect(mail)}
                        >
                            <TableCell class="w-10 px-4">
                                <div in:fade={{ duration: 200 }}>
                                    {#if mail.is_unread}
                                        <div
                                            class="w-2 h-2 rounded-full bg-blue-500"
                                        ></div>
                                    {/if}
                                </div>
                            </TableCell>
                            <TableCell class="font-medium">
                                <div class="flex items-center">
                                    <span>{formatEmailString(mail.from)}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div class="line-clamp-1">{mail.subject}</div>
                            </TableCell>
                            <TableCell
                                class="text-right text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap"
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

<script lang="ts">
    import { Card, CardContent } from "$lib/components/ui/card";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { cn, formatEmailString, formatEmailDate } from "$lib/utils";
    import { Star, Inbox, Loader2 } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import { mailMessagesStore } from "../stores";
    import type { MailMessage } from "../types";

    const isLoading = $derived(mailMessagesStore.isLoading);
    const hasEmails = $derived(mailMessagesStore.hasMessages);
    const filteredMessages = $derived(mailMessagesStore.filteredMessages);
    const selectedMail = $derived(mailMessagesStore.selectedMail);

    async function handleMailSelect(mail: MailMessage) {
        await mailMessagesStore.selectMail(mail);
    }
</script>

<Card class="mail-list-card">
    <CardContent class="p-0 flex flex-col h-full min-h-0 max-h-full">
        {#if isLoading}
            <div class="flex flex-col items-center justify-center h-full p-8" in:fade={{ duration: 150 }}>
                <Loader2 class="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p class="text-sm text-muted-foreground">Loading emails...</p>
            </div>
        {:else if !hasEmails}
            <div class="flex flex-col items-center justify-center h-full p-8" in:fade={{ duration: 150 }}>
                <div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Inbox class="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 class="text-lg font-medium mb-2">No emails found</h3>
                <p class="text-sm text-muted-foreground text-center max-w-xs">
                    Your inbox is empty or emails are still loading.
                </p>
            </div>
        {:else}
            <ScrollArea class="flex-1 min-h-0">
                <div class="p-2 space-y-1">
                    {#each filteredMessages as mail (mail.id)}
                        <div
                            class={cn(
                                "p-3 rounded-lg cursor-pointer transition-all hover:bg-muted/50",
                                selectedMail?.id === mail.id && "bg-primary/10 hover:bg-primary/10 border border-primary/20",
                                mail.is_unread && "font-semibold"
                            )}
                            onclick={() => handleMailSelect(mail)}
                            role="button"
                            tabindex="0"
                            onkeydown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleMailSelect(mail);
                                }
                            }}
                        >
                            <div class="flex items-start gap-3">
                                <div class="flex items-center gap-2 min-w-0 flex-1">
                                    {#if mail.is_unread}
                                        <div class="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5"></div>
                                    {:else}
                                        <div class="w-2 shrink-0"></div>
                                    {/if}
                                    {#if mail.is_starred}
                                        <Star class="h-3.5 w-3.5 fill-primary text-primary shrink-0 mt-0.5" />
                                    {/if}
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center justify-between gap-2 mb-1">
                                            <span class="text-sm truncate">
                                                {formatEmailString(mail.from)}
                                            </span>
                                            <span class="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                                {formatEmailDate(mail.received_date)}
                                            </span>
                                        </div>
                                        <div class="text-sm text-muted-foreground line-clamp-1">
                                            {mail.subject || "(No subject)"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </ScrollArea>
        {/if}
    </CardContent>
</Card>

<style>
    .mail-list-card {
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        height: 100%;
        min-height: 0;
        max-height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    
    :global(.mail-list-card.bg-card) {
        height: 100%;
        min-height: 0;
        max-height: 100%;
    }
    
    :global(.mail-list-card > div) {
        height: 100%;
        min-height: 0;
        max-height: 100%;
        display: flex;
        flex-direction: column;
        flex: 1;
    }
</style>


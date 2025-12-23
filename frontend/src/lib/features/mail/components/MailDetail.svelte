<!-- src/lib/components/mail/MailDetail.svelte -->
<script lang="ts">
    import { mailMessagesStore } from "../stores";
    import { Button } from "$lib/components/ui/button";
    import { Star, Trash2, Archive } from "lucide-svelte";
    import {
        Sheet,
        SheetContent,
        SheetHeader,
        SheetTitle,
    } from "$lib/components/ui/sheet";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { DateUtil, formatEmailString } from "$lib/utils";
    import { cn } from "$lib/utils";

    const selectedMail = $derived(mailMessagesStore.selectedMail);
    let open = $state(!!selectedMail);

    $effect(() => {
        open = !!selectedMail;
    });

    $effect(() => {
        if (!open && selectedMail) {
            mailMessagesStore.selectMail(null);
        }
    });

    async function toggleStar() {
        if (selectedMail) {
            await mailMessagesStore.toggleStar(selectedMail.id);
        }
    }

    async function moveToTrash() {
        if (selectedMail) {
            await mailMessagesStore.moveToTrash(selectedMail.id);
        }
    }

    async function archiveEmail() {
        if (selectedMail) {
            await mailMessagesStore.moveToArchive(selectedMail.id);
        }
    }
</script>

<Sheet bind:open>
    <SheetContent class="w-[90%] sm:w-[600px] sm:max-w-none">
        {#if selectedMail}
            <SheetHeader
                class="flex-row items-center justify-between space-y-0 pb-2 border-b"
            >
                <SheetTitle class="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        on:click={toggleStar}
                        class={cn(
                            selectedMail.is_starred
                                ? "text-primary"
                                : "text-muted-foreground"
                        )}
                    >
                        <Star
                            size={20}
                            fill={selectedMail.is_starred
                                ? "currentColor"
                                : "none"}
                        />
                    </Button>
                    <Button variant="ghost" size="icon" on:click={archiveEmail}>
                        <Archive size={20} />
                    </Button>
                    <Button variant="ghost" size="icon" on:click={moveToTrash}>
                        <Trash2 size={20} />
                    </Button>
                </SheetTitle>
            </SheetHeader>

            <ScrollArea class="h-[calc(100vh-8rem)] mt-6">
                <div class="space-y-6">
                    <div>
                        <h2 class="text-2xl font-bold">
                            {selectedMail.subject}
                        </h2>
                        <div class="mt-4 space-y-1">
                            <div class="flex items-center justify-between">
                                <div>
                                    <span class="font-medium">From: </span>
                                    <span class="text-muted-foreground"
                                        >{formatEmailString(
                                            selectedMail.from
                                        )}</span
                                    >
                                </div>
                                <span class="text-sm text-muted-foreground">
                                    {DateUtil.formatDateTime(
                                        selectedMail.received_date,
                                        {
                                            dateStyle: 'long',
                                            use24Hour: false
                                        }
                                    )}
                                </span>
                            </div>
                            <div>
                                <span class="font-medium">To: </span>
                                <span class="text-muted-foreground"
                                    >{selectedMail.to}</span
                                >
                            </div>
                        </div>
                    </div>

                    <div class="border-t pt-6">
                        <div
                            class="prose prose-sm dark:prose-invert max-w-none"
                        >
                            {@html selectedMail.body}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        {/if}
    </SheetContent>
</Sheet>

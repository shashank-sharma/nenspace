<script lang="ts">
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent } from "$lib/components/ui/card";
    import { Search, RefreshCw, Filter } from "lucide-svelte";
    import { mailMessagesStore, mailStore } from "../stores";
    import { cn } from "$lib/utils";

    let searchQuery = $state("");
    const isSyncing = $derived(mailStore.isSyncing);
    const isLoading = $derived(mailMessagesStore.isLoading);

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

    async function handleRefresh() {
        await mailMessagesStore.refreshMails();
    }
</script>

<Card class="mail-search-card">
    <CardContent class="p-4">
        <div class="flex items-center gap-3">
            <div class="relative flex-1">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search emails..."
                    bind:value={searchQuery}
                    class="pl-9"
                />
            </div>
            <Button
                variant="outline"
                size="icon"
                on:click={handleRefresh}
                disabled={isSyncing || isLoading}
                title="Refresh"
            >
                <RefreshCw
                    class={cn("h-4 w-4", (isSyncing || isLoading) && "animate-spin")}
                />
            </Button>
            <Button
                variant="outline"
                size="icon"
                title="Filters"
            >
                <Filter class="h-4 w-4" />
            </Button>
        </div>
    </CardContent>
</Card>

<style>
    .mail-search-card {
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }
</style>


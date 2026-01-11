<script lang="ts">
    import { newsletterStore } from "../stores/newsletter.store.svelte";
    import NewsletterCard from "./NewsletterCard.svelte";
    import ScanProgress from "./ScanProgress.svelte";
    import { NEWSLETTER_PAGE_SIZE, getFrequencyLabel } from "../constants";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import SearchInput from "$lib/components/SearchInput.svelte";
    import Pagination from "$lib/components/Pagination.svelte";
    import * as Table from "$lib/components/ui/table";
    import { Badge } from "$lib/components/ui/badge";
    import { Mail, RefreshCw, SlidersHorizontal, LayoutGrid, LayoutList, ScanSearch, Calendar, Inbox, ArrowUpRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { fade, slide } from "svelte/transition";
    import { useDebouncedFilter } from "$lib/hooks";
    import { cn, DateUtil } from "$lib/utils";

    let viewMode = $state<'grid' | 'list'>('list');
    let showFilters = $state(false);

    // Debounced search
    useDebouncedFilter(
        () => newsletterStore.filter,
        () => newsletterStore.loadNewsletters(1),
        300
    );

    function handlePageChange(page: number) {
        newsletterStore.loadNewsletters(page);
    }

    function handleRefresh() {
        newsletterStore.loadNewsletters(newsletterStore.currentPage);
    }

    async function handleStartScan() {
        await newsletterStore.startScan();
    }
</script>

<div class="space-y-6">
    <ScanProgress />

    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex-1 max-w-md">
            <SearchInput 
                bind:value={newsletterStore.filter.searchQuery} 
                placeholder="Search newsletters or senders..." 
            />
        </div>
        <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" onclick={handleStartScan} disabled={newsletterStore.isScanning} class="gap-2 hidden sm:flex">
                <ScanSearch class={cn("h-4 w-4", newsletterStore.isScanning && "animate-pulse")} />
                {newsletterStore.isScanning ? "Scanning..." : "Rescan"}
            </Button>
            <div class="border-l mx-1 h-6 hidden sm:block"></div>
            <Button variant="outline" size="icon" onclick={handleRefresh} disabled={newsletterStore.isLoading}>
                <RefreshCw class={cn("h-4 w-4", newsletterStore.isLoading && "animate-spin")} />
            </Button>
            <div class="border-l mx-1 h-6 hidden md:block"></div>
            <Button 
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                size="icon" 
                onclick={() => viewMode = 'grid'}
            >
                <LayoutGrid class="h-4 w-4" />
            </Button>
            <Button 
                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                size="icon" 
                onclick={() => viewMode = 'list'}
            >
                <LayoutList class="h-4 w-4" />
            </Button>
        </div>
    </div>

    {#if newsletterStore.isLoading && newsletterStore.newsletters.length === 0}
        <div class="flex flex-col items-center justify-center py-20">
            <LoadingSpinner size="lg" label="Finding your newsletters..." />
        </div>
    {:else if newsletterStore.newsletters.length === 0}
        <div in:fade>
            <EmptyState 
                icon={Mail} 
                title="No newsletters found" 
                description={newsletterStore.filter.searchQuery ? "Try adjusting your search query." : "We haven't detected any newsletters yet. They will appear here once identified from your incoming mail."}
                actionLabel={newsletterStore.filter.searchQuery ? "Clear Search" : undefined}
                onaction={() => newsletterStore.filter.searchQuery = ""}
            />
        </div>
    {:else}
        {#if viewMode === 'grid'}
            <div class="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" in:fade>
                {#each newsletterStore.newsletters as newsletter (newsletter.id)}
                    <div in:slide={{ duration: 200 }}>
                        <NewsletterCard {newsletter} />
                    </div>
                {/each}
            </div>
        {:else}
            <div class="rounded-xl border bg-card shadow-sm overflow-hidden" in:fade>
                <Table.Root>
                    <Table.Header class="bg-muted/50">
                        <Table.Row>
                            <Table.Head class="w-[300px]">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    class="-ml-4 h-8 gap-2 font-bold data-[state=open]:bg-accent"
                                    onclick={() => newsletterStore.toggleSort('name')}
                                >
                                    Newsletter
                                    {#if newsletterStore.filter.sort === 'name'}
                                        <ArrowUp class="h-4 w-4" />
                                    {:else if newsletterStore.filter.sort === '-name'}
                                        <ArrowDown class="h-4 w-4" />
                                    {:else}
                                        <ArrowUpDown class="h-4 w-4 opacity-50" />
                                    {/if}
                                </Button>
                            </Table.Head>
                            <Table.Head>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    class="-ml-4 h-8 gap-2 font-bold"
                                    onclick={() => newsletterStore.toggleSort('frequency_days')}
                                >
                                    Frequency
                                    {#if newsletterStore.filter.sort === 'frequency_days'}
                                        <ArrowUp class="h-4 w-4" />
                                    {:else if newsletterStore.filter.sort === '-frequency_days'}
                                        <ArrowDown class="h-4 w-4" />
                                    {:else}
                                        <ArrowUpDown class="h-4 w-4 opacity-50" />
                                    {/if}
                                </Button>
                            </Table.Head>
                            <Table.Head class="text-center">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    class="mx-auto h-8 gap-2 font-bold"
                                    onclick={() => newsletterStore.toggleSort('total_count')}
                                >
                                    Total Emails
                                    {#if newsletterStore.filter.sort === 'total_count'}
                                        <ArrowUp class="h-4 w-4" />
                                    {:else if newsletterStore.filter.sort === '-total_count'}
                                        <ArrowDown class="h-4 w-4" />
                                    {:else}
                                        <ArrowUpDown class="h-4 w-4 opacity-50" />
                                    {/if}
                                </Button>
                            </Table.Head>
                            <Table.Head>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    class="-ml-4 h-8 gap-2 font-bold"
                                    onclick={() => newsletterStore.toggleSort('last_seen')}
                                >
                                    Last Seen
                                    {#if newsletterStore.filter.sort === 'last_seen'}
                                        <ArrowUp class="h-4 w-4" />
                                    {:else if newsletterStore.filter.sort === '-last_seen'}
                                        <ArrowDown class="h-4 w-4" />
                                    {:else}
                                        <ArrowUpDown class="h-4 w-4 opacity-50" />
                                    {/if}
                                </Button>
                            </Table.Head>
                            <Table.Head>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    class="-ml-4 h-8 gap-2 font-bold"
                                    onclick={() => newsletterStore.toggleSort('is_active')}
                                >
                                    Status
                                    {#if newsletterStore.filter.sort === 'is_active'}
                                        <ArrowUp class="h-4 w-4" />
                                    {:else if newsletterStore.filter.sort === '-is_active'}
                                        <ArrowDown class="h-4 w-4" />
                                    {:else}
                                        <ArrowUpDown class="h-4 w-4 opacity-50" />
                                    {/if}
                                </Button>
                            </Table.Head>
                            <Table.Head class="text-right"></Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each newsletterStore.newsletters as newsletter (newsletter.id)}
                            {@const frequency = getFrequencyLabel(newsletter.frequency_days)}
                            <Table.Row class="group cursor-pointer transition-colors hover:bg-muted/50">
                                <Table.Cell>
                                    <div class="flex items-center gap-3">
                                        <div class="p-2 rounded-lg bg-primary/5 group-hover:bg-primary/10 transition-colors">
                                            <Mail class="w-4 h-4 text-primary" />
                                        </div>
                                        <div class="flex flex-col min-w-0">
                                            <span class="font-bold truncate text-sm">
                                                {newsletter.name || "Unknown Newsletter"}
                                            </span>
                                            <span class="text-xs text-muted-foreground truncate">
                                                {newsletter.sender_email}
                                            </span>
                                        </div>
                                    </div>
                                </Table.Cell>
                                <Table.Cell>
                                    <Badge variant="outline" class={cn(
                                        "capitalize font-medium border shadow-none px-2 py-0 h-5 text-[10px]",
                                        frequency === 'daily' ? "bg-blue-500/10 text-blue-600 border-blue-200/50" :
                                        frequency === 'weekly' ? "bg-green-500/10 text-green-600 border-green-200/50" :
                                        frequency === 'biweekly' ? "bg-purple-500/10 text-purple-600 border-purple-200/50" :
                                        frequency === 'monthly' ? "bg-orange-500/10 text-orange-600 border-orange-200/50" :
                                        "bg-slate-500/10 text-slate-600 border-slate-200/50"
                                    )}>
                                        {frequency}
                                    </Badge>
                                </Table.Cell>
                                <Table.Cell class="text-center">
                                    <div class="flex items-center justify-center gap-1.5 font-semibold text-sm">
                                        <Inbox class="w-3.5 h-3.5 text-blue-500" />
                                        {newsletter.total_count}
                                    </div>
                                </Table.Cell>
                                <Table.Cell>
                                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Calendar class="w-3.5 h-3.5" />
                                        {DateUtil.formatRelative(newsletter.last_seen)}
                                    </div>
                                </Table.Cell>
                                <Table.Cell>
                                    <div class="flex items-center gap-2">
                                        <div class={cn("w-2 h-2 rounded-full", newsletter.is_active ? "bg-green-500 animate-pulse" : "bg-slate-300")}></div>
                                        <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            {newsletter.is_active ? "Active" : "Inactive"}
                                        </span>
                                    </div>
                                </Table.Cell>
                                <Table.Cell class="text-right">
                                    <ArrowUpRight class="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                                </Table.Cell>
                            </Table.Row>
                        {/each}
                    </Table.Body>
                </Table.Root>
            </div>
        {/if}

        {#if newsletterStore.totalPages > 1}
            <div class="flex justify-center pt-8 border-t">
                <Pagination 
                    currentPage={newsletterStore.currentPage}
                    totalPages={newsletterStore.totalPages}
                    totalItems={newsletterStore.totalItems}
                    pageSize={NEWSLETTER_PAGE_SIZE}
                    onpagechange={handlePageChange}
                />
            </div>
        {/if}
    {/if}
</div>


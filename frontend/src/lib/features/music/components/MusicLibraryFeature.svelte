<script lang="ts">
    import { onMount } from 'svelte';
    import { 
        Music, Search, Filter, Trash2, Edit, ChevronLeft, ChevronRight, 
        MoreVertical, CheckSquare, Square, ArrowLeft, RefreshCw, Layers, LayoutGrid, List, Tag as TagIcon
    } from 'lucide-svelte';
    import { goto } from '$app/navigation';
    import { MusicService, MusicPlayerService } from '../services';
    import type { MusicTrack, MusicFilter, Tag } from '../types';
    import { withErrorHandling } from '$lib/utils';
    import { useModalState, useDebouncedFilter } from '$lib/hooks';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import EmptyState from '$lib/components/EmptyState.svelte';
    import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
    import Pagination from '$lib/components/Pagination.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import * as Card from '$lib/components/ui/card';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import * as Resizable from '$lib/components/ui/resizable';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { Badge } from '$lib/components/ui/badge';
    import MusicTrackList from './MusicTrackList.svelte';
    import TrackLibraryDetail from './TrackLibraryDetail.svelte';
    import TrackEditDialog from './TrackEditDialog.svelte';
    import BulkEditDialog from './BulkEditDialog.svelte';
    import MusicLibraryStats from './MusicLibraryStats.svelte';
    import { MUSIC_PAGE_SIZE } from '../constants';
    import { animate, stagger } from 'animejs';
    import { fade, fly } from 'svelte/transition';

    // State
    let tracks = $state<MusicTrack[]>([]);
    let allTags = $state<Tag[]>([]);
    let totalItems = $state(0);
    let isLoading = $state(true);
    let filter = $state<MusicFilter>({
        page: 1,
        perPage: 24,
        sort: '-created',
        search: '',
        tags: []
    });

    // Selection
    let selectedIds = $state<Set<string>>(new Set());
    let activeTrack = $state<MusicTrack | null>(null);
    let selectedTracks = $derived(tracks.filter(t => selectedIds.has(t.id)));
    let allSelected = $derived(tracks.length > 0 && selectedIds.size === tracks.length);
    let someSelected = $derived(selectedIds.size > 0 && selectedIds.size < tracks.length);

    // Responsive detection
    let isMobile = $state(false);
    function checkMobile() {
        isMobile = window.innerWidth < 1024;
    }

    // Modals
    const modals = useModalState<MusicTrack>();
    let showMobileEdit = $state(false);
    let showBulkEditDialog = $state(false);
    let showDeleteConfirm = $state(false);
    let showBulkDeleteConfirm = $state(false);

    // Search debounce
    useDebouncedFilter(
        () => filter.search,
        () => { filter.page = 1; loadTracks(true); },
        400
    );

    async function loadTracks(reset = false) {
        isLoading = true;
        if (reset) {
            tracks = [];
            selectedIds.clear();
        }

        await withErrorHandling(
            async () => {
                const result = await MusicService.getTracks(filter);
                tracks = result.items;
                totalItems = result.totalItems;
            },
            {
                errorMessage: 'Failed to load music library',
            }
        );
        isLoading = false;
    }

    async function loadTags() {
        allTags = await MusicService.getAllTags();
    }

    function toggleTagFilter(tagId: string) {
        if (!filter.tags) filter.tags = [];
        if (filter.tags.includes(tagId)) {
            filter.tags = filter.tags.filter(id => id !== tagId);
        } else {
            filter.tags = [...filter.tags, tagId];
        }
        filter.page = 1;
        loadTracks(true);
    }

    function toggleSelectAll() {
        if (allSelected) {
            selectedIds.clear();
        } else {
            selectedIds = new Set(tracks.map(t => t.id));
        }
        selectedIds = new Set(selectedIds);
    }

    function toggleSelectTrack(id: string) {
        if (selectedIds.has(id)) {
            selectedIds.delete(id);
        } else {
            selectedIds.add(id);
        }
        selectedIds = new Set(selectedIds);
    }

    function handleTrackClick(track: MusicTrack) {
        activeTrack = track;
        if (isMobile) {
            showMobileEdit = true;
        }
    }

    async function confirmDelete(id?: string) {
        const trackId = id || activeTrack?.id;
        if (!trackId) return;
        
        await withErrorHandling(
            () => MusicService.deleteTrack(trackId),
            {
                successMessage: 'Track deleted',
                onSuccess: () => {
                    showDeleteConfirm = false;
                    activeTrack = null;
                    loadTracks(true);
                }
            }
        );
    }

    async function confirmBulkDelete() {
        const ids = Array.from(selectedIds);
        await withErrorHandling(
            () => MusicService.bulkDeleteTracks(ids),
            {
                successMessage: `Deleted ${ids.length} tracks`,
                onSuccess: () => {
                    showBulkDeleteConfirm = false;
                    selectedIds.clear();
                    selectedIds = new Set();
                    loadTracks(true);
                }
            }
        );
    }

    onMount(() => {
        checkMobile();
        window.addEventListener('resize', checkMobile);
        loadTracks();
        loadTags();
        return () => window.removeEventListener('resize', checkMobile);
    });
</script>

<div class="flex flex-col h-screen overflow-hidden bg-background">
    <!-- Header/Stats Section -->
    <div class="p-8 space-y-8 flex-shrink-0 bg-background/50 border-b border-primary/5">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-1">
                <div class="flex items-center gap-2 text-muted-foreground mb-1">
                    <Button variant="ghost" size="sm" class="h-8 px-2 -ml-2" onclick={() => goto('/dashboard/music')}>
                        <ArrowLeft class="h-4 w-4 mr-2" />
                        Back to Player
                    </Button>
                </div>
                <h1 class="text-4xl font-black tracking-tight">Music Library</h1>
            </div>

            <div class="flex items-center gap-2">
                <Button variant="outline" size="lg" class="rounded-full px-6 font-bold" onclick={() => loadTracks(true)} disabled={isLoading}>
                    <RefreshCw class="h-4 w-4 mr-2 {isLoading ? 'animate-spin' : ''}" />
                    Refresh
                </Button>
            </div>
        </div>

        <MusicLibraryStats />
    </div>

    <!-- Main Content Split -->
    <div class="flex-1 flex overflow-hidden">
        {#if isMobile}
            <!-- Left Side: List (Mobile) -->
            <div class="flex-1 flex flex-col min-w-0 bg-background">
                <!-- Toolbar -->
                <div class="p-6 border-b border-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/10">
                    <div class="flex items-center gap-4 flex-1">
                        <div class="relative flex-1 max-w-md">
                            <Search class="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search library..." 
                                class="pl-12 h-11 rounded-xl bg-background border-primary/5 focus-visible:ring-primary/20 text-base shadow-sm"
                                bind:value={filter.search}
                            />
                        </div>
                        
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild let:builder>
                                <Button builders={[builder]} variant="outline" class="h-11 rounded-xl px-6 font-bold bg-background shadow-sm border-primary/5">
                                    <TagIcon class="h-4 w-4 mr-2" />
                                    Tags
                                    {#if filter.tags?.length}
                                        <Badge class="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">{filter.tags.length}</Badge>
                                    {/if}
                                </Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content align="start" class="w-56 p-2">
                                {#if allTags.length === 0}
                                    <div class="px-2 py-4 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No tags created</div>
                                {:else}
                                    {#each allTags as tag}
                                        <DropdownMenu.CheckboxItem
                                            checked={filter.tags?.includes(tag.id)}
                                            onCheckedChange={() => toggleTagFilter(tag.id)}
                                        >
                                            <div class="flex items-center gap-2">
                                                <div class="h-2 w-2 rounded-full" style="background-color: {tag.color}"></div>
                                                <span>{tag.name}</span>
                                            </div>
                                        </DropdownMenu.CheckboxItem>
                                    {/each}
                                    {#if filter.tags?.length}
                                        <DropdownMenu.Separator />
                                        <DropdownMenu.Item onclick={() => { filter.tags = []; filter.page = 1; loadTracks(true); }}>
                                            Clear All
                                        </DropdownMenu.Item>
                                    {/if}
                                {/if}
                            </DropdownMenu.Content>
                        </DropdownMenu.Root>

                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild let:builder>
                                <Button builders={[builder]} variant="outline" class="h-11 rounded-xl px-6 font-bold bg-background shadow-sm border-primary/5">
                                    <Filter class="h-4 w-4 mr-2" />
                                    Sort
                                </Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content align="start" class="w-48">
                                <DropdownMenu.Item onclick={() => { filter.sort = '-created'; loadTracks(true); }}>Recently Added</DropdownMenu.Item>
                                <DropdownMenu.Item onclick={() => { filter.sort = 'created'; loadTracks(true); }}>Oldest First</DropdownMenu.Item>
                                <DropdownMenu.Item onclick={() => { filter.sort = 'title'; loadTracks(true); }}>Title (A-Z)</DropdownMenu.Item>
                                <DropdownMenu.Item onclick={() => { filter.sort = 'artist'; loadTracks(true); }}>Artist</DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Root>
                    </div>

                    <div class="flex items-center gap-2">
                        {#if selectedIds.size > 0}
                            <div class="flex items-center gap-2 mr-4" in:fade>
                                <span class="text-xs font-black bg-primary text-primary-foreground px-3 py-1.5 rounded-full">
                                    {selectedIds.size} SELECTED
                                </span>
                                <Button variant="outline" size="sm" class="rounded-full font-bold h-9" onclick={() => showBulkEditDialog = true}>
                                    <Layers class="h-3.5 w-3.5 mr-2" />
                                    Bulk Edit
                                </Button>
                                <Button variant="destructive" size="sm" class="rounded-full font-bold h-9" onclick={() => showBulkDeleteConfirm = true}>
                                    <Trash2 class="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        {/if}
                        
                        <div class="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-full border border-primary/5">
                            <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} id="select-all-main-mobile" />
                            <Label for="select-all-main-mobile" class="text-[10px] font-black uppercase tracking-widest cursor-pointer pr-2">Select Page</Label>
                        </div>
                    </div>
                </div>

                <!-- List Area -->
                <div class="flex-1 overflow-y-auto themed-scrollbar scroll-smooth">
                    {#if isLoading && tracks.length === 0}
                        <div class="h-full flex flex-col items-center justify-center gap-4 py-24">
                            <LoadingSpinner size="lg" label="Reading disk index..." />
                        </div>
                    {:else if tracks.length === 0}
                        <div class="h-full flex items-center justify-center py-24">
                            <EmptyState 
                                icon={Music} 
                                title="Library is silent" 
                                description={filter.search ? "No results for your search." : "Start by uploading some music."} 
                                actionLabel={filter.search ? "Clear Search" : "Back to Dashboard"}
                                onaction={() => { if (filter.search) { filter.search = ''; loadTracks(true); } else { goto('/dashboard'); } }}
                            />
                        </div>
                    {:else}
                        <MusicTrackList 
                            {tracks} 
                            {selectedIds} 
                            activeTrackId={activeTrack?.id || null}
                            onselect={toggleSelectTrack}
                            onclick={handleTrackClick}
                            onplay={(track) => MusicPlayerService.playTrack(track)}
                        />

                        <!-- Pagination -->
                        {#if totalItems > filter.perPage!}
                            <div class="p-8 flex justify-center border-t border-primary/5 bg-muted/5">
                                <Pagination 
                                    currentPage={filter.page || 1} 
                                    {totalItems} 
                                    perPage={filter.perPage || 24} 
                                    onPageChange={(page) => { filter.page = page; loadTracks(true); }}
                                />
                            </div>
                        {/if}
                    {/if}
                </div>
            </div>
        {:else}
            <Resizable.PaneGroup direction="horizontal">
                <Resizable.Pane defaultSize={70}>
                    <div class="flex flex-col h-full min-w-0 bg-background">
                        <!-- Toolbar -->
                        <div class="p-6 border-b border-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/10">
                            <div class="flex items-center gap-4 flex-1">
                                <div class="relative flex-1 max-w-md">
                                    <Search class="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Search library..." 
                                        class="pl-12 h-11 rounded-xl bg-background border-primary/5 focus-visible:ring-primary/20 text-base shadow-sm"
                                        bind:value={filter.search}
                                    />
                                </div>
                                
                                <DropdownMenu.Root>
                                    <DropdownMenu.Trigger asChild let:builder>
                                        <Button builders={[builder]} variant="outline" class="h-11 rounded-xl px-6 font-bold bg-background shadow-sm border-primary/5">
                                            <TagIcon class="h-4 w-4 mr-2" />
                                            Tags
                                            {#if filter.tags?.length}
                                                <Badge class="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">{filter.tags.length}</Badge>
                                            {/if}
                                        </Button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content align="start" class="w-56 p-2">
                                        {#if allTags.length === 0}
                                            <div class="px-2 py-4 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No tags created</div>
                                        {:else}
                                            {#each allTags as tag}
                                                <DropdownMenu.CheckboxItem
                                                    checked={filter.tags?.includes(tag.id)}
                                                    onCheckedChange={() => toggleTagFilter(tag.id)}
                                                >
                                                    <div class="flex items-center gap-2">
                                                        <div class="h-2 w-2 rounded-full" style="background-color: {tag.color}"></div>
                                                        <span>{tag.name}</span>
                                                    </div>
                                                </DropdownMenu.CheckboxItem>
                                            {/each}
                                            {#if filter.tags?.length}
                                                <DropdownMenu.Separator />
                                                <DropdownMenu.Item onclick={() => { filter.tags = []; filter.page = 1; loadTracks(true); }}>
                                                    Clear All
                                                </DropdownMenu.Item>
                                            {/if}
                                        {/if}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Root>

                                <DropdownMenu.Root>
                                    <DropdownMenu.Trigger asChild let:builder>
                                        <Button builders={[builder]} variant="outline" class="h-11 rounded-xl px-6 font-bold bg-background shadow-sm border-primary/5">
                                            <Filter class="h-4 w-4 mr-2" />
                                            Sort
                                        </Button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content align="start" class="w-48">
                                        <DropdownMenu.Item onclick={() => { filter.sort = '-created'; loadTracks(true); }}>Recently Added</DropdownMenu.Item>
                                        <DropdownMenu.Item onclick={() => { filter.sort = 'created'; loadTracks(true); }}>Oldest First</DropdownMenu.Item>
                                        <DropdownMenu.Item onclick={() => { filter.sort = 'title'; loadTracks(true); }}>Title (A-Z)</DropdownMenu.Item>
                                        <DropdownMenu.Item onclick={() => { filter.sort = 'artist'; loadTracks(true); }}>Artist</DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Root>
                            </div>

                            <div class="flex items-center gap-2">
                                {#if selectedIds.size > 0}
                                    <div class="flex items-center gap-2 mr-4" in:fade>
                                        <span class="text-xs font-black bg-primary text-primary-foreground px-3 py-1.5 rounded-full">
                                            {selectedIds.size} SELECTED
                                        </span>
                                        <Button variant="outline" size="sm" class="rounded-full font-bold h-9" onclick={() => showBulkEditDialog = true}>
                                            <Layers class="h-3.5 w-3.5 mr-2" />
                                            Bulk Edit
                                        </Button>
                                        <Button variant="destructive" size="sm" class="rounded-full font-bold h-9" onclick={() => showBulkDeleteConfirm = true}>
                                            <Trash2 class="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                {/if}
                                
                                <div class="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-full border border-primary/5">
                                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} id="select-all-main-desktop" />
                                    <Label for="select-all-main-desktop" class="text-[10px] font-black uppercase tracking-widest cursor-pointer pr-2">Select Page</Label>
                                </div>
                            </div>
                        </div>

                        <!-- List Area -->
                        <div class="flex-1 overflow-y-auto themed-scrollbar scroll-smooth">
                            {#if isLoading && tracks.length === 0}
                                <div class="h-full flex flex-col items-center justify-center gap-4 py-24">
                                    <LoadingSpinner size="lg" label="Reading disk index..." />
                                </div>
                            {:else if tracks.length === 0}
                                <div class="h-full flex items-center justify-center py-24">
                                    <EmptyState 
                                        icon={Music} 
                                        title="Library is silent" 
                                        description={filter.search ? "No results for your search." : "Start by uploading some music."} 
                                        actionLabel={filter.search ? "Clear Search" : "Back to Dashboard"}
                                        onaction={() => { if (filter.search) { filter.search = ''; loadTracks(true); } else { goto('/dashboard'); } }}
                                    />
                                </div>
                            {:else}
                                <MusicTrackList 
                                    {tracks} 
                                    {selectedIds} 
                                    activeTrackId={activeTrack?.id || null}
                                    onselect={toggleSelectTrack}
                                    onclick={handleTrackClick}
                                    onplay={(track) => MusicPlayerService.playTrack(track)}
                                />

                                <!-- Pagination -->
                                {#if totalItems > filter.perPage!}
                                    <div class="p-8 flex justify-center border-t border-primary/5 bg-muted/5">
                                        <Pagination 
                                            currentPage={filter.page || 1} 
                                            {totalItems} 
                                            perPage={filter.perPage || 24} 
                                            onPageChange={(page) => { filter.page = page; loadTracks(true); }}
                                        />
                                    </div>
                                {/if}
                            {/if}
                        </div>
                    </div>
                </Resizable.Pane>
                
                <Resizable.Handle withHandle />
                
                <Resizable.Pane defaultSize={30} minSize={20}>
                    <TrackLibraryDetail 
                        track={activeTrack}
                        onclose={() => activeTrack = null}
                        onsubmit={() => loadTracks(true)}
                        ondelete={() => showDeleteConfirm = true}
                    />
                </Resizable.Pane>
            </Resizable.PaneGroup>
        {/if}
    </div>
</div>

<!-- Mobile Edit Dialog -->
{#if isMobile}
    <TrackEditDialog 
        bind:open={showMobileEdit} 
        track={activeTrack}
        onsubmit={() => loadTracks(true)}
        onclose={() => activeTrack = null}
    />
{/if}

<!-- Modals -->
<BulkEditDialog 
    bind:open={showBulkEditDialog}
    {selectedTracks}
    onsubmit={() => { loadTracks(true); selectedIds.clear(); selectedIds = new Set(); }}
    onclose={() => {}}
/>

<ConfirmDialog 
    bind:open={showDeleteConfirm}
    title="Permanently Delete Track?"
    description={`This will erase "${activeTrack?.title}" from your server disk. This cannot be undone.`}
    confirmText="Erase from Disk"
    variant="destructive"
    onconfirm={() => confirmDelete()}
/>

<ConfirmDialog 
    bind:open={showBulkDeleteConfirm}
    title={`Erase ${selectedIds.size} Tracks?`}
    description={`All ${selectedIds.size} files will be permanently deleted from your server disk.`}
    confirmText="Erase All"
    variant="destructive"
    onconfirm={confirmBulkDelete}
/>

<style>
    .themed-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .themed-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .themed-scrollbar::-webkit-scrollbar-thumb {
        background: hsl(var(--primary) / 0.05);
        border-radius: 10px;
    }
    .themed-scrollbar::-webkit-scrollbar-thumb:hover {
        background: hsl(var(--primary) / 0.1);
    }
</style>

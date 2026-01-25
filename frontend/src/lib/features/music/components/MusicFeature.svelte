<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { Music, Upload, Search, List, Grid, Disc, Users, Folder, BarChart3, Plus, Play, Tag as TagIcon } from 'lucide-svelte';
    import { MusicService, MusicPlayerService } from '../services';
    import type { MusicTrack, AlbumInfo, ArtistInfo, MusicPlaylist, MusicFilter, ListeningStats, Tag } from '../types';
    import { SEARCH_DEBOUNCE_MS } from '../constants';
    import { withErrorHandling } from '$lib/utils';
    import { useDebouncedFilter } from '$lib/hooks';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import EmptyState from '$lib/components/EmptyState.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import * as Tabs from '$lib/components/ui/tabs';
    import * as Card from '$lib/components/ui/card';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import { Badge } from '$lib/components/ui/badge';
    import TrackList from './TrackList.svelte';
    import AlbumGrid from './AlbumGrid.svelte';
    import ArtistList from './ArtistList.svelte';
    import PlaylistManager from './PlaylistManager.svelte';
    import FloatingPlayer from './FloatingPlayer.svelte';
    import UploadMusic from './UploadMusic.svelte';
    import MusicStats from './MusicStats.svelte';
    import HeroSection from './HeroSection.svelte';
    import HorizontalScroll from './HorizontalScroll.svelte';
    import TrackCard from './TrackCard.svelte';
    import { animate, stagger } from 'animejs';

    let tracks = $state<MusicTrack[]>([]);
    let allTags = $state<Tag[]>([]);
    let albums = $state<AlbumInfo[]>([]);
    let artists = $state<ArtistInfo[]>([]);
    let playlists = $state<MusicPlaylist[]>([]);
    let genres = $state<string[]>([]);
    let stats = $state<ListeningStats | null>(null);
    
    let isLoading = $state(true);
    let activeTab = $state('tracks');
    let showUploadDialog = $state(false);
    let filter = $state<MusicFilter>({
        tags: []
    });

    useDebouncedFilter(
        () => filter,
        () => loadTracks(true),
        SEARCH_DEBOUNCE_MS
    );

    async function loadTracks(reset = false) {
        if (reset) tracks = [];
        await withErrorHandling(
            () => MusicService.getTracks(filter),
            {
                errorMessage: 'Failed to load tracks',
                onSuccess: (result) => {
                    tracks = result.items;
                }
            }
        );
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
        loadTracks(true);
    }

    async function loadAlbums() {
        await withErrorHandling(
            () => MusicService.getAlbums(),
            {
                errorMessage: 'Failed to load albums',
                onSuccess: (result) => {
                    albums = result;
                }
            }
        );
    }

    async function loadArtists() {
        await withErrorHandling(
            () => MusicService.getArtists(),
            {
                errorMessage: 'Failed to load artists',
                onSuccess: (result) => {
                    artists = result;
                }
            }
        );
    }

    async function loadPlaylists() {
        await withErrorHandling(
            () => MusicService.getPlaylists(),
            {
                errorMessage: 'Failed to load playlists',
                onSuccess: (result) => {
                    playlists = result;
                }
            }
        );
    }

    async function loadStats() {
        await withErrorHandling(
            () => MusicService.getListeningStats(),
            {
                onSuccess: (result) => {
                    stats = result;
                }
            }
        );
    }

    async function loadAll() {
        isLoading = true;
        await Promise.all([
            loadTracks(),
            loadTags(),
            loadAlbums(),
            loadArtists(),
            loadPlaylists(),
            loadStats()
        ]);
        isLoading = false;

        setTimeout(() => {
            animate('.music-section-anim', {
                opacity: [0, 1],
                translateY: [20, 0],
                delay: stagger(100),
                duration: 600,
                easing: 'easeOutCubic'
            });
        }, 0);
    }

    function handlePlayTrack(track: MusicTrack) {
        MusicPlayerService.playTrack(track);
    }

    function handleUploadComplete() {
        showUploadDialog = false;
        loadAll();
    }

    onMount(() => {
        MusicPlayerService.initialize();
        loadAll();
    });
</script>

<div class="music-floating-layout">
    <div class="mx-auto w-full max-w-[1600px] space-y-12 pb-32">
        <HeroSection />

        <Card.Root class="music-section-anim opacity-0 bg-card shadow-xl overflow-visible rounded-[2rem]">
            <Card.Header class="flex flex-row items-center justify-between border-b border-primary/5 px-8 py-6">
                <div class="flex items-center gap-8">
                    <Tabs.Root value={activeTab} onValueChange={(v) => activeTab = v} class="w-auto">
                        <Tabs.List class="bg-primary/5 rounded-full p-1 h-12">
                            <Tabs.Trigger value="tracks" class="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-full px-8 h-full font-bold transition-all">
                                Tracks
                            </Tabs.Trigger>
                            <Tabs.Trigger value="albums" class="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-full px-8 h-full font-bold transition-all">
                                Albums
                            </Tabs.Trigger>
                            <Tabs.Trigger value="artists" class="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-full px-8 h-full font-bold transition-all">
                                Artists
                            </Tabs.Trigger>
                            <Tabs.Trigger value="playlists" class="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-full px-8 h-full font-bold transition-all">
                                Playlists
                            </Tabs.Trigger>
                            <Tabs.Trigger value="stats" class="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-full px-8 h-full font-bold transition-all">
                                Stats
                            </Tabs.Trigger>
                        </Tabs.List>
                    </Tabs.Root>

                    <div class="relative w-80">
                        <Search class="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search library..."
                            class="pl-12 h-12 rounded-full bg-primary/5 border-none focus-visible:ring-2 focus-visible:ring-primary/20 text-base"
                            bind:value={filter.search}
                        />
                    </div>

                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild let:builder>
                            {#snippet trigger(builder)}
                                <Button builders={[builder]} variant="ghost" size="icon" class="h-12 w-12 rounded-full bg-primary/5 hover:bg-primary/10 relative transition-all">
                                    <TagIcon class="h-5 w-5 text-primary/60" />
                                    {#if filter.tags?.length}
                                        <Badge class="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] animate-in zoom-in">{filter.tags.length}</Badge>
                                    {/if}
                                </Button>
                            {/snippet}
                            {@render trigger(builder)}
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="start" class="w-56 p-2 bg-background/95 backdrop-blur shadow-2xl border-primary/10">
                            {#if allTags.length === 0}
                                <div class="px-2 py-4 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No tags found</div>
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
                                    <DropdownMenu.Separator class="bg-primary/5" />
                                    <DropdownMenu.Item onclick={() => { filter.tags = []; loadTracks(true); }} class="text-xs font-bold text-center justify-center text-primary">
                                        Clear Filters
                                    </DropdownMenu.Item>
                                {/if}
                            {/if}
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                </div>

                <div class="flex items-center gap-3">
                    <Button variant="outline" size="lg" class="rounded-full px-8 font-bold h-12" onclick={() => goto('/dashboard/music/library')}>
                        <List class="h-5 w-5 mr-2" />
                        Manage
                    </Button>
                <Button variant="primary" size="lg" class="rounded-full px-8 font-bold shadow-lg h-12" onclick={() => showUploadDialog = true}>
                    <Plus class="h-5 w-5 mr-2" />
                    Upload
                </Button>
                </div>
            </Card.Header>
            
            <Card.Content class="p-8 min-h-[600px]">
                {#if isLoading}
                    <div class="h-96 flex items-center justify-center">
                        <LoadingSpinner size="lg" label="Syncing your universe..." />
                    </div>
                {:else}
                    <div class="animate-in fade-in duration-500">
                        {#if activeTab === 'tracks'}
                            {#if tracks.length === 0}
                                <EmptyState
                                    icon={Music}
                                    title="Your library is silent"
                                    description="Start uploading your favorite tracks to build your universe"
                                    actionLabel="Upload Music"
                                    onaction={() => showUploadDialog = true}
                                />
                            {:else}
                                <TrackList 
                                    {tracks} 
                                    onplay={handlePlayTrack}
                                    onrefresh={loadTracks}
                                />
                            {/if}
                        {:else if activeTab === 'albums'}
                            <AlbumGrid 
                                {albums}
                                onselect={(album) => {
                                    filter.album = album.album;
                                    activeTab = 'tracks';
                                }}
                            />
                        {:else if activeTab === 'artists'}
                            <ArtistList 
                                {artists}
                                onselect={(artist) => {
                                    filter.artist = artist.artist;
                                    activeTab = 'tracks';
                                }}
                            />
                        {:else if activeTab === 'playlists'}
                            <PlaylistManager 
                                {playlists}
                                onrefresh={loadPlaylists}
                            />
                        {:else if activeTab === 'stats'}
                            <MusicStats />
                        {/if}
                    </div>
                {/if}
            </Card.Content>
        </Card.Root>

        <div class="space-y-12">
            {#if stats?.recent_plays?.length}
                <div class="music-section-anim opacity-0">
                    <HorizontalScroll title="Recently Played">
                        {#snippet children()}
                            {#each stats.recent_plays as play}
                                <TrackCard 
                                    track={{
                                        id: play.track_id,
                                        title: play.title,
                                        artist: play.artist,
                                        cover_art: '', // stats might need enhancement to include cover_art
                                    } as any} 
                                />
                            {/each}
                        {/snippet}
                    </HorizontalScroll>
                </div>
            {/if}

            {#if albums.length}
                <div class="music-section-anim opacity-0">
                    <HorizontalScroll title="Your Albums">
                        {#snippet children()}
                            {#each albums.slice(0, 10) as album}
                                <button
                                    class="scroll-item-anim w-[200px] flex-shrink-0 group/album text-left"
                                    onclick={() => {
                                        filter.album = album.album;
                                        activeTab = 'tracks';
                                    }}
                                >
                                    <div class="aspect-square rounded-2xl overflow-hidden mb-3 shadow-md group-hover/album:shadow-xl transition-all duration-300 relative">
                                        {#if album.cover_art}
                                            <img src={MusicService.getAlbumCoverUrl(album)} alt={album.album} class="w-full h-full object-cover transition-transform duration-500 group-hover/album:scale-110" />
                                        {:else}
                                            <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30 text-primary">
                                                <Disc class="h-12 w-12" />
                                            </div>
                                        {/if}
                                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/album:opacity-100 transition-opacity flex items-center justify-center">
                                            <div class="h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg transform translate-y-4 group-hover/album:translate-y-0 transition-transform duration-300">
                                                <Play class="h-6 w-6 text-primary-foreground fill-current ml-1" />
                                            </div>
                                        </div>
                                    </div>
                                    <h3 class="font-bold truncate text-sm mb-0.5">{album.album}</h3>
                                    <p class="text-xs text-muted-foreground truncate font-medium">{album.artist}</p>
                                </button>
                            {/each}
                        {/snippet}
                    </HorizontalScroll>
                </div>
            {/if}
        </div>
    </div>

    <FloatingPlayer />

    {#if showUploadDialog}
        <UploadMusic
            bind:open={showUploadDialog}
            oncomplete={handleUploadComplete}
        />
    {/if}
</div>

<style>
    .music-floating-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 2rem;
        overflow-y: auto;
        overflow-x: hidden;
        background: radial-gradient(circle at top right, hsl(var(--primary) / 0.05), transparent 40%),
                    radial-gradient(circle at bottom left, hsl(var(--primary) / 0.05), transparent 40%);
    }

    .music-floating-layout::-webkit-scrollbar {
        width: 8px;
    }

    .music-floating-layout::-webkit-scrollbar-track {
        background: transparent;
    }

    .music-floating-layout::-webkit-scrollbar-thumb {
        background: hsl(var(--muted-foreground) / 0.2);
        border-radius: 10px;
    }

    .music-floating-layout::-webkit-scrollbar-thumb:hover {
        background: hsl(var(--muted-foreground) / 0.3);
    }
</style>

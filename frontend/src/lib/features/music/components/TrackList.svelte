<script lang="ts">
    import { Play, Pause, MoreVertical, Plus, Trash2, Clock, ListMusic } from 'lucide-svelte';
    import type { MusicTrack } from '../types';
    import { MusicService, MusicPlayerService } from '../services';
    import { withErrorHandling } from '$lib/utils';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import { onMount } from 'svelte';
    import { animate, stagger } from 'animejs';

    interface Props {
        tracks: MusicTrack[];
        onplay: (track: MusicTrack) => void;
        onrefresh: () => void;
    }

    let { tracks, onplay, onrefresh }: Props = $props();

    let currentTrack = $derived(MusicPlayerService.currentTrack);
    let isPlaying = $derived(MusicPlayerService.isPlaying);

    function isCurrentTrack(track: MusicTrack): boolean {
        return currentTrack?.id === track.id;
    }

    function handlePlay(track: MusicTrack) {
        if (isCurrentTrack(track)) {
            MusicPlayerService.togglePlayPause();
        } else {
            onplay(track);
        }
    }

    function handlePlayFromHere(track: MusicTrack) {
        const startIndex = tracks.findIndex(t => t.id === track.id);
        MusicPlayerService.playQueue(tracks, startIndex);
    }

    function handleAddToQueue(track: MusicTrack) {
        MusicPlayerService.addToQueue(track);
    }

    async function handleDelete(track: MusicTrack) {
        await withErrorHandling(
            () => MusicService.deleteTrack(track.id),
            {
                successMessage: 'Track deleted',
                errorMessage: 'Failed to delete track',
                onSuccess: onrefresh
            }
        );
    }

    onMount(() => {
        animate('.track-row-anim', {
            opacity: [0, 1],
            translateX: [-10, 0],
            delay: stagger(20),
            duration: 400,
            easing: 'easeOutQuad'
        });
    });
</script>

<div class="space-y-0.5">
    <div class="grid grid-cols-[48px_1fr_1fr_1fr_120px_80px_48px] gap-4 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 border-b border-primary/5">
        <div class="text-center">#</div>
        <div>Title</div>
        <div>Artist</div>
        <div>Album</div>
        <div>Tags</div>
        <div class="text-right pr-2">
            <Clock class="h-3 w-3 inline" />
        </div>
        <div></div>
    </div>

    <div class="pt-2">
        {#each tracks as track, index}
            <div
                class="track-row-anim opacity-0 grid grid-cols-[48px_1fr_1fr_1fr_120px_80px_48px] gap-4 px-4 py-2.5 items-center rounded-xl hover:bg-primary/5 group transition-all duration-200 {isCurrentTrack(track) ? 'bg-primary/10' : ''}"
            >
                <div class="flex items-center justify-center relative h-10 w-10 mx-auto">
                    <button
                        class="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-background/80 rounded-lg shadow-sm"
                        onclick={() => handlePlay(track)}
                    >
                        {#if isCurrentTrack(track) && isPlaying}
                            <Pause class="h-4 w-4 text-primary fill-current" />
                        {:else}
                            <Play class="h-4 w-4 text-primary fill-current ml-0.5" />
                        {/if}
                    </button>
                    
                    {#if isCurrentTrack(track) && isPlaying}
                        <div class="flex items-end gap-0.5 h-3">
                            <div class="w-0.5 bg-primary animate-[music-bar_0.8s_ease-in-out_infinite] h-full"></div>
                            <div class="w-0.5 bg-primary animate-[music-bar_0.6s_ease-in-out_infinite_0.1s] h-2/3"></div>
                            <div class="w-0.5 bg-primary animate-[music-bar_1s_ease-in-out_infinite_0.2s] h-full"></div>
                        </div>
                    {:else}
                        <span class="group-hover:opacity-0 text-xs font-bold text-muted-foreground/60 {isCurrentTrack(track) ? 'text-primary' : ''}">
                            {index + 1}
                        </span>
                    {/if}
                </div>

                <div class="flex items-center gap-3 min-w-0">
                    <div class="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 shadow-sm border border-primary/5">
                        {#if track.cover_art}
                            <img src={MusicService.getTrackCoverUrl(track)} alt="" class="h-full w-full object-cover" />
                        {:else}
                            <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/20">
                                <ListMusic class="h-4 w-4 text-primary/40" />
                            </div>
                        {/if}
                    </div>
                    <div class="truncate">
                        <span class="text-sm font-bold {isCurrentTrack(track) ? 'text-primary' : ''}">{track.title}</span>
                    </div>
                </div>

                <div class="truncate text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{track.artist}</div>

                <div class="truncate text-sm font-medium text-muted-foreground/60">{track.album}</div>

                <div class="flex flex-wrap gap-1 overflow-hidden max-h-8">
                    {#if track.expand?.tags}
                        {#each track.expand.tags.slice(0, 1) as tag}
                            <Badge 
                                variant="outline" 
                                class="px-1.5 py-0 text-[8px] font-bold uppercase tracking-tighter border-none bg-muted/30"
                                style="color: {tag.color}; background-color: {tag.color}15"
                            >
                                {tag.name}
                            </Badge>
                        {/each}
                        {#if track.expand.tags.length > 1}
                            <span class="text-[8px] font-black text-muted-foreground/40">+{track.expand.tags.length - 1}</span>
                        {/if}
                    {/if}
                </div>

                <div class="text-right text-xs font-mono text-muted-foreground/60 pr-2">
                    {MusicService.formatDuration(track.duration)}
                </div>

                <div class="flex justify-end">
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild let:builder>
                            <Button builders={[builder]} variant="ghost" size="icon" class="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical class="h-4 w-4" />
                            </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end" class="w-48 bg-background/95 backdrop-blur shadow-2xl border-primary/10">
                            <DropdownMenu.Item onclick={() => handlePlayFromHere(track)} class="font-medium">
                                <Play class="h-4 w-4 mr-2" />
                                Play from here
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onclick={() => handleAddToQueue(track)} class="font-medium">
                                <Plus class="h-4 w-4 mr-2" />
                                Add to queue
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator class="bg-primary/5" />
                            <DropdownMenu.Item onclick={() => handleDelete(track)} class="text-destructive font-medium focus:bg-destructive/10 focus:text-destructive">
                                <Trash2 class="h-4 w-4 mr-2" />
                                Delete
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    @keyframes music-bar {
        0%, 100% { height: 4px; }
        50% { height: 12px; }
    }
</style>

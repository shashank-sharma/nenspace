<script lang="ts">
    import { Play, Pause, MoreVertical, Edit2, Trash2, Clock, ListMusic, Star, Tag as TagIcon } from 'lucide-svelte';
    import type { MusicTrack } from '../types';
    import { MusicService, MusicPlayerService } from '../services';
    import { Button } from '$lib/components/ui/button';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { Badge } from '$lib/components/ui/badge';
    import { cn } from '$lib/utils';
    import { animate, stagger } from 'animejs';
    import { onMount } from 'svelte';

    interface Props {
        tracks: MusicTrack[];
        selectedIds: Set<string>;
        activeTrackId: string | null;
        onselect: (id: string) => void;
        onclick: (track: MusicTrack) => void;
        onplay: (track: MusicTrack) => void;
    }

    let { tracks, selectedIds, activeTrackId, onselect, onclick, onplay }: Props = $props();

    let currentTrack = $derived(MusicPlayerService.currentTrack);
    let isPlaying = $derived(MusicPlayerService.isPlaying);

    function isCurrentTrack(track: MusicTrack): boolean {
        return currentTrack?.id === track.id;
    }

    onMount(() => {
        animate('.track-row-anim', {
            opacity: [0, 1],
            translateX: [-10, 0],
            delay: stagger(15),
            duration: 400,
            easing: 'easeOutQuad'
        });
    });
</script>

<div class="w-full overflow-hidden">
    <div class="grid grid-cols-[48px_48px_1fr_1fr_1fr_140px_80px_100px_48px] gap-4 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 border-b border-primary/5 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div class="text-center"></div>
        <div class="text-center">#</div>
        <div>Title</div>
        <div>Artist</div>
        <div>Album</div>
        <div>Tags</div>
        <div class="text-right">
            <Clock class="h-3 w-3 inline" />
        </div>
        <div>Rating</div>
        <div></div>
    </div>

    <div class="divide-y divide-primary/5">
        {#each tracks as track, index}
            <button
                class={cn(
                    "track-row-anim opacity-0 w-full grid grid-cols-[48px_48px_1fr_1fr_1fr_140px_80px_100px_48px] gap-4 px-6 py-3 items-center hover:bg-primary/5 transition-all duration-200 text-left group",
                    activeTrackId === track.id ? "bg-primary/10 shadow-inner" : "",
                    isCurrentTrack(track) ? "text-primary" : ""
                )}
                onclick={() => onclick(track)}
            >
                <div class="flex justify-center" onclick={(e) => e.stopPropagation()}>
                    <Checkbox 
                        checked={selectedIds.has(track.id)} 
                        onCheckedChange={() => onselect(track.id)} 
                        class="border-primary/20 data-[state=checked]:bg-primary"
                    />
                </div>

                <div class="relative h-8 w-8 flex items-center justify-center">
                    {#if isCurrentTrack(track) && isPlaying}
                        <div class="flex items-end gap-0.5 h-3">
                            <div class="w-0.5 bg-primary animate-[music-bar_0.8s_ease-in-out_infinite] h-full"></div>
                            <div class="w-0.5 bg-primary animate-[music-bar_0.6s_ease-in-out_infinite_0.1s] h-2/3"></div>
                            <div class="w-0.5 bg-primary animate-[music-bar_1s_ease-in-out_infinite_0.2s] h-full"></div>
                        </div>
                    {:else}
                        <span class="text-xs font-bold text-muted-foreground/40 group-hover:hidden">{index + 1}</span>
                        <Button 
                            variant="ghost" size="icon" class="h-8 w-8 rounded-full hidden group-hover:flex items-center justify-center"
                            onclick={(e) => { e.stopPropagation(); onplay(track); }}
                        >
                            <Play class="h-4 w-4 fill-current ml-0.5" />
                        </Button>
                    {/if}
                </div>

                <div class="flex items-center gap-3 min-w-0">
                    <div class="h-8 w-8 rounded-md overflow-hidden flex-shrink-0 border border-primary/5 bg-muted">
                        {#if track.cover_art}
                            <img src={MusicService.getTrackCoverUrl(track)} alt="" class="h-full w-full object-cover" />
                        {:else}
                            <div class="h-full w-full flex items-center justify-center bg-primary/5 text-primary/20">
                                <ListMusic class="h-4 w-4" />
                            </div>
                        {/if}
                    </div>
                    <div class="truncate">
                        <p class="text-sm font-bold truncate">{track.title}</p>
                    </div>
                </div>

                <div class="truncate text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{track.artist}</div>
                <div class="truncate text-sm font-medium text-muted-foreground/60">{track.album || '-'}</div>
                
                <div class="flex flex-wrap gap-1 overflow-hidden max-h-8">
                    {#if track.expand?.tags}
                        {#each track.expand.tags.slice(0, 2) as tag}
                            <Badge 
                                variant="outline" 
                                class="px-1.5 py-0 text-[8px] font-bold uppercase tracking-tighter border-none bg-muted/30"
                                style="color: {tag.color}; background-color: {tag.color}15"
                            >
                                {tag.name}
                            </Badge>
                        {/each}
                        {#if track.expand.tags.length > 2}
                            <span class="text-[8px] font-black text-muted-foreground/40">+{track.expand.tags.length - 2}</span>
                        {/if}
                    {/if}
                </div>

                <div class="text-right text-xs font-mono text-muted-foreground/60">{MusicService.formatDuration(track.duration)}</div>
                
                <div class="flex gap-0.5 text-yellow-500/40">
                    {#if track.rating}
                        {#each Array(track.rating) as _}
                            <Star class="h-2.5 w-2.5 fill-current text-yellow-500" />
                        {/each}
                    {/if}
                </div>

                <div class="flex justify-end">
                    <Button variant="ghost" size="icon" class="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical class="h-4 w-4" />
                    </Button>
                </div>
            </button>
        {/each}
    </div>
</div>

<style>
    @keyframes music-bar {
        0%, 100% { height: 4px; }
        50% { height: 12px; }
    }
</style>




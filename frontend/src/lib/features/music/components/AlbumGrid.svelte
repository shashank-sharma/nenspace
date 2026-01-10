<script lang="ts">
    import { Disc, Play } from 'lucide-svelte';
    import type { AlbumInfo } from '../types';
    import { MusicService } from '../services';
    import { Button } from '$lib/components/ui/button';
    import * as Card from '$lib/components/ui/card';
    import { onMount } from 'svelte';
    import { animate, stagger } from 'animejs';

    interface Props {
        albums: AlbumInfo[];
        onselect: (album: AlbumInfo) => void;
    }

    let { albums, onselect }: Props = $props();

    onMount(() => {
        animate('.album-item-anim', {
            opacity: [0, 1],
            scale: [0.9, 1],
            translateY: [20, 0],
            delay: stagger(30),
            duration: 500,
            easing: 'easeOutCubic'
        });
    });
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
    {#each albums as album}
        <button
            class="album-item-anim opacity-0 group/album text-left"
            onclick={() => onselect(album)}
        >
            <div class="relative aspect-square rounded-2xl overflow-hidden mb-4 shadow-lg group-hover/album:shadow-2xl transition-all duration-500">
                {#if album.cover_art}
                    <img 
                        src={MusicService.getAlbumCoverUrl(album)} 
                        alt={album.album} 
                        class="w-full h-full object-cover transition-transform duration-700 group-hover/album:scale-110" 
                    />
                {:else}
                    <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30 text-primary">
                        <Disc class="h-16 w-16" />
                    </div>
                {/if}
                
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/album:opacity-100 transition-opacity flex items-center justify-center">
                    <div class="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-2xl transform translate-y-8 group-hover/album:translate-y-0 transition-transform duration-300">
                        <Play class="h-8 w-8 text-primary-foreground fill-current ml-1" />
                    </div>
                </div>
            </div>
            
            <div class="px-1">
                <h3 class="font-bold truncate text-base mb-1 group-hover/album:text-primary transition-colors">{album.album}</h3>
                <p class="text-sm text-muted-foreground truncate font-medium">{album.artist}</p>
                <div class="flex items-center gap-2 mt-2 text-xs text-muted-foreground/60 uppercase tracking-widest font-bold">
                    <span>{album.track_count} tracks</span>
                    {#if album.year}
                        <span class="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
                        <span>{album.year}</span>
                    {/if}
                </div>
            </div>
        </button>
    {/each}
</div>

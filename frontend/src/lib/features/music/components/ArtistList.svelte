<script lang="ts">
    import { User, ChevronRight, Play } from 'lucide-svelte';
    import type { ArtistInfo } from '../types';
    import { onMount } from 'svelte';
    import { animate, stagger } from 'animejs';

    interface Props {
        artists: ArtistInfo[];
        onselect: (artist: ArtistInfo) => void;
    }

    let { artists, onselect }: Props = $props();

    onMount(() => {
        animate('.artist-item-anim', {
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
    {#each artists as artist}
        <button
            class="artist-item-anim opacity-0 group/artist text-center"
            onclick={() => onselect(artist)}
        >
            <div class="relative aspect-square rounded-full overflow-hidden mb-4 shadow-lg group-hover/artist:shadow-2xl transition-all duration-500 mx-auto w-full max-w-[180px]">
                <div class="w-full h-full bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary group-hover/artist:scale-110 transition-transform duration-700">
                    <User class="h-1/2 w-1/2 opacity-40" />
                    <span class="absolute inset-0 flex items-center justify-center text-4xl font-black opacity-20 group-hover/artist:opacity-40 transition-opacity">
                        {artist.artist.charAt(0)}
                    </span>
                </div>
                
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/artist:opacity-100 transition-opacity flex items-center justify-center">
                    <div class="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-2xl transform scale-75 group-hover/artist:scale-100 transition-transform duration-300">
                        <Play class="h-8 w-8 text-primary-foreground fill-current ml-1" />
                    </div>
                </div>
            </div>
            
            <div class="px-2">
                <h3 class="font-bold truncate text-base mb-1 group-hover/artist:text-primary transition-colors">{artist.artist}</h3>
                <p class="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                    {artist.album_count} {artist.album_count === 1 ? 'album' : 'albums'}
                    <span class="mx-1 text-muted-foreground/30">•</span>
                    {artist.track_count} tracks
                </p>
            </div>
        </button>
    {/each}
</div>

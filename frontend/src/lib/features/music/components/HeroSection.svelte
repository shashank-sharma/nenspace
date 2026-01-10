<script lang="ts">
    import { Play, Pause, ListMusic, Music2 } from 'lucide-svelte';
    import { MusicPlayerService, MusicService } from '../services';
    import { Button } from '$lib/components/ui/button';
    import * as Card from '$lib/components/ui/card';
    import { animeFadeTransition } from '$lib/utils/transitions';

    let currentTrack = $derived(MusicPlayerService.currentTrack);
    let isPlaying = $derived(MusicPlayerService.isPlaying);

    function handleTogglePlay() {
        if (currentTrack) {
            MusicPlayerService.togglePlayPause();
        }
    }
</script>

<Card.Root class="relative w-full h-[400px] border-none overflow-hidden mb-8 group rounded-[2rem] shadow-2xl">
    <div 
        class="absolute inset-0 bg-gradient-to-br from-primary/40 via-background to-background transition-all duration-1000 group-hover:scale-105"
        style="background-image: {currentTrack?.cover_art ? `linear-gradient(to bottom right, hsl(var(--primary) / 0.4), hsl(var(--background))), url(${MusicService.getTrackCoverUrl(currentTrack)})` : 'none'}; background-size: cover; background-position: center; filter: blur(40px) saturate(1.5);"
    ></div>

    <div class="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>

    <Card.Content class="relative h-full flex items-end p-8 md:p-12">
        <div class="flex flex-col md:flex-row items-center md:items-end gap-8 w-full">
            <div class="h-48 w-48 md:h-64 md:w-64 rounded-2xl bg-muted shadow-2xl overflow-hidden flex-shrink-0 relative group/cover">
                {#if currentTrack?.cover_art}
                    <img 
                        src={MusicService.getTrackCoverUrl(currentTrack)} 
                        alt={currentTrack.title} 
                        class="h-full w-full object-cover transition-transform duration-700 group-hover/cover:scale-110" 
                    />
                {:else}
                    <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/50">
                        <Music2 class="h-24 w-24 text-primary" />
                    </div>
                {/if}
                
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        class="h-20 w-20 rounded-full text-white hover:scale-110 transition-transform"
                        onclick={handleTogglePlay}
                    >
                        {#if isPlaying}
                            <Pause class="h-10 w-10 fill-current" />
                        {:else}
                            <Play class="h-10 w-10 fill-current ml-2" />
                        {/if}
                    </Button>
                </div>
            </div>

            <div class="flex-1 text-center md:text-left">
                {#if currentTrack}
                    <div transition:animeFadeTransition>
                        <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary mb-2">Now Playing</p>
                        <h1 class="text-4xl md:text-6xl font-black mb-4 tracking-tight drop-shadow-sm line-clamp-2">{currentTrack.title}</h1>
                        <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-lg md:text-xl text-muted-foreground font-medium">
                            <span class="hover:text-primary cursor-pointer transition-colors truncate">{currentTrack.artist}</span>
                            <span class="hidden md:inline text-muted-foreground/30">•</span>
                            <span class="hover:text-primary cursor-pointer transition-colors truncate">{currentTrack.album}</span>
                            {#if currentTrack.year}
                                <span class="hidden md:inline text-muted-foreground/30">•</span>
                                <span>{currentTrack.year}</span>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div>
                        <p class="text-sm font-bold uppercase tracking-[0.2em] text-primary mb-2">Welcome Back</p>
                        <h1 class="text-4xl md:text-6xl font-black mb-4 tracking-tight">Your Music Universe</h1>
                        <p class="text-xl text-muted-foreground max-w-xl">Dive into your personal collection and discover your next favorite track.</p>
                    </div>
                {/if}

                <div class="flex items-center justify-center md:justify-start gap-4 mt-8">
                    <Button 
                        size="lg" 
                        class="rounded-full px-8 font-bold h-14 text-lg shadow-xl hover:scale-105 transition-transform"
                        onclick={handleTogglePlay}
                    >
                        {#if isPlaying}
                            <Pause class="h-6 w-6 mr-2 fill-current" />
                            Pause
                        {:else}
                            <Play class="h-6 w-6 mr-2 fill-current" />
                            Play Now
                        {/if}
                    </Button>
                    <Button 
                        variant="outline" 
                        size="lg" 
                        class="rounded-full px-8 font-bold h-14 text-lg backdrop-blur-sm bg-background/20 border-primary/20 hover:bg-background/40 transition-all"
                    >
                        <ListMusic class="h-6 w-6 mr-2" />
                        Shuffle All
                    </Button>
                </div>
            </div>
        </div>
    </Card.Content>
</Card.Root>


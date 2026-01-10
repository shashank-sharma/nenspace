<script lang="ts">
    import { Play, Pause, MoreVertical, Plus, ListMusic } from 'lucide-svelte';
    import type { MusicTrack } from '../types';
    import { MusicPlayerService, MusicService } from '../services';
    import { Button } from '$lib/components/ui/button';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import * as Card from '$lib/components/ui/card';

    interface Props {
        track: MusicTrack;
        class?: string;
    }

    let { track, class: className }: Props = $props();

    let currentTrack = $derived(MusicPlayerService.currentTrack);
    let isPlaying = $derived(MusicPlayerService.isPlaying);
    let isCurrent = $derived(currentTrack?.id === track.id);

    function handlePlay() {
        if (isCurrent) {
            MusicPlayerService.togglePlayPause();
        } else {
            MusicPlayerService.playTrack(track);
        }
    }

    function handleAddToQueue(e: MouseEvent) {
        e.stopPropagation();
        MusicPlayerService.addToQueue(track);
    }
</script>

<div class="scroll-item-anim w-[200px] flex-shrink-0 group/card {className}">
    <Card.Root class="border-none bg-transparent shadow-none overflow-visible">
        <div class="relative aspect-square rounded-2xl overflow-hidden mb-3 shadow-md group-hover/card:shadow-xl transition-all duration-300">
            {#if track.cover_art}
                <img 
                    src={MusicService.getTrackCoverUrl(track)} 
                    alt={track.title} 
                    class="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-110" 
                />
            {:else}
                <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30">
                    <ListMusic class="h-10 w-10 text-primary/40" />
                </div>
            {/if}

            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button 
                    variant="primary" 
                    size="icon" 
                    class="h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform"
                    onclick={handlePlay}
                >
                    {#if isCurrent && isPlaying}
                        <Pause class="h-6 w-6 fill-current" />
                    {:else}
                        <Play class="h-6 w-6 fill-current ml-1" />
                    {/if}
                </Button>
            </div>

            {#if isCurrent && isPlaying}
                <div class="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                    <div class="flex items-end gap-0.5 h-3">
                        <div class="w-0.5 bg-primary-foreground animate-[music-bar_0.8s_ease-in-out_infinite] h-full"></div>
                        <div class="w-0.5 bg-primary-foreground animate-[music-bar_0.6s_ease-in-out_infinite_0.1s] h-2/3"></div>
                        <div class="w-0.5 bg-primary-foreground animate-[music-bar_1s_ease-in-out_infinite_0.2s] h-full"></div>
                    </div>
                </div>
            {/if}
        </div>

        <div class="px-1">
            <h3 class="font-bold truncate text-sm mb-0.5 {isCurrent ? 'text-primary' : ''}">{track.title}</h3>
            <p class="text-xs text-muted-foreground truncate font-medium">{track.artist}</p>
        </div>

        <div class="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild let:builder>
                    <Button builders={[builder]} variant="secondary" size="icon" class="h-8 w-8 rounded-full bg-background/80 backdrop-blur shadow-md">
                        <MoreVertical class="h-4 w-4" />
                    </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                    <DropdownMenu.Item onclick={handlePlay}>
                        <Play class="h-4 w-4 mr-2" />
                        Play
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onclick={() => MusicPlayerService.addToQueue(track)}>
                        <Plus class="h-4 w-4 mr-2" />
                        Add to queue
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        </div>
    </Card.Root>
</div>

<style>
    @keyframes music-bar {
        0%, 100% { height: 4px; }
        50% { height: 12px; }
    }
</style>


<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { 
        Play, 
        Pause, 
        SkipBack, 
        SkipForward, 
        Volume2, 
        VolumeX,
        Repeat,
        Repeat1,
        Shuffle,
        ListMusic,
        X,
        GripVertical,
        Heart,
        MoreHorizontal
    } from 'lucide-svelte';
    import { MusicPlayerService, MusicService } from '../services';
    import { Button } from '$lib/components/ui/button';
    import { Slider as SliderPrimitive } from 'bits-ui';
    import * as Popover from '$lib/components/ui/popover';
    import * as Card from '$lib/components/ui/card';
    import { Slider } from '$lib/components/ui/slider';
    import { createDraggable, loadPosition } from '$lib/utils/draggable.util';
    import { browser } from '$app/environment';
    import { animate, stagger } from 'animejs';

    let currentTrack = $derived(MusicPlayerService.currentTrack);
    let isPlaying = $derived(MusicPlayerService.isPlaying);
    let currentTime = $derived(MusicPlayerService.currentTime);
    let duration = $derived(MusicPlayerService.duration);
    let buffered = $derived(MusicPlayerService.buffered);
    let volume = $derived(MusicPlayerService.volume);
    let isMuted = $derived(MusicPlayerService.isMuted);
    let repeatMode = $derived(MusicPlayerService.repeatMode);
    let shuffleMode = $derived(MusicPlayerService.shuffleMode);
    let queue = $derived(MusicPlayerService.queue);
    let progress = $derived(MusicPlayerService.progress);

    let playerElement = $state<HTMLElement | null>(null);
    let showQueue = $state(false);
    let seekValue = $state([0]);
    let isSeeking = $state(false);
    let isDragging = $state(false);
    let position = $state({ x: 0, y: 0 });
    const ELEMENT_SIZE = { width: 560, height: 130 };
    const STORAGE_KEY = 'music-player-position';

    let draggable: any;
    let lastSeekTime = 0;

    $effect(() => {
        if (!isSeeking) {
            seekValue = [progress];
        }
    });

    $effect(() => {
        if (showQueue) {
            setTimeout(() => {
                const items = document.querySelectorAll('.group\\/item');
                if (items.length > 0) {
                    animate(items, {
                        opacity: [0, 1],
                        translateX: [-10, 0],
                        delay: stagger(30),
                        duration: 400,
                        easing: 'easeOutQuad'
                    });
                }
            }, 50);
        }
    });

    onMount(() => {
        if (!browser) return;
        
        const savedPos = loadPosition(STORAGE_KEY, ELEMENT_SIZE, {
            x: (window.innerWidth - ELEMENT_SIZE.width) / 2,
            y: window.innerHeight - ELEMENT_SIZE.height - 40
        });
        position = savedPos;

        draggable = createDraggable({
            initialPosition: position,
            elementSize: ELEMENT_SIZE,
            storageKey: STORAGE_KEY,
            onDrag: (newPos) => {
                isDragging = true;
                position = newPos;
            },
            onDragEnd: (newPos) => {
                isDragging = false;
                position = newPos;
            }
        });

        if (playerElement) {
            animate(playerElement, {
                opacity: [0, 1],
                translateY: [20, 0],
                duration: 600,
                easing: 'easeOutExpo'
            });
        }
    });

    function handleSeekStart() {
        isSeeking = true;
    }

    function handleSeek(value: number[]) {
        isSeeking = true;
        seekValue = value;

        const now = Date.now();
        if (now - lastSeekTime > 150) {
            MusicPlayerService.seekPercent(value[0]);
            lastSeekTime = now;
        }
    }

    function handleSeekEnd(value: number[]) {
        MusicPlayerService.seekPercent(value[0]);
        setTimeout(() => {
            isSeeking = false;
        }, 150);
    }

    function handleVolumeChange(value: number[]) {
        MusicPlayerService.setVolume(value[0] / 100);
    }

    function getRepeatIcon() {
        if (repeatMode === 'one') return Repeat1;
        return Repeat;
    }

    function formatTime(seconds: number) {
        return MusicService.formatDuration(seconds);
    }

    let seekPreviewTime = $derived(formatTime((seekValue[0] / 100) * duration));
</script>

{#if currentTrack}
    <div
        bind:this={playerElement}
        class="fixed z-[100] {isDragging ? 'transition-none' : 'transition-all duration-500 ease-out'}"
        style="transform: translate({position.x}px, {position.y}px); width: {ELEMENT_SIZE.width}px;"
    >
        <Card.Root class="group/player overflow-hidden border-primary/10 bg-background/60 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-t border-l border-white/10 relative">
            <Button 
                variant="ghost" 
                size="icon" 
                class="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover/player:opacity-100 transition-opacity z-[60] hover:bg-destructive/10 hover:text-destructive"
                onclick={() => MusicPlayerService.stop()}
            >
                <X class="h-3 w-3" />
            </Button>

            <div class="px-8 h-8 flex items-center relative z-10 mt-2">
                <SliderPrimitive.Root
                    value={seekValue}
                    max={100}
                    step={0.1}
                    onValueChange={handleSeek}
                    onValueCommit={handleSeekEnd}
                    class="relative flex w-full h-full touch-none select-none items-center cursor-pointer group/slider-root"
                    let:thumbs
                >
                    <span class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/10 transition-all">
                        <div 
                            class="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-300" 
                            style="width: {buffered}%"
                        ></div>
                        <SliderPrimitive.Range class="absolute h-full bg-primary" />
                    </span>
                    {#each thumbs as thumb}
                        <SliderPrimitive.Thumb
                            {thumb}
                            class="block h-3.5 w-3.5 rounded-full bg-primary shadow-lg ring-2 ring-background/50 transition-all hover:scale-125 focus:outline-none focus:ring-primary/40 group-hover/slider-root:h-4 group-hover/slider-root:w-4"
                        />
                    {/each}

                    {#if isSeeking}
                        <div 
                            class="absolute -top-10 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-black px-2 py-1 rounded-md shadow-xl animate-in fade-in slide-in-from-bottom-2 z-50 whitespace-nowrap"
                        >
                            {seekPreviewTime}
                        </div>
                    {/if}
                </SliderPrimitive.Root>
            </div>

            <div class="flex items-center gap-4 px-6 py-4 pt-0">
                <div
                    class="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-primary/60 transition-colors p-1 -ml-1"
                    onmousedown={(e) => draggable?.handleMouseDown(e, position)}
                    ontouchstart={(e) => draggable?.handleTouchStart(e, position)}
                    role="button"
                    tabindex="0"
                    aria-label="Drag player"
                >
                    <GripVertical class="h-5 w-5" />
                </div>

                <div class="flex items-center gap-4 min-w-0 flex-1">
                    <div class="relative h-16 w-16 group/art flex-shrink-0">
                        <div class="absolute -inset-1 bg-gradient-to-tr from-primary/20 to-primary/0 rounded-xl blur-sm opacity-0 group-hover/art:opacity-100 transition-opacity"></div>
                        <div class="relative h-full w-full rounded-xl bg-muted flex items-center justify-center overflow-hidden shadow-lg transition-transform duration-500 group-hover/art:scale-105">
                            {#if currentTrack.cover_art}
                                <img 
                                    src={MusicService.getTrackCoverUrl(currentTrack)} 
                                    alt="" 
                                    class="h-full w-full object-cover {isPlaying ? 'animate-[pulse_4s_cubic-bezier(0.4,0,0.6,1)_infinite]' : ''}" 
                                />
                            {:else}
                                <div class="bg-gradient-to-br from-primary/20 to-primary/40 w-full h-full flex items-center justify-center">
                                    <ListMusic class="h-8 w-8 text-primary" />
                            </div>
                        {/if}
                        </div>
                    </div>
                    
                    <div class="min-w-0 flex-1">
                        <h4 class="font-black truncate text-sm tracking-tight leading-none mb-1.5">{currentTrack.title}</h4>
                        <p class="text-xs text-muted-foreground/80 truncate font-medium">{currentTrack.artist}</p>
                        <div class="flex items-center gap-2 mt-2">
                            <span class="text-[10px] font-bold text-primary tabular-nums">{formatTime(isSeeking ? (seekValue[0]/100)*duration : currentTime)}</span>
                            <div class="h-0.5 w-1 bg-muted-foreground/20 rounded-full"></div>
                            <span class="text-[10px] font-bold text-muted-foreground/60 tabular-nums">{formatTime(duration)}</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-1 bg-primary/5 rounded-full p-1 border border-primary/10">
                        <Button 
                            variant="ghost" 
                            size="icon"
                        class="h-8 w-8 rounded-full hover:bg-primary/10"
                            onclick={() => MusicPlayerService.previous()}
                        >
                            <SkipBack class="h-4 w-4 fill-current" />
                        </Button>

                        <Button 
                            variant="primary" 
                            size="icon"
                        class="h-10 w-10 rounded-full shadow-[0_8px_20px_rgba(var(--primary-rgb),0.3)] hover:scale-105 active:scale-95 transition-all"
                        onclick={() => {
                            MusicPlayerService.togglePlayPause();
                            animate('.play-icon', {
                                scale: [0.8, 1],
                                duration: 300,
                                easing: 'easeOutBack'
                            });
                        }}
                    >
                        <div class="play-icon">
                            {#if isPlaying}
                                <Pause class="h-5 w-5 fill-current" />
                            {:else}
                                <Play class="h-5 w-5 ml-0.5 fill-current" />
                            {/if}
                        </div>
                        </Button>

                        <Button 
                            variant="ghost" 
                            size="icon"
                        class="h-8 w-8 rounded-full hover:bg-primary/10"
                            onclick={() => MusicPlayerService.next()}
                        >
                            <SkipForward class="h-4 w-4 fill-current" />
                        </Button>
                </div>

                <div class="flex items-center gap-1 border-l border-primary/10 pl-2">
                    <Popover.Root>
                        <Popover.Trigger asChild let:builder>
                            <Button 
                                builders={[builder]} 
                                variant="ghost" 
                                size="icon" 
                                class="h-8 w-8 text-muted-foreground/60 hover:text-primary transition-colors"
                            >
                                {#if isMuted || volume === 0}
                                    <VolumeX class="h-4 w-4" />
                                {:else}
                                    <Volume2 class="h-4 w-4" />
                                {/if}
                            </Button>
                        </Popover.Trigger>
                        <Popover.Content class="w-12 p-3 bg-background/60 backdrop-blur-xl border-primary/10 shadow-2xl" align="center" side="top" sideOffset={15}>
                            <div class="h-32 flex flex-col items-center">
                                <Slider
                                    value={[volume * 100]}
                                    max={100}
                                    step={1}
                                    orientation="vertical"
                                    onValueChange={handleVolumeChange}
                                    class="h-full"
                                />
                            </div>
                        </Popover.Content>
                    </Popover.Root>

                    <Popover.Root bind:open={showQueue}>
                        <Popover.Trigger asChild let:builder>
                            <Button 
                                builders={[builder]} 
                                variant="ghost" 
                                size="icon" 
                                class="h-8 w-8 {showQueue ? 'text-primary' : 'text-muted-foreground/60'} hover:text-primary transition-colors"
                            >
                                <ListMusic class="h-4 w-4" />
                            </Button>
                        </Popover.Trigger>
                        <Popover.Content class="w-80 p-0 overflow-hidden bg-background/80 backdrop-blur-2xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-primary/10 rounded-2xl mb-4" align="end" side="top" sideOffset={15}>
                            <div class="p-4 border-b border-primary/5 bg-primary/5 flex items-center justify-between">
                                <div>
                                    <h4 class="font-black text-sm tracking-tight uppercase">Up Next</h4>
                                    <p class="text-[10px] text-muted-foreground font-bold">{queue.length} tracks in queue</p>
                                </div>
                                <div class="flex items-center gap-1">
                                    <Button 
                                        variant="ghost" 
                                        size="icon"
                                        class="h-7 w-7 rounded-full {shuffleMode === 'on' ? 'text-primary bg-primary/10' : 'text-muted-foreground/40'}"
                                        onclick={() => MusicPlayerService.toggleShuffle()}
                                    >
                                        <Shuffle class="h-3.5 w-3.5" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon"
                                        class="h-7 w-7 rounded-full {repeatMode !== 'none' ? 'text-primary bg-primary/10' : 'text-muted-foreground/40'}"
                                        onclick={() => MusicPlayerService.cycleRepeatMode()}
                                    >
                                        <svelte:component this={getRepeatIcon()} class="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <div class="max-h-[300px] overflow-auto py-2 px-2 space-y-1">
                                {#each queue as item, index}
                                    <button
                                        class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/10 rounded-xl text-left transition-all relative group/item {item.track.id === currentTrack.id ? 'bg-primary/5 shadow-inner' : ''}"
                                        onclick={() => MusicPlayerService.playFromQueue(item.queueId)}
                                    >
                                        <div class="relative h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 shadow-sm">
                                            {#if item.track.cover_art}
                                                <img src={MusicService.getTrackCoverUrl(item.track)} alt="" class="h-full w-full object-cover" />
                                            {:else}
                                                <div class="w-full h-full flex items-center justify-center bg-primary/5">
                                                    <ListMusic class="h-4 w-4 text-primary/40" />
                                                </div>
                                            {/if}
                                            {#if item.track.id === currentTrack.id && isPlaying}
                                                <div class="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center">
                                                    <div class="flex items-end gap-0.5 h-3">
                                                        <div class="w-0.5 bg-primary animate-[music-bar_0.8s_ease-in-out_infinite] h-full"></div>
                                                        <div class="w-0.5 bg-primary animate-[music-bar_0.6s_ease-in-out_infinite_0.1s] h-2/3"></div>
                                                        <div class="w-0.5 bg-primary animate-[music-bar_1s_ease-in-out_infinite_0.2s] h-full"></div>
                                                    </div>
                                                </div>
                                            {/if}
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <p class="truncate text-xs font-bold {item.track.id === currentTrack.id ? 'text-primary' : 'text-foreground/90'}">{item.track.title}</p>
                                            <p class="truncate text-[10px] text-muted-foreground/70 font-medium">{item.track.artist}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            class="h-8 w-8 opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive rounded-full"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                MusicPlayerService.removeFromQueue(item.queueId);
                                            }}
                                        >
                                            <X class="h-3.5 w-3.5" />
                                        </Button>
                                    </button>
                                {/each}
                            </div>
                        </Popover.Content>
                    </Popover.Root>
                </div>
            </div>
        </Card.Root>
    </div>
{/if}

<style>
    @keyframes music-bar {
        0%, 100% { height: 4px; }
        50% { height: 12px; }
    }

    :global(.group\/slider:hover .slider-thumb) {
        transform: scale(1.4);
        background: hsl(var(--primary));
        border-color: white;
    }
</style>

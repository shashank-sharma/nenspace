<script lang="ts">
    import { Music, Play, Pause, SkipBack, SkipForward } from 'lucide-svelte';
    import BaseView from './BaseView.svelte';
    import { IslandController } from '../../services/island-controller.service.svelte';
    import { MusicPlayerService } from '$lib/features/music';

    let track = $derived(MusicPlayerService.currentTrack);
    let isPlaying = $derived(MusicPlayerService.isPlaying);
    let progress = $derived(MusicPlayerService.progress);
    let isExpanded = $derived(IslandController.isExpanded);

    function toggleExpand(e: MouseEvent) {
        e.stopPropagation();
        IslandController.isExpanded = !IslandController.isExpanded;
    }

    function handleAction(e: MouseEvent, action: 'previous' | 'toggle' | 'next') {
        e.stopPropagation();
        switch (action) {
            case 'previous': MusicPlayerService.previous(); break;
            case 'toggle': MusicPlayerService.togglePlayPause(); break;
            case 'next': MusicPlayerService.next(); break;
        }
    }
</script>

<BaseView id="music">
    <div 
        class="flex items-center gap-3 px-4 h-full w-full select-none cursor-pointer"
        onclick={toggleExpand}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && toggleExpand(e as any)}
    >
        {#if isExpanded}
            <!-- Expanded View -->
            <div class="flex-shrink-0 text-white">
                <Music size={14} />
            </div>
            <div class="flex-1 min-w-0 text-left">
                <div class="text-xs font-semibold text-white truncate leading-tight">
                    {track?.title || 'Unknown Title'}
                </div>
                <div class="text-[10px] text-white/70 truncate leading-tight">
                    {track?.artist || 'Unknown Artist'}
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button class="p-1.5 hover:bg-white/10 rounded-full transition-colors" onclick={(e) => handleAction(e, 'previous')}>
                    <SkipBack size={12} class="text-white" />
                </button>
                <button class="p-1.5 hover:bg-white/10 rounded-full transition-colors" onclick={(e) => handleAction(e, 'toggle')}>
                    {#if isPlaying}
                        <Pause size={14} class="text-white" />
                    {:else}
                        <Play size={14} class="text-white" />
                    {/if}
                </button>
                <button class="p-1.5 hover:bg-white/10 rounded-full transition-colors" onclick={(e) => handleAction(e, 'next')}>
                    <SkipForward size={12} class="text-white" />
                </button>
            </div>
        {:else}
            <!-- Compact View -->
            <div class="flex-shrink-0 text-white">
                <Music size={14} class={isPlaying ? "animate-pulse" : ""} />
            </div>
            <div class="flex-1 min-w-0 text-left">
                <div class="text-xs font-medium text-white truncate">
                    {track?.title || 'Unknown Title'}
                </div>
            </div>
        {/if}

        <!-- Progress bar (always at bottom) -->
        <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 overflow-hidden">
            <div 
                class="h-full bg-white/60 transition-all duration-300" 
                style="width: {progress}%"
            ></div>
        </div>
    </div>
</BaseView>

<style>
    .animate-pulse {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(0.9); }
    }
</style>

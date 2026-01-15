<script lang="ts">
    import { onDestroy } from 'svelte';
    import { Calendar, Clock, MapPin, ChevronUp, ChevronDown } from 'lucide-svelte';
    import BaseView from './BaseView.svelte';
    import { IslandController } from '../../services/island-controller.service.svelte';
    import { AnimationEngine } from '../../services/animation.service';
    import type { CalendarNotificationPayload } from '../../types/notification.types';

    let { payload } = $props<{ payload: CalendarNotificationPayload }>();
    
    let isExpanded = $derived(IslandController.isExpanded);
    let textElement = $state<HTMLElement | null>(null);
    let textContainer = $state<HTMLElement | null>(null);
    let marqueeAnimation: any = null;

    function toggleExpand(e: MouseEvent) {
        e.stopPropagation();
        IslandController.isExpanded = !IslandController.isExpanded;
    }

    // Format time
    function formatTime(date: Date): string {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Format date
    function formatDate(date: Date): string {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    $effect(() => {
        // Handle marquee animation when view is active and not expanded
        if (!isExpanded && textElement && textContainer) {
            const containerWidth = textContainer.offsetWidth;
            const textWidth = textElement.scrollWidth;
            
            if (textWidth > containerWidth) {
                marqueeAnimation = AnimationEngine.createMarquee(
                    textElement, 
                    containerWidth, 
                    textWidth
                );
            }
        } else if (marqueeAnimation) {
            marqueeAnimation.pause();
            marqueeAnimation = null;
        }
    });

    onDestroy(() => {
        if (marqueeAnimation) marqueeAnimation.pause();
    });
</script>

<BaseView id="calendar">
    <div 
        class="flex flex-col w-full h-full select-none cursor-pointer overflow-hidden"
        onclick={toggleExpand}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && toggleExpand(e as any)}
    >
        <div class="flex items-center gap-3 px-4 h-[40px] w-full flex-shrink-0">
            <!-- Icon -->
            <div class="flex-shrink-0 text-blue-400">
                <Calendar size={16} />
            </div>

            <!-- Title (Marquee) -->
            <div 
                bind:this={textContainer}
                class="flex-1 min-w-0 overflow-hidden relative"
            >
                <div 
                    bind:this={textElement}
                    class="text-sm font-medium text-white whitespace-nowrap inline-block"
                >
                    {payload.title || payload.message}
                </div>
            </div>

            <!-- Time badge -->
            <div class="flex-shrink-0 text-xs text-white/70">
                {formatTime(payload.startTime)}
            </div>

            <!-- Expand indicator -->
            <div class="flex-shrink-0 text-white/50">
                {#if isExpanded}
                    <ChevronUp size={14} />
                {:else}
                    <ChevronDown size={14} />
                {/if}
            </div>
        </div>

        {#if isExpanded}
            <div class="px-4 pb-3 pt-1 text-xs text-white/80 text-left animate-in fade-in slide-in-from-top-2 duration-300 space-y-2">
                <div class="flex items-center gap-2">
                    <Clock size={12} class="text-white/60" />
                    <span>
                        {formatDate(payload.startTime)} at {formatTime(payload.startTime)}
                        {#if payload.endTime}
                            - {formatTime(payload.endTime)}
                        {/if}
                    </span>
                </div>
                
                {#if payload.location}
                    <div class="flex items-center gap-2">
                        <MapPin size={12} class="text-white/60" />
                        <span>{payload.location}</span>
                    </div>
                {/if}
                
                {#if payload.description}
                    <p class="line-clamp-2 leading-relaxed text-white/70">
                        {payload.description}
                    </p>
                {/if}
            </div>
        {/if}
    </div>
</BaseView>

<style>
    .animate-in {
        animation-fill-mode: forwards;
    }
</style>

<script lang="ts">
    import { onDestroy } from 'svelte';
    import { CheckSquare, Clock, AlertCircle, TrendingUp, ChevronUp, ChevronDown } from 'lucide-svelte';
    import BaseView from './BaseView.svelte';
    import { IslandController } from '../../services/island-controller.service.svelte';
    import { AnimationEngine } from '../../services/animation.service';
    import type { TaskNotificationPayload } from '../../types/notification.types';

    let { payload } = $props<{ payload: TaskNotificationPayload }>();
    
    let isExpanded = $derived(IslandController.isExpanded);
    let textElement = $state<HTMLElement | null>(null);
    let textContainer = $state<HTMLElement | null>(null);
    let marqueeAnimation: any = null;

    function toggleExpand(e: MouseEvent) {
        e.stopPropagation();
        IslandController.isExpanded = !IslandController.isExpanded;
    }

    // Get icon based on task type
    function getIcon() {
        switch (payload.type) {
            case 'completed':
                return CheckSquare;
            case 'due':
            case 'overdue':
                return Clock;
            case 'progress':
                return TrendingUp;
            default:
                return CheckSquare;
        }
    }

    // Get color based on task type
    function getColor() {
        switch (payload.type) {
            case 'completed':
                return 'text-green-400';
            case 'due':
                return 'text-yellow-400';
            case 'overdue':
                return 'text-red-400';
            case 'progress':
                return 'text-blue-400';
            default:
                return 'text-white';
        }
    }

    // Format due date
    function formatDueDate(date: Date): string {
        const now = new Date();
        const diff = date.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        if (days < 0) return 'Overdue';
        if (days === 0) return 'Due today';
        if (days === 1) return 'Due tomorrow';
        return `Due in ${days} days`;
    }

    const Icon = $derived(getIcon());
    const iconColor = $derived(getColor());

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

<BaseView id="task">
    <div 
        class="flex flex-col w-full h-full select-none cursor-pointer overflow-hidden"
        onclick={toggleExpand}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && toggleExpand(e as any)}
    >
        <div class="flex items-center gap-3 px-4 h-[40px] w-full flex-shrink-0">
            <!-- Icon -->
            <div class={`flex-shrink-0 ${iconColor}`}>
                <Icon size={16} />
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
                {#if payload.dueDate}
                    <div class="flex items-center gap-2">
                        <Clock size={12} class="text-white/60" />
                        <span>{formatDueDate(payload.dueDate)}</span>
                    </div>
                {/if}
                
                {#if payload.progress !== undefined}
                    <div class="space-y-1">
                        <div class="flex justify-between text-[10px] text-white/60">
                            <span>Progress</span>
                            <span>{payload.progress}%</span>
                        </div>
                        <div class="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div 
                                class="h-full bg-blue-400 transition-all duration-300" 
                                style="width: {payload.progress}%"
                            ></div>
                        </div>
                    </div>
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

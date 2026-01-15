<script lang="ts">
    import { onDestroy } from 'svelte';
    import { AlertCircle, Wrench, Info, AlertTriangle, Download, ChevronUp } from 'lucide-svelte';
    import BaseView from './BaseView.svelte';
    import { IslandController } from '../../services/island-controller.service.svelte';
    import { AnimationEngine } from '../../services/animation.service';
    import { NotificationSeverity } from '../../types/severity.types';
    import type { SystemNotificationPayload } from '../../types/notification.types';

    let { payload } = $props<{ payload: SystemNotificationPayload }>();
    
    let isExpanded = $derived(IslandController.isExpanded);
    let textElement = $state<HTMLElement | null>(null);
    let textContainer = $state<HTMLElement | null>(null);
    let marqueeAnimation: any = null;

    function toggleExpand(e: MouseEvent) {
        e.stopPropagation();
        IslandController.isExpanded = !IslandController.isExpanded;
    }

    // Get icon based on system type
    function getIcon() {
        switch (payload.type) {
            case 'update':
                return Download;
            case 'maintenance':
                return Wrench;
            case 'alert':
                return AlertTriangle;
            default:
                return Info;
        }
    }

    // Get severity from payload or default
    const severity = $derived(payload.severity || NotificationSeverity.HIGH);
    const Icon = $derived(getIcon());

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

<BaseView id="system">
    <div 
        class="flex flex-col w-full h-full select-none cursor-pointer overflow-hidden"
        onclick={toggleExpand}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && toggleExpand(e as any)}
    >
        <div class="flex items-center gap-3 px-4 h-[40px] w-full flex-shrink-0">
            <!-- Icon -->
            <div class="flex-shrink-0 text-orange-400">
                <Icon size={16} />
            </div>

            <!-- Message (Marquee) -->
            <div 
                bind:this={textContainer}
                class="flex-1 min-w-0 overflow-hidden relative"
            >
                <div 
                    bind:this={textElement}
                    class="text-sm font-medium text-white whitespace-nowrap inline-block"
                >
                    {payload.message}
                </div>
            </div>

            <!-- Expand indicator -->
            {#if isExpanded}
                <div class="flex-shrink-0 text-white/50">
                    <ChevronUp size={14} />
                </div>
            {/if}
        </div>

        {#if isExpanded}
            <div class="px-4 pb-3 pt-1 text-xs text-white/80 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                {#if payload.version}
                    <p class="font-semibold mb-1">Version {payload.version}</p>
                {/if}
                {#if payload.actionUrl}
                    <a 
                        href={payload.actionUrl} 
                        target="_blank"
                        class="text-blue-400 hover:text-blue-300 underline"
                    >
                        Learn more →
                    </a>
                {/if}
                <div class="mt-2 flex justify-end">
                    <span class="text-[9px] opacity-50 uppercase tracking-widest">
                        {payload.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>
        {/if}
    </div>
</BaseView>


<style>
    .animate-in {
        animation-fill-mode: forwards;
    }
</style>

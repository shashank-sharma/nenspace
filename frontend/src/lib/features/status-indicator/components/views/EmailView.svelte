<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Mail, ChevronDown, ChevronUp } from 'lucide-svelte';
    import BaseView from './BaseView.svelte';
    import { IslandController } from '../../services/island-controller.service.svelte';
    import { AnimationEngine } from '../../services/animation.service';
    import type { EmailPayload } from '../../types/island.types';

    let { email } = $props<{ email: EmailPayload }>();
    
    let isExpanded = $derived(IslandController.isExpanded);
    let subjectElement = $state<HTMLElement | null>(null);
    let subjectContainer = $state<HTMLElement | null>(null);
    let marqueeAnimation: any = null;

    function toggleExpand(e: MouseEvent) {
        e.stopPropagation();
        IslandController.isExpanded = !IslandController.isExpanded;
    }

    $effect(() => {
        // Handle marquee animation when view is active and not expanded
        if (!isExpanded && subjectElement && subjectContainer) {
            const containerWidth = subjectContainer.offsetWidth;
            const textWidth = subjectElement.scrollWidth;
            
            if (textWidth > containerWidth) {
                marqueeAnimation = AnimationEngine.createMarquee(
                    subjectElement, 
                    containerWidth, 
                    textWidth
                );
            }
        } else if (marqueeAnimation) {
            marqueeAnimation.pause();
            marqueeAnimation = null;
        }
    });

    onMount(() => {
        // Initial check for marquee
    });

    onDestroy(() => {
        if (marqueeAnimation) marqueeAnimation.pause();
    });
</script>

<BaseView id="email">
    <div 
        class="flex flex-col w-full h-full select-none cursor-pointer overflow-hidden"
        onclick={toggleExpand}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && toggleExpand(e as any)}
    >
        <div class="flex items-center gap-3 px-4 h-[40px] w-full flex-shrink-0">
            <!-- Avatar or Icon -->
            <div class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center overflow-hidden border border-blue-500/30">
                {#if email.avatar}
                    <img src={email.avatar} alt={email.sender} class="w-full h-full object-cover" />
                {:else}
                    <Mail size={14} class="text-blue-400" />
                {/if}
            </div>

            <!-- Subject (Marquee) -->
            <div 
                bind:this={subjectContainer}
                class="flex-1 min-w-0 overflow-hidden relative"
            >
                <div 
                    bind:this={subjectElement}
                    class="text-sm font-medium text-white whitespace-nowrap inline-block"
                >
                    <span class="text-blue-400 font-bold">{email.sender}:</span> {email.subject}
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
            <div class="px-4 pb-3 pt-1 text-xs text-white/80 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                <p class="line-clamp-3 leading-relaxed">
                    {email.summary}
                </p>
                <div class="mt-2 flex justify-end">
                    <span class="text-[9px] opacity-50 uppercase tracking-widest">
                        {email.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

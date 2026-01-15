<script lang="ts">
    import { onDestroy } from 'svelte';
    import { Sparkles } from 'lucide-svelte';
    import BaseView from './BaseView.svelte';
    import { AnimationEngine } from '../../services/animation.service';
    import { NotificationSeverity, getSeverityConfig } from '../../types/severity.types';
    import type { BigTextNotificationPayload } from '../../types/notification.types';

    let { payload, severity } = $props<{ 
        payload: BigTextNotificationPayload;
        severity?: NotificationSeverity;
    }>();
    
    let Icon = $derived(payload.icon || Sparkles);
    let textElement = $state<HTMLElement | null>(null);
    let textContainer = $state<HTMLElement | null>(null);
    let marqueeAnimation: any = null;
    
    // Get severity-based styling
    const severityLevel = $derived(severity || NotificationSeverity.HIGH);
    const severityConfig = $derived(getSeverityConfig(severityLevel));
    const iconColor = $derived(severityConfig.colors.iconTailwind || 'text-yellow-400');
    
    // Animation style based on severity
    const animationClass = $derived(() => {
        switch (severityLevel) {
            case NotificationSeverity.CRITICAL:
                return 'animate-pulse';
            case NotificationSeverity.HIGH:
                return 'animate-bounce-slow';
            default:
                return '';
        }
    });

    $effect(() => {
        // Handle horizontal scrolling for long text
        if (textElement && textContainer) {
            const containerWidth = textContainer.offsetWidth;
            const textWidth = textElement.scrollWidth;
            
            if (textWidth > containerWidth) {
                marqueeAnimation = AnimationEngine.createMarquee(
                    textElement, 
                    containerWidth, 
                    textWidth
                );
            }
        }
    });

    onDestroy(() => {
        if (marqueeAnimation) marqueeAnimation.pause();
    });
</script>

<BaseView id="big-text">
    <div class="flex flex-col items-center justify-center w-full h-full px-6 py-4 select-none overflow-hidden">
        <div class="flex items-center gap-3 w-full">
            <div class="p-2 rounded-xl bg-white/10 flex-shrink-0">
                <Icon size={24} class="{iconColor} {animationClass()}" />
            </div>
            <div class="flex flex-col text-left flex-1 min-w-0">
                <div 
                    bind:this={textContainer}
                    class="overflow-hidden relative"
                >
                    <h2 
                        bind:this={textElement}
                        class="text-lg font-bold text-white leading-tight whitespace-nowrap inline-block"
                    >
                        {payload.text}
                    </h2>
                </div>
                {#if payload.subtext}
                    <p class="text-sm text-white/60 font-medium mt-1">
                        {payload.subtext}
                    </p>
                {/if}
            </div>
        </div>
    </div>
</BaseView>

<style>
    :global(.animate-bounce-slow) {
        animation: bounce 3s infinite;
    }

    @keyframes bounce {
        0%, 100% {
            transform: translateY(-5%);
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
        }
        50% {
            transform: translateY(0);
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
        }
    }
</style>

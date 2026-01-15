<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { tick } from 'svelte';
    import BaseView from './BaseView.svelte';
    import type { IslandNotification } from '../../services/island-notification.service.svelte';
    import { IslandNotificationService } from '../../services/island-notification.service.svelte';
    import { AnimationEngine } from '../../services/animation.service';
    import { NotificationSeverity, getSeverityConfig } from '../../types/severity.types';
    import type { NotificationInstance, BatchedNotification } from '../../types/notification.types';

    let { notification, severity, batchCount } = $props<{ 
        notification: IslandNotification;
        severity?: NotificationSeverity;
        batchCount?: number;
    }>();
    
    let colors = $derived(IslandNotificationService.getVariantColors(notification.variant));
    let IconComponent = $derived(notification.icon);
    let isLoading = $derived(notification.variant === 'loading');
    
    // Use severity-based colors if provided
    const severityLevel = $derived(severity || NotificationSeverity.MEDIUM);
    const severityConfig = $derived(getSeverityConfig(severityLevel));
    const useSeverityColors = $derived(severity !== undefined);
    
    const displayColors = $derived(useSeverityColors ? {
        iconColor: severityConfig.colors.iconTailwind,
        text: severityConfig.colors.textTailwind,
    } : {
        iconColor: colors.iconColor,
        text: notification.textColor || colors.text,
    });

    let textElement = $state<HTMLElement | null>(null);
    let textContainer = $state<HTMLElement | null>(null);
    let marqueeAnimation: any = null;
    let hasCheckedMarquee = $state(false);

    // Check if marquee is needed after the view is fully rendered and island has expanded
    async function checkMarquee() {
        await tick(); // Wait for DOM to update
        
        if (!textElement || !textContainer || hasCheckedMarquee) return;
        
        // Wait a bit more for the island expansion animation to complete
        setTimeout(() => {
            if (!textElement || !textContainer) return;
            
            const containerWidth = textContainer.offsetWidth;
            const textWidth = textElement.scrollWidth;
            
            // Only start marquee if text still overflows after island has expanded
            if (textWidth > containerWidth) {
                marqueeAnimation = AnimationEngine.createMarquee(
                    textElement, 
                    containerWidth, 
                    textWidth
                );
            }
            
            hasCheckedMarquee = true;
        }, 500); // Wait for morph animation to complete (400ms + buffer)
    }

    $effect(() => {
        if (textElement && textContainer && !hasCheckedMarquee) {
            checkMarquee();
        }
    });

    onMount(() => {
        // Initial check after mount
        checkMarquee();
    });

    onDestroy(() => {
        if (marqueeAnimation) {
            marqueeAnimation.pause();
            marqueeAnimation = null;
        }
        if (textElement) {
            textElement.style.transform = 'none';
        }
    });
</script>

<BaseView id="notification">
    <div class="flex items-center gap-3 px-4 h-full w-full max-w-full overflow-hidden">
        <!-- Icon -->
        <div class="flex-shrink-0 {displayColors.iconColor}">
            {#if IconComponent}
                <IconComponent
                    size={18}
                    class={isLoading ? "animate-spin" : ""}
                />
            {/if}
        </div>

        <!-- Message -->
        <div 
            bind:this={textContainer}
            class="flex-1 min-w-0 overflow-hidden relative"
        >
            <div 
                bind:this={textElement}
                class="text-sm font-medium whitespace-nowrap inline-block {displayColors.text} text-left"
            >
                {notification.message}
            </div>
        </div>

        <!-- Batch count badge -->
        {#if batchCount && batchCount > 1}
            <div class="flex-shrink-0 bg-white/20 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                {batchCount}
            </div>
        {/if}
    </div>
</BaseView>

<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { IslandController } from '../services/island-controller.service.svelte';
    import { AnimationEngine } from '../services/animation.service';
    import { calculateIslandWidth } from '../utils/ui.util';
    import { STATUS_INDICATOR_CONFIG } from '../utils/status-indicator.util';
    import { getSeverityAnimationPreset, NotificationSeverity } from '../types/severity.types';
    import * as Views from './views';

    let { 
        systemStatus, 
        currentNotification,
        isTauri = false,
        onResize = null, // Callback for Tauri window resize
        onWidthChange = null // Callback for browser position adjustment
    } = $props();

    let containerElement = $state<HTMLElement | null>(null);
    let activeViewId = $derived(IslandController.activeView?.id);
    let isExpanded = $derived(IslandController.isExpanded);

    // Track dimensions for morphing
    let currentWidth = $state<number>(STATUS_INDICATOR_CONFIG.DIMENSIONS.COMPACT_WIDTH);
    let currentHeight = $state<number>(STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT);

    // Sync external states to controller
    $effect(() => {
        if (currentNotification) {
            // Calculate width with a small buffer to ensure text fits
            const dynamicWidth = calculateIslandWidth(currentNotification.message);
            
            IslandController.show({
                id: 'notification',
                priority: 80, // IslandPriority.NOTIFICATION
                dimensions: { 
                    width: dynamicWidth, 
                    height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT 
                },
                component: Views.NotificationView as any,
                props: { notification: currentNotification },
                duration: currentNotification.duration || 3000
            });
        }
    });

    // React to view/expansion changes
    $effect(() => {
        const view = IslandController.activeView;
        if (!view || !containerElement) return;

        let targetWidth = view.dimensions.width;
        let targetHeight = view.dimensions.height;

        // Dynamic width for big-text if it exists
        if (view.id === 'big-text' && view.props?.payload?.text) {
            targetWidth = calculateIslandWidth(view.props.payload.text, !!view.props.payload.icon, true);
            // Ensure minimum width for big text (use expanded width as minimum)
            if (targetWidth < STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH) {
                targetWidth = STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH;
            }
        }

        // Dynamic width for email if it exists
        if (view.id === 'email' && view.props?.email && !isExpanded) {
            targetWidth = calculateIslandWidth(`${view.props.email.sender}: ${view.props.email.subject}`, true);
        }

        // Handle expansion overrides
        if (view.id === 'music' && isExpanded) {
            targetWidth = STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH;
            targetHeight = STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT; // Music expanded is same height but different content
        } else if (view.id === 'email' && isExpanded) {
            targetWidth = STATUS_INDICATOR_CONFIG.DIMENSIONS.MAX_WIDTH;
            targetHeight = 100; // Email expands vertically
        }

        if (targetWidth !== currentWidth || targetHeight !== currentHeight) {
            // Get animation preset from severity if available
            const severity = view.props?.severity as NotificationSeverity | undefined;
            const preset = severity ? getSeverityAnimationPreset(severity) : undefined;
            
            // Morph the island with preset-based animation
            AnimationEngine.morph(containerElement, {
                width: targetWidth,
                height: targetHeight,
                preset: preset as any,
            });

            currentWidth = targetWidth;
            currentHeight = targetHeight;

            // Notify parent for window resizing (Tauri)
            if (onResize) {
                onResize(targetWidth, targetHeight);
            }
            
            // Notify parent for position adjustment (Browser)
            if (onWidthChange) {
                onWidthChange(targetWidth);
            }
        }
    });

    onMount(() => {
        // Register core views
        IslandController.register({
            id: 'time',
            priority: 20, // IslandPriority.IDLE
            dimensions: { 
                width: STATUS_INDICATOR_CONFIG.DIMENSIONS.COMPACT_WIDTH as number, 
                height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT as number
            },
            component: Views.TimeView as any,
            props: { systemStatus }
        });

        // Show initial view
        IslandController.show('time');
    });

    onDestroy(() => {
        AnimationEngine.cleanup();
        IslandController.clear();
    });
</script>

<div 
    bind:this={containerElement}
    class="floating-island-container relative overflow-hidden shadow-2xl backdrop-blur-xl transition-colors duration-500 will-change-transform"
    style="width: {currentWidth}px; height: {currentHeight}px; border-radius: 20px;"
    role="presentation"
>
    <!-- Render active view if it exists -->
    {#if IslandController.activeView}
        {@const ViewComp = IslandController.activeView.component}
        <ViewComp 
            {...IslandController.activeView.props} 
            {systemStatus}
        />
    {/if}

    <!-- Loading shimmer (shared across views) -->
    {#if systemStatus.isApiLoading && activeViewId === 'time'}
        <div class="shimmer absolute inset-0 pointer-events-none"></div>
    {/if}
</div>

<style>
    .floating-island-container {
        background-color: rgba(0, 0, 0, 0.85);
        color: white;
        contain: layout style;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    }

    .shimmer {
        background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.05) 50%,
            transparent 100%
        );
        background-size: 200% 100%;
        animation: shimmer 2s infinite linear;
    }

    @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
    }
</style>

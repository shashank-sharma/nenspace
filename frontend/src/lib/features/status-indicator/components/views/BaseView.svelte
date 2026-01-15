<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { AnimationEngine } from '../../services/animation.service';

    let { children, id } = $props();
    let containerElement = $state<HTMLElement | null>(null);

    onMount(async () => {
        if (containerElement) {
            await AnimationEngine.fade(containerElement, 'in');
        }
    });

    // Note: Fade out is usually handled by the parent FloatingIsland component 
    // before switching views, but we keep it here for robustness.
</script>

<div 
    bind:this={containerElement}
    class="island-view-content w-full h-full flex items-center justify-center opacity-0"
    data-view-id={id}
>
    {@render children?.()}
</div>

<style>
    .island-view-content {
        will-change: transform, opacity;
        contain: content;
    }
</style>

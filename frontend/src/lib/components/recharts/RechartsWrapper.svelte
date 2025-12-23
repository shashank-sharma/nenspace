<script lang="ts">
    import * as React from "react";
    import { createRoot, type Root } from "react-dom/client";
    import { onMount, onDestroy } from "svelte";
    import { tick } from "svelte";

    let {
        component: Component,
        props = {},
    } = $props<{
        component: any;
        props?: Record<string, any>;
    }>();

    let container: HTMLDivElement | undefined = $state();
    let root: Root | null = $state(null);

    onMount(async () => {
        if (!container) return;
        await tick();

        try {
            root = createRoot(container);
            root.render(React.createElement(Component, props));
        } catch (error) {
            console.error("Error rendering recharts component:", error);
        }
    });

    $effect(() => {
        if (root && Component) {
            root.render(React.createElement(Component, props));
        }
    });

    onDestroy(() => {
        if (root) {
            root.unmount();
            root = null;
        }
    });
</script>

<div bind:this={container} class="w-full h-full"></div>


<script lang="ts">
    import { onNavigate } from "$app/navigation";
    import { page } from "$app/stores";
    import { tick } from "svelte";
    import { animePageTransition, animeSectionTransition, shouldAnimate } from "$lib/utils/transitions";
    import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
        type?: "page" | "section";
        duration?: number;
    }

    let { children, type = "page", duration }: Props = $props();

    let currentPath = $derived($page.url.pathname);
    let previousPath = $state(currentPath);
    let transitionKey = $state(0);

    $effect(() => {
        if (currentPath !== previousPath) {

            tick().then(() => {
                transitionKey++;
                previousPath = currentPath;
            });
        }
    });

    onNavigate((navigation) => {
        if (!navigation?.to?.url) return;

    });

    function getTransition() {
        if (!shouldAnimate()) {
            return undefined;
        }

        if (type === "section") {
            return (node: Element) => animeSectionTransition(node, { duration });
        }

        return (node: Element) => animePageTransition(node, "in", { duration });
    }
</script>

<div
    class="page-transition-wrapper"
    transition={getTransition()}
    key={transitionKey}
>
    {@render children()}
</div>

<style>
    .page-transition-wrapper {
        width: 100%;
        height: 100%;
        position: relative;
        will-change: transform, opacity;
    }
</style>


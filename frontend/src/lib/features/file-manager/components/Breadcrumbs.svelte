<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { ChevronRight, Home } from 'lucide-svelte';
    import type { FolderRecord } from '../types';
    import { createEventDispatcher, onMount } from 'svelte';
    import { animate, stagger, remove } from 'animejs';

    let { breadcrumbs, currentFolderId } = $props<{
        breadcrumbs: FolderRecord[];
        currentFolderId?: string;
    }>();

    const dispatch = createEventDispatcher<{
        navigate: string | undefined;
    }>();

    let breadcrumbRef = $state<HTMLDivElement | null>(null);

    function handleNavigate(folderId: string | undefined) {
        dispatch('navigate', folderId);
    }

    $effect(() => {
        if (breadcrumbRef) {
            const elements = breadcrumbRef.querySelectorAll('button, svg');
            if (elements.length > 0) {
                animate(elements, {
                    opacity: [0, 1],
                    translateX: [-5, 0],
                    delay: stagger(20),
                    duration: 400,
                    ease: 'outQuad'
                });
            }
        }
    });
</script>

<div bind:this={breadcrumbRef} class="flex items-center gap-2 text-sm text-muted-foreground mb-4">
    <Button
        variant={!currentFolderId ? 'secondary' : 'ghost'}
        size="sm"
        onclick={() => handleNavigate(undefined)}
        class="h-auto p-1 {!currentFolderId ? 'bg-accent' : ''}"
    >
        <Home class="h-4 w-4 {!currentFolderId ? 'text-primary' : ''}" />
    </Button>
    {#each breadcrumbs as breadcrumb, i (breadcrumb.id)}
        <ChevronRight class="h-4 w-4" />
        <Button
            variant={breadcrumb.id === currentFolderId ? 'secondary' : 'ghost'}
            size="sm"
            onclick={() => handleNavigate(breadcrumb.id)}
            class="h-auto px-2 py-1 {breadcrumb.id === currentFolderId ? 'bg-accent font-semibold' : ''}"
        >
            {breadcrumb.name}
        </Button>
    {/each}
</div>

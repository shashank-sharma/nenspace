<script lang="ts">
    import { onMount } from 'svelte';
    import { ChevronLeft, ChevronRight } from 'lucide-svelte';
    import { Button } from '$lib/components/ui/button';
    import * as Card from '$lib/components/ui/card';
    import { animate, stagger } from 'animejs';

    interface Props {
        title?: string;
        children: any;
        viewAllHref?: string;
        class?: string;
    }

    let { title, children, viewAllHref, class: className }: Props = $props();

    let scrollContainer = $state<HTMLDivElement | null>(null);
    let showLeftArrow = $state(false);
    let showRightArrow = $state(true);

    function updateArrows() {
        if (!scrollContainer) return;
        showLeftArrow = scrollContainer.scrollLeft > 0;
        showRightArrow = scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth - 10;
    }

    function scroll(direction: 'left' | 'right') {
        if (!scrollContainer) return;
        const scrollAmount = scrollContainer.clientWidth * 0.8;
        scrollContainer.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    }

    onMount(() => {
        if (scrollContainer) {
            const items = scrollContainer.querySelectorAll('.scroll-item-anim');
            if (items.length > 0) {
                animate(items, {
                    opacity: [0, 1],
                    translateX: [50, 0],
                    delay: stagger(40),
                    duration: 600,
                    easing: 'easeOutCubic'
                });
            }
            updateArrows();
        }
    });
</script>

<Card.Root class="border-none bg-card shadow-xl overflow-hidden rounded-[2rem] {className}">
    {#if title}
        <Card.Header class="flex flex-row items-center justify-between px-8 py-6 border-b border-primary/5">
            <Card.Title class="text-2xl font-black tracking-tight">{title}</Card.Title>
            {#if viewAllHref}
                <Button variant="link" href={viewAllHref} class="text-primary font-bold">
                    View All
                </Button>
            {/if}
        </Card.Header>
    {/if}

    <Card.Content class="p-8 relative group/scroll">
        {#if showLeftArrow}
            <div class="absolute left-4 top-0 bottom-0 w-12 bg-gradient-to-r from-background/80 to-transparent z-10 flex items-center justify-start pointer-events-none">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    class="h-10 w-10 rounded-full shadow-lg bg-background/80 backdrop-blur pointer-events-auto opacity-0 group-hover/scroll:opacity-100 transition-opacity"
                    onclick={() => scroll('left')}
                >
                    <ChevronLeft class="h-6 w-6" />
                </Button>
            </div>
        {/if}

        <div
            bind:this={scrollContainer}
            class="flex gap-6 overflow-x-auto scrollbar-hide pb-4 px-2 scroll-smooth"
            onscroll={updateArrows}
        >
            {@render children()}
        </div>

        {#if showRightArrow}
            <div class="absolute right-4 top-0 bottom-0 w-12 bg-gradient-to-l from-background/80 to-transparent z-10 flex items-center justify-end pointer-events-none">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    class="h-10 w-10 rounded-full shadow-lg bg-background/80 backdrop-blur pointer-events-auto opacity-0 group-hover/scroll:opacity-100 transition-opacity"
                    onclick={() => scroll('right')}
                >
                    <ChevronRight class="h-6 w-6" />
                </Button>
            </div>
        {/if}
    </Card.Content>
</Card.Root>

<style>
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>


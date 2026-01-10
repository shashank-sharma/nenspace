<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { Log } from '../types';
    import LogEntry from './LogEntry.svelte';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import EmptyState from '$lib/components/EmptyState.svelte';
    import { ScrollText } from 'lucide-svelte';

    let {
        logs,
        isLoading,
        hasMore,
        isRealtime,
        onLoadMore
    } = $props<{
        logs: Log[];
        isLoading: boolean;
        hasMore: boolean;
        isRealtime: boolean;
        onLoadMore: () => void;
    }>();

    let initialLoadComplete = $state(false);

    $effect(() => {
        if (!isLoading && logs.length > 0 && !initialLoadComplete) {
            initialLoadComplete = true;
        }
    });

    let scrollContainer: HTMLElement;
    let observer: IntersectionObserver;
    let loadMoreTrigger: HTMLElement;

    onMount(() => {
        observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoading && hasMore) {
                onLoadMore();
            }
        }, {
            rootMargin: '200px',
        });

        if (loadMoreTrigger) {
            observer.observe(loadMoreTrigger);
        }
    });

    onDestroy(() => {
        if (observer) observer.disconnect();
    });
</script>

<div class="flex-1 overflow-y-auto min-h-0 bg-background/50" bind:this={scrollContainer}>
    {#if logs.length === 0 && !isLoading}
        <div class="h-full flex items-center justify-center p-12">
            <EmptyState
                icon={ScrollText}
                title="No logs found"
                description="Adjust your filters or wait for new logs to arrive"
            />
        </div>
    {:else}
        <div class="flex flex-col">
            {#each logs as log, i (log.id)}
                <LogEntry
                    {log}
                    isNew={i === 0 && isRealtime && initialLoadComplete}
                />
            {/each}

            <div bind:this={loadMoreTrigger} class="h-20 flex items-center justify-center">
                {#if isLoading && logs.length > 0}
                    <LoadingSpinner size="sm" label="Loading older logs..." />
                {:else if !hasMore && logs.length > 0}
                    <p class="text-[11px] font-bold text-muted-foreground uppercase tracking-widest py-8">
                        Reached the beginning of time
                    </p>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>

    div::-webkit-scrollbar {
        width: 10px;
    }
    div::-webkit-scrollbar-track {
        background: transparent;
    }
    div::-webkit-scrollbar-thumb {
        background: hsl(var(--muted-foreground) / 0.1);
        border-radius: 5px;
        border: 2px solid transparent;
        background-clip: content-box;
    }
    div::-webkit-scrollbar-thumb:hover {
        background: hsl(var(--muted-foreground) / 0.2);
        border: 2px solid transparent;
        background-clip: content-box;
    }
</style>


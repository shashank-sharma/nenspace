<script lang="ts">
    import { onMount } from 'svelte';
    import { Music, PlayCircle, Clock, TrendingUp, BarChart3 } from 'lucide-svelte';
    import type { ListeningStats } from '../types';
    import { MusicService } from '../services';
    import { withErrorHandling } from '$lib/utils';
    import * as Card from '$lib/components/ui/card';
    import UsageBarChart from '$lib/components/charts/UsageBarChart.svelte';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import { animate, stagger } from 'animejs';
    import type { ChartConfig } from "$lib/components/ui/chart";

    let stats = $state<ListeningStats | null>(null);
    let isLoading = $state(true);

    const chartConfig: ChartConfig = {
        value: { label: "Tracks", color: "hsl(var(--primary))" }
    };

    let chartData = $derived.by(() => {
        if (!stats?.genre_distribution) return [];
        return Object.entries(stats.genre_distribution)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    });

    async function loadStats() {
        isLoading = true;
        await withErrorHandling(
            () => MusicService.getListeningStats(),
            {
                onSuccess: (result) => {
                    stats = result;
                }
            }
        );
        isLoading = false;

        setTimeout(() => {
            animate('.library-stat-anim', {
                opacity: [0, 1],
                translateY: [10, 0],
                delay: stagger(50),
                duration: 400,
                easing: 'easeOutQuad'
            });
        }, 0);
    }

    function formatTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    onMount(loadStats);
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {#if isLoading}
            {#each Array(4) as _}
                <Card.Root class="h-32 bg-card/50 border-primary/5 animate-pulse" />
            {/each}
        {:else if stats}
            <Card.Root class="library-stat-anim opacity-0 p-6 bg-card/50 border-primary/5 rounded-xl relative overflow-hidden group">
                <div class="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <Music class="h-16 w-16" />
                </div>
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Tracks</p>
                <p class="text-3xl font-black tracking-tighter">{stats.total_tracks}</p>
            </Card.Root>

            <Card.Root class="library-stat-anim opacity-0 p-6 bg-card/50 border-primary/5 rounded-xl relative overflow-hidden group">
                <div class="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <PlayCircle class="h-16 w-16" />
                </div>
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Plays</p>
                <p class="text-3xl font-black tracking-tighter">{stats.total_plays}</p>
            </Card.Root>

            <Card.Root class="library-stat-anim opacity-0 p-6 bg-card/50 border-primary/5 rounded-xl relative overflow-hidden group">
                <div class="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <Clock class="h-16 w-16" />
                </div>
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Time</p>
                <p class="text-3xl font-black tracking-tighter">{formatTime(stats.total_listen_time)}</p>
            </Card.Root>

            <Card.Root class="library-stat-anim opacity-0 p-6 bg-card/50 border-primary/5 rounded-xl relative overflow-hidden group">
                <div class="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <TrendingUp class="h-16 w-16" />
                </div>
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Genres</p>
                <p class="text-3xl font-black tracking-tighter">{chartData.length}</p>
            </Card.Root>
        {/if}
    </div>

    <Card.Root class="library-stat-anim opacity-0 bg-card/50 border-primary/5 rounded-xl p-6 flex flex-col justify-between overflow-hidden">
        <div class="flex items-center justify-between mb-4">
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Top Genres</p>
            <BarChart3 class="h-4 w-4 text-primary/40" />
        </div>
        <div class="h-20 w-full mt-2">
            {#if !isLoading && chartData.length > 0}
                <UsageBarChart 
                    data={chartData} 
                    config={chartConfig}
                    xKey="name"
                    yKeys={["value"]}
                    height={80}
                />
            {:else if isLoading}
                <div class="h-full w-full bg-primary/5 rounded animate-pulse" />
            {/if}
        </div>
    </Card.Root>
</div>


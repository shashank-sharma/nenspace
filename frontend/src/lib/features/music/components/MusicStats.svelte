<script lang="ts">
    import { onMount } from 'svelte';
    import { BarChart3, Music, Clock, TrendingUp, PlayCircle } from 'lucide-svelte';
    import type { ListeningStats } from '../types';
    import { MusicService } from '../services';
    import { withErrorHandling } from '$lib/utils';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import EmptyState from '$lib/components/EmptyState.svelte';
    import * as Card from '$lib/components/ui/card';
    import { animate, stagger } from 'animejs';

    let stats = $state<ListeningStats | null>(null);
    let isLoading = $state(true);

    async function loadStats() {
        isLoading = true;
        await withErrorHandling(
            () => MusicService.getListeningStats(),
            {
                errorMessage: 'Failed to load statistics',
                onSuccess: (result) => {
                    stats = result;
                }
            }
        );
        isLoading = false;

        if (stats) {
            setTimeout(() => {
                animate('.stat-card-anim', {
                    opacity: [0, 1],
                    scale: [0.95, 1],
                    translateY: [20, 0],
                    delay: stagger(100),
                    duration: 600,
                    easing: 'easeOutCubic'
                });

                const counters = {
                    totalTracks: 0,
                    totalPlays: 0,
                    totalListenTime: 0
                };

                animate(counters, {
                    totalTracks: stats.total_tracks || 0,
                    totalPlays: stats.total_plays || 0,
                    totalListenTime: stats.total_listen_time || 0,
                    round: 1,
                    easing: 'easeOutExpo',
                    duration: 2000,
                    update: () => {
                        const tracksEl = document.getElementById('stat-tracks');
                        const playsEl = document.getElementById('stat-plays');
                        const timeEl = document.getElementById('stat-time');
                        if (tracksEl) tracksEl.innerText = counters.totalTracks.toString();
                        if (playsEl) playsEl.innerText = counters.totalPlays.toString();
                        if (timeEl) timeEl.innerText = formatListenTime(counters.totalListenTime);
                    }
                });
            }, 0);
        }
    }

    function formatListenTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    onMount(() => {
        loadStats();
    });
</script>

{#if isLoading}
    <div class="h-64 flex items-center justify-center">
        <LoadingSpinner size="lg" label="Analyzing your music galaxy..." />
    </div>
{:else if !stats}
    <EmptyState
        icon={BarChart3}
        title="Your statistics are silence"
        description="Start listening to music to see your musical journey visualized"
    />
{:else}
    <div class="space-y-12">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
            <Card.Root class="stat-card-anim opacity-0 border-none bg-card shadow-xl p-8 rounded-3xl relative overflow-hidden group">
                <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 group-hover:opacity-20 transition-all duration-500">
                    <Music class="h-12 w-12" />
                </div>
                <div class="relative z-10">
                    <p class="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Total Tracks</p>
                    <p id="stat-tracks" class="text-5xl font-black text-primary tracking-tighter">0</p>
                </div>
            </Card.Root>

            <Card.Root class="stat-card-anim opacity-0 border-none bg-card shadow-xl p-8 rounded-3xl relative overflow-hidden group">
                <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 group-hover:opacity-20 transition-all duration-500">
                    <PlayCircle class="h-12 w-12" />
                </div>
                <div class="relative z-10">
                    <p class="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Total Plays</p>
                    <p id="stat-plays" class="text-5xl font-black text-primary tracking-tighter">0</p>
                </div>
            </Card.Root>

            <Card.Root class="stat-card-anim opacity-0 border-none bg-card shadow-xl p-8 rounded-3xl relative overflow-hidden group">
                <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 group-hover:opacity-20 transition-all duration-500">
                    <Clock class="h-12 w-12" />
                </div>
                <div class="relative z-10">
                    <p class="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Listen Time</p>
                    <p id="stat-time" class="text-5xl font-black text-primary tracking-tighter">0m</p>
                </div>
            </Card.Root>

            <Card.Root class="stat-card-anim opacity-0 border-none bg-card shadow-xl p-8 rounded-3xl relative overflow-hidden group">
                <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 group-hover:opacity-20 transition-all duration-500">
                    <TrendingUp class="h-12 w-12" />
                </div>
                <div class="relative z-10">
                    <p class="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Top Genres</p>
                    <p class="text-5xl font-black text-primary tracking-tighter">
                        {stats.genre_distribution ? Object.keys(stats.genre_distribution).length : 0}
                    </p>
                </div>
            </Card.Root>
        </div>

        <div class="grid md:grid-cols-2 gap-12">
            {#if stats.top_tracks?.length > 0}
                <Card.Root class="stat-card-anim opacity-0 border-primary/5 bg-card shadow-xl rounded-3xl overflow-hidden">
                    <Card.Header class="p-8 border-b border-primary/5">
                        <Card.Title class="text-2xl font-black tracking-tight flex items-center gap-3">
                            <Music class="h-6 w-6 text-primary" />
                            Top Tracks
                        </Card.Title>
                    </Card.Header>
                    <Card.Content class="p-4">
                        <div class="space-y-2">
                            {#each stats.top_tracks.slice(0, 5) as track, index}
                                <div class="flex items-center gap-4 p-4 rounded-2xl hover:bg-primary/5 transition-colors group">
                                    <span class="text-2xl font-black text-muted-foreground/30 group-hover:text-primary transition-colors w-8">{index + 1}</span>
                                    <div class="flex-1 min-w-0">
                                        <p class="truncate font-bold text-lg">{track.title}</p>
                                        <p class="text-sm text-muted-foreground font-medium truncate">{track.artist}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-sm font-black text-primary">{track.play_count}</p>
                                        <p class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Plays</p>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </Card.Content>
                </Card.Root>
            {/if}

            {#if stats.top_artists?.length > 0}
                <Card.Root class="stat-card-anim opacity-0 border-primary/5 bg-card shadow-xl rounded-3xl overflow-hidden">
                    <Card.Header class="p-8 border-b border-primary/5">
                        <Card.Title class="text-2xl font-black tracking-tight flex items-center gap-3">
                            <TrendingUp class="h-6 w-6 text-primary" />
                            Top Artists
                        </Card.Title>
                    </Card.Header>
                    <Card.Content class="p-4">
                        <div class="space-y-2">
                            {#each stats.top_artists.slice(0, 5) as artist, index}
                                <div class="flex items-center gap-4 p-4 rounded-2xl hover:bg-primary/5 transition-colors group">
                                    <span class="text-2xl font-black text-muted-foreground/30 group-hover:text-primary transition-colors w-8">{index + 1}</span>
                                    <div class="flex-1 min-w-0 flex items-center gap-4">
                                        <div class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">
                                            {artist.artist.charAt(0)}
                                        </div>
                                        <p class="truncate font-bold text-lg">{artist.artist}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-sm font-black text-primary">{artist.play_count}</p>
                                        <p class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Plays</p>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </Card.Content>
                </Card.Root>
            {/if}
        </div>

        {#if stats.genre_distribution && Object.keys(stats.genre_distribution).length > 0}
            <Card.Root class="stat-card-anim opacity-0 border-primary/5 bg-card shadow-xl rounded-3xl p-8">
                <h3 class="text-2xl font-black tracking-tight mb-8">Genre Distribution</h3>
                <div class="flex flex-wrap gap-3">
                    {#each Object.entries(stats.genre_distribution).sort((a, b) => b[1] - a[1]) as [genre, count]}
                        <div class="px-6 py-3 bg-primary/10 rounded-full text-sm font-bold border border-primary/5 hover:bg-primary/20 transition-colors cursor-default">
                            {genre} <span class="text-primary/60 ml-2">{count}</span>
                        </div>
                    {/each}
                </div>
            </Card.Root>
        {/if}
    </div>
{/if}

<script lang="ts">
    import { X, Upload, Image as ImageIcon, Star, Trash2, Play, Pause, Save, CheckCircle2, Music } from 'lucide-svelte';
    import type { MusicTrack } from '../types';
    import { MusicService, MusicPlayerService } from '../services';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import TagSelector from './TagSelector.svelte';
    import { useImageUpload } from '$lib/hooks/useImageUpload.svelte';
    import { withErrorHandling } from '$lib/utils';
    import { cn } from '$lib/utils';
    import { fade, slide, fly } from 'svelte/transition';

    interface Props {
        track: MusicTrack | null;
        onsubmit?: (updated: MusicTrack) => void;
        ondelete?: (id: string) => void;
        onclose?: () => void;
    }

    let { track, onsubmit, ondelete, onclose }: Props = $props();

    let formData = $state<Partial<MusicTrack>>({});
    let isSubmitting = $state(false);
    let currentTrack = $derived(MusicPlayerService.currentTrack);
    let isPlaying = $derived(MusicPlayerService.isPlaying);
    let isCurrent = $derived(currentTrack?.id === track?.id);

    const imageUpload = useImageUpload({
        maxSizeMB: 5,
        maxSizeBytes: 5 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });

    $effect(() => {
        if (track) {
            formData = {
                title: track.title,
                artist: track.artist,
                album: track.album,
                album_artist: track.album_artist,
                genre: track.genre,
                year: track.year,
                track_number: track.track_number,
                disc_number: track.disc_number,
                rating: track.rating || 0,
                tags: track.tags || []
            };
            if (track.cover_art) {
                imageUpload.setPreviewFromUrl(MusicService.getTrackCoverUrl(track));
            } else {
                imageUpload.reset();
            }
        }
    });

    async function handleUpdate() {
        if (!track) return;
        isSubmitting = true;
        await withErrorHandling(
            async () => {
                const updated = await MusicService.updateTrack(
                    track!.id, 
                    formData, 
                    imageUpload.currentFile
                );
                onsubmit?.(updated);
            },
            {
                errorMessage: 'Failed to update metadata',
                successMessage: 'Metadata updated'
            }
        );
        isSubmitting = false;
    }

    function handlePlay() {
        if (!track) return;
        if (isCurrent) {
            MusicPlayerService.togglePlayPause();
        } else {
            MusicPlayerService.playTrack(track);
        }
    }

    function setRating(rating: number) {
        formData.rating = rating;
    }
</script>

{#if track}
    <div class="h-full flex flex-col bg-card border-l border-primary/5 shadow-2xl overflow-hidden" transition:fly={{ x: 400, duration: 300 }}>
        <!-- Header -->
        <div class="px-6 py-4 border-b border-primary/5 flex items-center justify-between bg-muted/20">
            <h2 class="font-black uppercase tracking-widest text-[10px] text-muted-foreground/60">Track Details</h2>
            <Button variant="ghost" size="icon" class="h-8 w-8 rounded-full" onclick={onclose}>
                <X class="h-4 w-4" />
            </Button>
        </div>

        <div class="flex-1 overflow-y-auto themed-scrollbar p-6 space-y-8">
            <!-- Preview Section -->
            <div class="flex justify-center px-4">
                <div class="relative aspect-square w-48 rounded-2xl overflow-hidden shadow-xl group border border-primary/5">
                    {#if imageUpload.previewUrl}
                        <img src={imageUpload.previewUrl} alt="Cover" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    {:else}
                        <div class="w-full h-full bg-gradient-to-br from-primary/5 to-primary/20 flex items-center justify-center">
                            <ImageIcon class="h-12 w-12 text-primary/20" />
                        </div>
                    {/if}
                    
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <Button variant="primary" size="icon" class="h-12 w-12 rounded-full shadow-2xl hover:scale-110 transition-transform" onclick={handlePlay}>
                            {#if isCurrent && isPlaying}
                                <Pause class="h-6 w-6 fill-current" />
                            {:else}
                                <Play class="h-5 w-5 fill-current ml-1" />
                            {/if}
                        </Button>
                        <Button variant="secondary" size="icon" class="h-12 w-12 rounded-full shadow-2xl hover:scale-110 transition-transform" onclick={imageUpload.openFilePicker}>
                            <Upload class="h-5 w-5" />
                        </Button>
                    </div>
                    <input type="file" accept="image/*" class="hidden" use:imageUpload.bindFileInput onchange={imageUpload.handleFileSelect} />
                </div>
            </div>

            <div class="text-center space-y-1">
                <h1 class="text-2xl font-black tracking-tight truncate">{track.title}</h1>
                <p class="text-muted-foreground font-bold">{track.artist}</p>
            </div>

            <div class="flex justify-center gap-1">
                {#each Array(5) as _, i}
                    <button onclick={() => setRating(i + 1)} class="transition-transform hover:scale-125 focus:outline-none">
                        <Star class={cn("h-6 w-6 transition-colors", (formData.rating || 0) > i ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/20")} />
                    </button>
                {/each}
            </div>

            <!-- Form Section -->
            <div class="space-y-6">
                <div class="space-y-4">
                    <div class="space-y-2">
                        <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Title</Label>
                        <Input bind:value={formData.title} class="rounded-xl bg-primary/5 border-none h-11 focus-visible:ring-primary/20" />
                    </div>
                    
                    <div class="space-y-2">
                        <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Artist</Label>
                        <Input bind:value={formData.artist} class="rounded-xl bg-primary/5 border-none h-11 focus-visible:ring-primary/20" />
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Album</Label>
                            <Input bind:value={formData.album} class="rounded-xl bg-primary/5 border-none h-11 focus-visible:ring-primary/20" />
                        </div>
                        <div class="space-y-2">
                            <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Genre</Label>
                            <Input bind:value={formData.genre} class="rounded-xl bg-primary/5 border-none h-11 focus-visible:ring-primary/20" />
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-4">
                        <div class="space-y-2">
                            <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Year</Label>
                            <Input type="number" bind:value={formData.year} class="rounded-xl bg-primary/5 border-none h-11 focus-visible:ring-primary/20" />
                        </div>
                        <div class="space-y-2">
                            <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Track #</Label>
                            <Input type="number" bind:value={formData.track_number} class="rounded-xl bg-primary/5 border-none h-11 focus-visible:ring-primary/20" />
                        </div>
                        <div class="space-y-2">
                            <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Disc #</Label>
                            <Input type="number" bind:value={formData.disc_number} class="rounded-xl bg-primary/5 border-none h-11 focus-visible:ring-primary/20" />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <Label class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Tags</Label>
                        <TagSelector 
                            selectedTagIds={formData.tags || []} 
                            onchange={(tagIds) => formData.tags = tagIds} 
                        />
                    </div>
                </div>

                <div class="space-y-3 pt-4">
                    <div class="p-4 rounded-2xl bg-primary/5 border border-primary/5 space-y-2">
                        <div class="flex justify-between text-[10px] font-bold text-muted-foreground/60">
                            <span>Format</span>
                            <span>{track.format?.toUpperCase() || 'UNKNOWN'}</span>
                        </div>
                        <div class="flex justify-between text-[10px] font-bold text-muted-foreground/60">
                            <span>Duration</span>
                            <span>{MusicService.formatDuration(track.duration)}</span>
                        </div>
                        <div class="flex justify-between text-[10px] font-bold text-muted-foreground/60">
                            <span>File Size</span>
                            <span>{MusicService.formatFileSize(track.file_size)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer Actions -->
        <div class="p-6 border-t border-primary/5 bg-muted/10 grid grid-cols-2 gap-3">
            <Button variant="destructive" class="rounded-xl h-12 font-bold" onclick={() => ondelete?.(track!.id)}>
                <Trash2 class="h-4 w-4 mr-2" />
                Delete
            </Button>
            <Button variant="primary" class="rounded-xl h-12 font-bold shadow-lg" onclick={handleUpdate} disabled={isSubmitting}>
                <Save class="h-4 w-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Update'}
            </Button>
        </div>
    </div>
{:else}
    <div class="h-full flex flex-col items-center justify-center text-center p-12 space-y-4 text-muted-foreground/40 bg-card/30" transition:fade>
        <div class="h-24 w-24 rounded-full border-2 border-dashed border-current flex items-center justify-center mb-2">
            <Music class="h-10 w-10" />
        </div>
        <p class="text-sm font-bold uppercase tracking-widest">Select a track to view details</p>
    </div>
{/if}

<style>
    .themed-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .themed-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .themed-scrollbar::-webkit-scrollbar-thumb {
        background: hsl(var(--primary) / 0.1);
        border-radius: 10px;
    }
    .themed-scrollbar::-webkit-scrollbar-thumb:hover {
        background: hsl(var(--primary) / 0.2);
    }
</style>

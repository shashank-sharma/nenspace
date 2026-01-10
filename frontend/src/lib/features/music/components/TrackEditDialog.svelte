<script lang="ts">
    import { onMount } from 'svelte';
    import { X, Upload, Image as ImageIcon, Star } from 'lucide-svelte';
    import type { MusicTrack } from '../types';
    import { MusicService } from '../services';
    import { Button } from '$lib/components/ui/button';
    import * as Dialog from '$lib/components/ui/dialog';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import TagSelector from './TagSelector.svelte';
    import { useImageUpload } from '$lib/hooks/useImageUpload.svelte';
    import { withErrorHandling } from '$lib/utils';
    import { cn } from '$lib/utils';

    interface Props {
        track: MusicTrack | null;
        open: boolean;
        onsubmit?: (track: MusicTrack) => void;
        onclose?: () => void;
    }

    let { track, open = $bindable(), onsubmit, onclose }: Props = $props();

    let formData = $state<Partial<MusicTrack>>({});
    let isSubmitting = $state(false);

    const imageUpload = useImageUpload({
        maxSizeMB: 5,
        maxSizeBytes: 5 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });

    $effect(() => {
        if (open && track) {
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

    async function handleSubmit(e: Event) {
        e.preventDefault();
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
                open = false;
            },
            {
                errorMessage: 'Failed to update track metadata',
                successMessage: 'Track updated successfully'
            }
        );
        isSubmitting = false;
    }

    function setRating(rating: number) {
        formData.rating = rating;
    }
</script>

<Dialog.Root bind:open onOpenChange={(val) => !val && onclose?.()}>
    <Dialog.Content class="sm:max-w-[600px] p-0 overflow-hidden bg-card border-primary/10">
        <Dialog.Header class="px-6 py-4 border-b border-primary/5 bg-muted/30">
            <Dialog.Title class="text-xl font-bold">Edit Track Metadata</Dialog.Title>
        </Dialog.Header>

        <form onsubmit={handleSubmit} class="p-6 space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-8">
                <!-- Cover Art Upload -->
                <div class="space-y-3">
                    <Label>Cover Image</Label>
                    <div 
                        use:imageUpload.bindDropZone
                        class={cn(
                            "relative aspect-square rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden group cursor-pointer",
                            imageUpload.isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 bg-muted/50"
                        )}
                        onclick={imageUpload.openFilePicker}
                    >
                        {#if imageUpload.previewUrl}
                            <img src={imageUpload.previewUrl} alt="Preview" class="w-full h-full object-cover" />
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button type="button" variant="secondary" size="sm" class="rounded-full">Change Image</Button>
                            </div>
                            <button 
                                type="button" 
                                class="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 text-foreground hover:bg-destructive hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                onclick={(e) => { e.stopPropagation(); imageUpload.removeImage(); }}
                            >
                                <X class="h-4 w-4" />
                            </button>
                        {:else}
                            <ImageIcon class="h-10 w-10 text-muted-foreground/40 mb-2" />
                            <p class="text-[10px] text-muted-foreground font-medium text-center px-4">
                                DRAG & DROP OR CLICK TO UPLOAD
                            </p>
                        {/if}
                    </div>
                    <input 
                        type="file" 
                        accept="image/*" 
                        class="hidden" 
                        use:imageUpload.bindFileInput 
                        onchange={imageUpload.handleFileSelect}
                    />
                </div>

                <!-- Fields -->
                <div class="space-y-4">
                    <div class="grid grid-cols-1 gap-4">
                        <div class="space-y-2">
                            <Label for="title">Track Title</Label>
                            <Input id="title" bind:value={formData.title} placeholder="Enter title..." required />
                        </div>
                        
                        <div class="space-y-2">
                            <Label for="artist">Artist</Label>
                            <Input id="artist" bind:value={formData.artist} placeholder="Enter artist..." required />
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <Label for="album">Album</Label>
                                <Input id="album" bind:value={formData.album} placeholder="Album name" />
                            </div>
                            <div class="space-y-2">
                                <Label for="genre">Genre</Label>
                                <Input id="genre" bind:value={formData.genre} placeholder="e.g. Rock, Pop" />
                            </div>
                        </div>

                        <div class="grid grid-cols-3 gap-4">
                            <div class="space-y-2">
                                <Label for="year">Year</Label>
                                <Input id="year" type="number" bind:value={formData.year} placeholder="2024" />
                            </div>
                            <div class="space-y-2">
                                <Label for="track_number">Track #</Label>
                                <Input id="track_number" type="number" bind:value={formData.track_number} />
                            </div>
                            <div class="space-y-2">
                                <Label for="disc_number">Disc #</Label>
                                <Input id="disc_number" type="number" bind:value={formData.disc_number} />
                            </div>
                        </div>

                        <div class="space-y-2">
                            <Label>Rating</Label>
                            <div class="flex gap-1">
                                {#each Array(5) as _, i}
                                    <button 
                                        type="button" 
                                        onclick={() => setRating(i + 1)}
                                        class="transition-transform hover:scale-125 focus:outline-none"
                                    >
                                        <Star 
                                            class={cn(
                                                "h-6 w-6 transition-colors",
                                                (formData.rating || 0) > i ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"
                                            )} 
                                        />
                                    </button>
                                {/each}
                                {#if formData.rating}
                                    <Button variant="ghost" size="sm" class="ml-2 h-6 text-[10px]" onclick={() => setRating(0)}>Clear</Button>
                                {/if}
                            </div>
                        </div>

                        <div class="space-y-2">
                            <Label>Tags</Label>
                            <TagSelector 
                                selectedTagIds={formData.tags || []} 
                                onchange={(tagIds) => formData.tags = tagIds} 
                            />
                        </div>
                    </div>
                </div>
            </div>

            <Dialog.Footer class="pt-6 border-t border-primary/5">
                <Button type="button" variant="ghost" onclick={() => { open = false; onclose?.(); }}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>


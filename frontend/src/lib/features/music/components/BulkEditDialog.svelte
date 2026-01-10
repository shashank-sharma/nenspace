<script lang="ts">
    import { Star, AlertCircle } from 'lucide-svelte';
    import type { MusicTrack } from '../types';
    import { MusicService } from '../services';
    import { Button } from '$lib/components/ui/button';
    import * as Dialog from '$lib/components/ui/dialog';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import TagSelector from './TagSelector.svelte';
    import { withErrorHandling } from '$lib/utils';
    import { cn } from '$lib/utils';

    interface Props {
        selectedTracks: MusicTrack[];
        open: boolean;
        onsubmit?: () => void;
        onclose?: () => void;
    }

    let { selectedTracks, open = $bindable(), onsubmit, onclose }: Props = $props();

    let isSubmitting = $state(false);
    
    // Which fields to update
    let fieldsToUpdate = $state({
        artist: false,
        album: false,
        album_artist: false,
        genre: false,
        year: false,
        rating: false,
        tags: false
    });

    let formData = $state<Partial<MusicTrack>>({
        artist: '',
        album: '',
        album_artist: '',
        genre: '',
        year: 2024,
        rating: 0,
        tags: []
    });

    async function handleSubmit(e: Event) {
        e.preventDefault();
        const ids = selectedTracks.map(t => t.id);
        if (ids.length === 0) return;

        const updateData: Partial<MusicTrack> = {};
        if (fieldsToUpdate.artist) updateData.artist = formData.artist;
        if (fieldsToUpdate.album) updateData.album = formData.album;
        if (fieldsToUpdate.album_artist) updateData.album_artist = formData.album_artist;
        if (fieldsToUpdate.genre) updateData.genre = formData.genre;
        if (fieldsToUpdate.year) updateData.year = formData.year;
        if (fieldsToUpdate.rating) updateData.rating = formData.rating;
        if (fieldsToUpdate.tags) updateData.tags = formData.tags;

        if (Object.keys(updateData).length === 0) {
            open = false;
            return;
        }

        isSubmitting = true;
        await withErrorHandling(
            async () => {
                await MusicService.bulkUpdateTracks(ids, updateData);
                onsubmit?.();
                open = false;
            },
            {
                errorMessage: `Failed to update ${ids.length} tracks`,
                successMessage: `Successfully updated ${ids.length} tracks`
            }
        );
        isSubmitting = false;
    }

    function setRating(rating: number) {
        formData.rating = rating;
        fieldsToUpdate.rating = true;
    }
</script>

<Dialog.Root bind:open onOpenChange={(val) => !val && onclose?.()}>
    <Dialog.Content class="sm:max-w-[500px] border-primary/10">
        <Dialog.Header>
            <Dialog.Title>Bulk Edit Tracks</Dialog.Title>
            <Dialog.Description>
                Updating {selectedTracks.length} selected tracks. Only checked fields will be modified.
            </Dialog.Description>
        </Dialog.Header>

        <form onsubmit={handleSubmit} class="space-y-4 py-4">
            <!-- Artist -->
            <div class="flex items-start gap-3 p-3 rounded-lg border border-primary/5 bg-muted/30">
                <Checkbox id="update-artist" bind:checked={fieldsToUpdate.artist} class="mt-1" />
                <div class="flex-1 space-y-2">
                    <Label for="artist" class={!fieldsToUpdate.artist ? "opacity-50" : ""}>Artist</Label>
                    <Input id="artist" bind:value={formData.artist} disabled={!fieldsToUpdate.artist} placeholder="New artist name" />
                </div>
            </div>

            <!-- Album -->
            <div class="flex items-start gap-3 p-3 rounded-lg border border-primary/5 bg-muted/30">
                <Checkbox id="update-album" bind:checked={fieldsToUpdate.album} class="mt-1" />
                <div class="flex-1 space-y-2">
                    <Label for="album" class={!fieldsToUpdate.album ? "opacity-50" : ""}>Album</Label>
                    <Input id="album" bind:value={formData.album} disabled={!fieldsToUpdate.album} placeholder="New album name" />
                </div>
            </div>

            <!-- Genre -->
            <div class="flex items-start gap-3 p-3 rounded-lg border border-primary/5 bg-muted/30">
                <Checkbox id="update-genre" bind:checked={fieldsToUpdate.genre} class="mt-1" />
                <div class="flex-1 space-y-2">
                    <Label for="genre" class={!fieldsToUpdate.genre ? "opacity-50" : ""}>Genre</Label>
                    <Input id="genre" bind:value={formData.genre} disabled={!fieldsToUpdate.genre} placeholder="e.g. Jazz, Electronic" />
                </div>
            </div>

            <!-- Year -->
            <div class="flex items-start gap-3 p-3 rounded-lg border border-primary/5 bg-muted/30">
                <Checkbox id="update-year" bind:checked={fieldsToUpdate.year} class="mt-1" />
                <div class="flex-1 space-y-2">
                    <Label for="year" class={!fieldsToUpdate.year ? "opacity-50" : ""}>Year</Label>
                    <Input id="year" type="number" bind:value={formData.year} disabled={!fieldsToUpdate.year} />
                </div>
            </div>

            <!-- Rating -->
            <div class="flex items-start gap-3 p-3 rounded-lg border border-primary/5 bg-muted/30">
                <Checkbox id="update-rating" bind:checked={fieldsToUpdate.rating} class="mt-1" />
                <div class="flex-1 space-y-2">
                    <Label class={!fieldsToUpdate.rating ? "opacity-50" : ""}>Rating</Label>
                    <div class="flex gap-1">
                        {#each Array(5) as _, i}
                            <button 
                                type="button" 
                                onclick={() => setRating(i + 1)}
                                disabled={!fieldsToUpdate.rating}
                                class={cn(
                                    "transition-transform hover:scale-125 focus:outline-none",
                                    !fieldsToUpdate.rating && "cursor-not-allowed opacity-50"
                                )}
                            >
                                <Star 
                                    class={cn(
                                        "h-6 w-6 transition-colors",
                                        (formData.rating || 0) > i ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"
                                    )} 
                                />
                            </button>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Tags -->
            <div class="flex items-start gap-3 p-3 rounded-lg border border-primary/5 bg-muted/30">
                <Checkbox id="update-tags" bind:checked={fieldsToUpdate.tags} class="mt-1" />
                <div class="flex-1 space-y-2">
                    <Label class={!fieldsToUpdate.tags ? "opacity-50" : ""}>Tags</Label>
                    <div class={!fieldsToUpdate.tags ? "pointer-events-none opacity-50" : ""}>
                        <TagSelector 
                            selectedTagIds={formData.tags || []} 
                            onchange={(tagIds) => {
                                formData.tags = tagIds;
                                fieldsToUpdate.tags = true;
                            }} 
                        />
                    </div>
                </div>
            </div>

            <Dialog.Footer class="pt-6">
                <Button type="button" variant="ghost" onclick={() => { open = false; onclose?.(); }}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting || !Object.values(fieldsToUpdate).some(v => v)}>
                    {isSubmitting ? 'Updating...' : 'Apply Changes'}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>


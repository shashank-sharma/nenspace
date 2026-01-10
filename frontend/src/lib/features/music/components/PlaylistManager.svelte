<script lang="ts">
    import { Plus, Folder, MoreVertical, Trash2, Edit2, Play, ListMusic } from 'lucide-svelte';
    import type { MusicPlaylist } from '../types';
    import { MusicService, MusicPlayerService } from '../services';
    import { withErrorHandling, validateWithToast, required } from '$lib/utils';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import * as Dialog from '$lib/components/ui/dialog';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import * as Card from '$lib/components/ui/card';
    import EmptyState from '$lib/components/EmptyState.svelte';
    import { onMount } from 'svelte';
    import { animate, stagger } from 'animejs';

    interface Props {
        playlists: MusicPlaylist[];
        onrefresh: () => void;
    }

    let { playlists, onrefresh }: Props = $props();

    let showCreateDialog = $state(false);
    let editingPlaylist = $state<MusicPlaylist | null>(null);
    let playlistName = $state('');
    let playlistDescription = $state('');

    const GRADIENTS = [
        'from-blue-500 to-purple-500',
        'from-pink-500 to-rose-500',
        'from-amber-500 to-orange-500',
        'from-emerald-500 to-teal-500',
        'from-indigo-500 to-blue-500',
        'from-violet-500 to-fuchsia-500'
    ];

    function openCreate() {
        playlistName = '';
        playlistDescription = '';
        editingPlaylist = null;
        showCreateDialog = true;
    }

    function openEdit(playlist: MusicPlaylist) {
        playlistName = playlist.name;
        playlistDescription = playlist.description;
        editingPlaylist = playlist;
        showCreateDialog = true;
    }

    async function handleSave() {
        if (!validateWithToast({ name: playlistName }, {
            name: [required('Playlist name is required')]
        })) return;

        if (editingPlaylist) {
            await withErrorHandling(
                () => MusicService.updatePlaylist(editingPlaylist!.id, {
                    name: playlistName,
                    description: playlistDescription
                }),
                {
                    successMessage: 'Playlist updated',
                    onSuccess: () => {
                        showCreateDialog = false;
                        onrefresh();
                    }
                }
            );
        } else {
            await withErrorHandling(
                () => MusicService.createPlaylist(playlistName, playlistDescription),
                {
                    successMessage: 'Playlist created',
                    onSuccess: () => {
                        showCreateDialog = false;
                        onrefresh();
                    }
                }
            );
        }
    }

    async function handleDelete(playlist: MusicPlaylist) {
        await withErrorHandling(
            () => MusicService.deletePlaylist(playlist.id),
            {
                successMessage: 'Playlist deleted',
                onSuccess: onrefresh
            }
        );
    }

    async function handlePlay(playlist: MusicPlaylist) {
        await withErrorHandling(
            () => MusicService.getPlaylist(playlist.id),
            {
                onSuccess: (result) => {
                    if (result.tracks.length > 0) {
                        MusicPlayerService.playQueue(result.tracks);
                    }
                }
            }
        );
    }

    onMount(() => {
        animate('.playlist-card-anim', {
            opacity: [0, 1],
            scale: [0.95, 1],
            translateY: [20, 0],
            delay: stagger(50),
            duration: 500,
            easing: 'easeOutCubic'
        });
    });
</script>

<div class="space-y-8">
    <div class="flex justify-end">
        <Button onclick={openCreate} class="rounded-full px-6 font-bold shadow-lg">
            <Plus class="h-4 w-4 mr-2" />
            New Playlist
        </Button>
    </div>

    {#if playlists.length === 0}
        <EmptyState
            icon={Folder}
            title="Your playlists are waiting"
            description="Create your first playlist to organize your music universe"
            actionLabel="Create Playlist"
            onaction={openCreate}
        />
    {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {#each playlists as playlist, i}
                <Card.Root class="playlist-card-anim opacity-0 group/playlist overflow-hidden border-none bg-card shadow-lg hover:shadow-2xl transition-all duration-500 rounded-3xl">
                    <div class="aspect-video relative overflow-hidden bg-gradient-to-br {GRADIENTS[i % GRADIENTS.length]}">
                        {#if playlist.cover_image}
                            <img 
                                src={MusicService.getPlaylistCoverUrl(playlist)} 
                                alt={playlist.name} 
                                class="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/playlist:scale-110" 
                            />
                        {/if}
                        <div class="absolute inset-0 bg-black/20 group-hover/playlist:bg-black/10 transition-colors duration-500"></div>
                        {#if !playlist.cover_image}
                            <div class="absolute inset-0 flex items-center justify-center opacity-40 group-hover/playlist:scale-110 transition-transform duration-700">
                                <ListMusic class="h-24 w-24 text-white" />
                            </div>
                        {/if}
                        
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/playlist:opacity-100 transition-opacity flex items-center justify-center">
                            <Button 
                                variant="primary" 
                                size="icon" 
                                class="h-16 w-16 rounded-full shadow-2xl transform translate-y-8 group-hover/playlist:translate-y-0 transition-transform duration-300"
                                onclick={() => handlePlay(playlist)}
                            >
                                <Play class="h-8 w-8 text-primary-foreground fill-current ml-1" />
                            </Button>
                        </div>
                    </div>
                    
                    <Card.Header class="p-6 relative">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                                <Card.Title class="text-xl font-black truncate group-hover/playlist:text-primary transition-colors mb-1">{playlist.name}</Card.Title>
                                {#if playlist.description}
                                    <p class="text-sm text-muted-foreground truncate font-medium">{playlist.description}</p>
                                {/if}
                            </div>
                            
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild let:builder>
                                    <Button builders={[builder]} variant="ghost" size="icon" class="h-8 w-8 rounded-full">
                                        <MoreVertical class="h-4 w-4" />
                                    </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content align="end" class="w-48">
                                    <DropdownMenu.Item onclick={() => openEdit(playlist)} class="font-bold">
                                        <Edit2 class="h-4 w-4 mr-2" />
                                        Edit
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Separator />
                                    <DropdownMenu.Item onclick={() => handleDelete(playlist)} class="text-destructive font-bold">
                                        <Trash2 class="h-4 w-4 mr-2" />
                                        Delete
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Root>
                        </div>
                    </Card.Header>
                    
                    <Card.Footer class="px-6 pb-6 pt-0">
                        <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                            <span>{playlist.track_count} tracks</span>
                            {#if playlist.total_duration > 0}
                                <span class="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
                                <span>{MusicService.formatDuration(playlist.total_duration)}</span>
                            {/if}
                        </div>
                    </Card.Footer>
                </Card.Root>
            {/each}
        </div>
    {/if}
</div>

<Dialog.Root bind:open={showCreateDialog}>
    <Dialog.Content class="sm:max-w-md rounded-3xl border-primary/10 bg-background/95 backdrop-blur-xl shadow-2xl">
        <Dialog.Header>
            <Dialog.Title class="text-2xl font-black tracking-tight">{editingPlaylist ? 'Edit Playlist' : 'New Playlist'}</Dialog.Title>
            <Dialog.Description class="font-medium text-muted-foreground">
                Give your playlist a personality and start organizing your music.
            </Dialog.Description>
        </Dialog.Header>
        <div class="space-y-6 py-6">
            <div class="space-y-2">
                <label for="name" class="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Playlist Name</label>
                <Input
                    id="name"
                    bind:value={playlistName}
                    placeholder="E.g. Midnight Grooves"
                    class="h-12 rounded-2xl bg-primary/5 border-none focus-visible:ring-2 focus-visible:ring-primary/20 text-lg font-bold"
                />
            </div>
            <div class="space-y-2">
                <label for="description" class="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Description</label>
                <Input
                    id="description"
                    bind:value={playlistDescription}
                    placeholder="What's this collection about?"
                    class="h-12 rounded-2xl bg-primary/5 border-none focus-visible:ring-2 focus-visible:ring-primary/20 font-medium"
                />
            </div>
        </div>
        <Dialog.Footer class="gap-2">
            <Button variant="ghost" onclick={() => showCreateDialog = false} class="rounded-full font-bold px-6">Cancel</Button>
            <Button onclick={handleSave} class="rounded-full font-bold px-8 shadow-lg">{editingPlaylist ? 'Save Changes' : 'Create Playlist'}</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

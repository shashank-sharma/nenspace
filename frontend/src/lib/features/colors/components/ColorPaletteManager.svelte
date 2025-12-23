<script lang="ts">
    import { colorsStore } from '../stores';
    import { ColorsService } from '../services';
    import { DEFAULT_PALETTES } from '../constants';
    import PaletteCard from './PaletteCard.svelte';
    import ColorSwatch from './ColorSwatch.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Textarea } from '$lib/components/ui/textarea';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle,
    } from '$lib/components/ui/dialog';
    import { Plus, Search, Loader2 } from 'lucide-svelte';
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { pb } from '$lib/config/pocketbase';

    let searchInput = $state('');
    let paletteName = $state('');
    let paletteDescription = $state('');
    let paletteTags = $state('');
    let paletteColors = $state<Array<{ hex: string; rgb: { r: number; g: number; b: number }; hsl: { h: number; s: number; l: number } }>>([]);
    let isCreating = $state(false);
    let isEditing = $state(false);
    let editingColorIndex = $state<number | null>(null);

    $effect(() => {
        colorsStore.setSearchQuery(searchInput);
    });

    onMount(async () => {
        await loadPalettes();
    });

    async function loadPalettes() {
        colorsStore.setLoading(true);
        try {
            const palettes = await ColorsService.fetchPalettes(colorsStore.searchQuery);
            colorsStore.setPalettes(palettes);
        } catch (error) {
            console.error('Failed to load palettes:', error);
            toast.error('Failed to load palettes');
        } finally {
            colorsStore.setLoading(false);
        }
    }

    $effect(() => {
        if (colorsStore.searchQuery !== searchInput) {
            loadPalettes();
        }
    });

    function openCreateModal() {
        isEditing = false;
        paletteName = '';
        paletteDescription = '';
        paletteTags = '';
        paletteColors = [];
        colorsStore.setActivePalette(null);
        colorsStore.setPaletteModalOpen(true);
    }

    function openEditModal() {
        const palette = colorsStore.activePalette;
        if (palette) {
            isEditing = true;
            paletteName = palette.name;
            paletteDescription = palette.description || '';
            paletteTags = palette.tags?.join(', ') || '';
            paletteColors = [...palette.colors];
            colorsStore.setPaletteModalOpen(true);
        }
    }

    $effect(() => {
        if (colorsStore.activePalette && colorsStore.isPaletteModalOpen) {
            openEditModal();
        }
    });

    function addColorFromSelected() {
        if (colorsStore.selectedColor) {
            paletteColors = [...paletteColors, colorsStore.selectedColor];
            toast.success('Color added to palette');
        } else {
            toast.error('No color selected');
        }
    }

    function removeColor(index: number) {
        paletteColors = paletteColors.filter((_, i) => i !== index);
    }

    function editColor(index: number) {
        editingColorIndex = index;
        const color = paletteColors[index];
        if (color) {
            colorsStore.setSelectedColor(color);
            // Switch to picker tab to allow color selection
            colorsStore.setActiveTab('picker');
        }
    }

    function updateColorFromPicker() {
        if (editingColorIndex !== null && colorsStore.selectedColor) {
            paletteColors[editingColorIndex] = colorsStore.selectedColor;
            editingColorIndex = null;
            toast.success('Color updated');
        }
    }

    $effect(() => {
        // When a color is selected and we're editing, update the color
        if (editingColorIndex !== null && colorsStore.selectedColor && colorsStore.activeTab === 'picker') {
            updateColorFromPicker();
        }
    });

    async function savePalette() {
        if (!paletteName.trim()) {
            toast.error('Palette name is required');
            return;
        }

        if (paletteColors.length === 0) {
            toast.error('Add at least one color to the palette');
            return;
        }

        isCreating = true;
        try {
            if (isEditing && colorsStore.activePalette) {
                // Update existing palette
                const updated = await ColorsService.updatePalette(colorsStore.activePalette.id, {
                    name: paletteName,
                    description: paletteDescription || undefined,
                    tags: paletteTags ? paletteTags.split(',').map(t => t.trim()) : undefined,
                    colors: paletteColors,
                });
                colorsStore.updatePalette(updated.id, updated);
                toast.success('Palette updated successfully');
            } else {
                // Create new palette
                const palette = await ColorsService.createPalette({
                    name: paletteName,
                    description: paletteDescription || undefined,
                    tags: paletteTags ? paletteTags.split(',').map(t => t.trim()) : undefined,
                    colors: paletteColors,
                });
                colorsStore.addPalette(palette);
                toast.success('Palette created successfully');
            }
            colorsStore.setPaletteModalOpen(false);
            colorsStore.setActivePalette(null);
            isEditing = false;
            editingColorIndex = null;
        } catch (error) {
            console.error('Failed to save palette:', error);
            toast.error('Failed to save palette');
        } finally {
            isCreating = false;
        }
    }

    async function loadDefaultPalettes() {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            toast.error('Not authenticated');
            return;
        }

        try {
            for (const defaultPalette of DEFAULT_PALETTES) {
                try {
                    await ColorsService.createPalette({
                        ...defaultPalette,
                        user: userId,
                    } as any);
                } catch (error) {
                    // Palette might already exist, skip
                }
            }
            await loadPalettes();
            toast.success('Default palettes loaded');
        } catch (error) {
            console.error('Failed to load default palettes:', error);
            toast.error('Failed to load default palettes');
        }
    }
</script>

<div class="space-y-4">
    <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold">Color Palettes</h2>
        <div class="flex gap-2">
            <Button variant="outline" onclick={loadDefaultPalettes}>
                Load Defaults
            </Button>
            <Button onclick={openCreateModal}>
                <Plus class="h-4 w-4 mr-2" />
                New Palette
            </Button>
        </div>
    </div>

    <div class="relative">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
            bind:value={searchInput}
            placeholder="Search palettes..."
            class="pl-10"
        />
    </div>

    {#if colorsStore.isLoading}
        <div class="flex items-center justify-center py-12">
            <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    {:else if colorsStore.filteredPalettes.length === 0}
        <div class="text-center py-12 text-muted-foreground">
            <p>No palettes found. Create your first palette!</p>
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each colorsStore.filteredPalettes as palette}
                <PaletteCard {palette} />
            {/each}
        </div>
    {/if}

    <Dialog bind:open={colorsStore.isPaletteModalOpen}>
        <DialogContent class="max-w-2xl">
            <DialogHeader>
                <DialogTitle>{isEditing ? 'Edit Palette' : 'Create New Palette'}</DialogTitle>
                <DialogDescription>
                    {isEditing 
                        ? 'Edit your color palette. Click on a color to edit it, or add new colors from the picker.'
                        : 'Create a new color palette. You can add colors from the color picker or harmony tool.'}
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-4 py-4">
                <div class="space-y-2">
                    <Label>Name *</Label>
                    <Input bind:value={paletteName} placeholder="My Color Palette" />
                </div>

                <div class="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                        bind:value={paletteDescription}
                        placeholder="Optional description..."
                        rows="2"
                    />
                </div>

                <div class="space-y-2">
                    <Label>Tags (comma-separated)</Label>
                    <Input bind:value={paletteTags} placeholder="warm, sunset, nature" />
                </div>

                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <Label>Colors ({paletteColors.length})</Label>
                        <Button variant="outline" size="sm" onclick={addColorFromSelected}>
                            Add Selected Color
                        </Button>
                    </div>
                    {#if paletteColors.length === 0}
                        <p class="text-sm text-muted-foreground">
                            No colors yet. Select a color from the picker or harmony tool and click "Add Selected Color".
                        </p>
                    {:else}
                        <div class="flex flex-wrap gap-2 p-4 bg-muted rounded-md">
                            {#each paletteColors as color, index}
                                <div class="relative group">
                                    <button
                                        type="button"
                                        class="cursor-pointer"
                                        onclick={() => editColor(index)}
                                        title="Click to edit this color"
                                    >
                                        <ColorSwatch color={color} size="lg" showHex={true} />
                                    </button>
                                    <button
                                        type="button"
                                        class="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            removeColor(index);
                                        }}
                                        title="Remove color"
                                    >
                                        ×
                                    </button>
                                    {#if editingColorIndex === index}
                                        <div class="absolute inset-0 border-2 border-primary rounded z-10 pointer-events-none"></div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                        {#if editingColorIndex !== null}
                            <p class="text-sm text-muted-foreground">
                                Color selected for editing. Go to the <strong>Picker</strong> tab to change it, then come back here.
                            </p>
                        {/if}
                    {/if}
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" onclick={() => colorsStore.setPaletteModalOpen(false)}>
                    Cancel
                </Button>
                <Button onclick={savePalette} disabled={isCreating || !paletteName.trim() || paletteColors.length === 0}>
                    {#if isCreating}
                        <Loader2 class="h-4 w-4 mr-2 animate-spin" />
                        {isEditing ? 'Updating...' : 'Creating...'}
                    {:else}
                        {isEditing ? 'Update Palette' : 'Create Palette'}
                    {/if}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</div>


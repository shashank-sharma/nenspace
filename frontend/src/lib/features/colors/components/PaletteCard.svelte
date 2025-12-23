<script lang="ts">
    import type { ColorPalette } from '../types';
    import { colorsStore } from '../stores';
    import ColorSwatch from './ColorSwatch.svelte';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { Trash2, Edit, Copy } from 'lucide-svelte';
    import { ColorsService } from '../services';
    import { toast } from 'svelte-sonner';

    interface Props {
        palette: ColorPalette;
    }

    let { palette }: Props = $props();

    async function handleDelete() {
        if (confirm(`Delete palette "${palette.name}"?`)) {
            try {
                await ColorsService.deletePalette(palette.id);
                colorsStore.removePalette(palette.id);
            } catch (error) {
                console.error('Failed to delete palette:', error);
            }
        }
    }

    function handleEdit() {
        colorsStore.setActivePalette(palette);
        colorsStore.setPaletteModalOpen(true);
    }

    async function handleCopy() {
        try {
            const json = JSON.stringify(palette, null, 2);
            await navigator.clipboard.writeText(json);
            toast.success('Palette copied to clipboard');
        } catch (error) {
            toast.error('Failed to copy palette');
        }
    }
</script>

<Card class="hover:shadow-md transition-shadow">
    <CardHeader>
        <div class="flex items-start justify-between">
            <div class="flex-1">
                <CardTitle class="text-lg">{palette.name}</CardTitle>
                {#if palette.description}
                    <CardDescription class="mt-1">{palette.description}</CardDescription>
                {/if}
            </div>
            <div class="flex gap-1">
                <Button variant="ghost" size="sm" onclick={handleCopy} title="Copy palette">
                    <Copy class="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onclick={handleEdit} title="Edit palette">
                    <Edit class="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onclick={handleDelete} title="Delete palette">
                    <Trash2 class="h-4 w-4" />
                </Button>
            </div>
        </div>
    </CardHeader>
    <CardContent>
        <div class="flex flex-wrap gap-2">
            {#each palette.colors as color}
                <ColorSwatch {color} size="md" showHex={false} clickable={true} />
            {/each}
        </div>
        {#if palette.tags && palette.tags.length > 0}
            <div class="flex flex-wrap gap-1 mt-3">
                {#each palette.tags as tag}
                    <span class="text-xs px-2 py-1 bg-muted rounded-full">{tag}</span>
                {/each}
            </div>
        {/if}
    </CardContent>
</Card>


<script lang="ts">
    import { colorsStore } from '../stores';
    import { extractColorsFromImage } from '../services';
    import { ColorsService } from '../services';
    import type { ImageExtractionOptions } from '../types';
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
    import { Label } from '$lib/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '$lib/components/ui/select';
    import { Input } from '$lib/components/ui/input';
    import ColorSwatch from './ColorSwatch.svelte';
    import { Upload, Loader2 } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';

    let fileInput: HTMLInputElement;
    let imagePreview = $state<string | null>(null);
    let isExtracting = $state(false);
    let extractionOptions = $state<ImageExtractionOptions>({
        algorithm: 'dominant',
        colorCount: 5,
        sampleRate: 10,
    });

    function handleFileSelect(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        } else {
            toast.error('Please select a valid image file');
        }
    }

    async function extractColors() {
        const file = fileInput.files?.[0];
        if (!file) {
            toast.error('Please select an image first');
            return;
        }

        isExtracting = true;
        try {
            const extractedPalette = await extractColorsFromImage(file, extractionOptions);
            colorsStore.setExtractedPalette(extractedPalette);
            toast.success(`Extracted ${extractedPalette.colors.length} colors`);
        } catch (error) {
            console.error('Failed to extract colors:', error);
            toast.error('Failed to extract colors from image');
        } finally {
            isExtracting = false;
        }
    }

    async function savePalette() {
        const extracted = colorsStore.extractedPalette;
        if (!extracted || extracted.colors.length === 0) {
            toast.error('No colors extracted yet');
            return;
        }

        try {
            const palette = await ColorsService.createPalette({
                name: `Extracted from Image`,
                colors: extracted.colors,
                description: `Extracted using ${extractionOptions.algorithm} algorithm`,
                tags: ['extracted', extractionOptions.algorithm],
            });
            colorsStore.addPalette(palette);
            toast.success('Palette saved successfully');
        } catch (error) {
            console.error('Failed to save palette:', error);
            toast.error('Failed to save palette');
        }
    }
</script>

<Card>
    <CardHeader>
        <CardTitle>Image Color Extraction</CardTitle>
        <CardDescription>Upload an image to extract its color palette</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
        <div class="space-y-2">
            <Label>Select Image</Label>
            <div class="flex items-center gap-2">
                <input
                    type="file"
                    bind:this={fileInput}
                    accept="image/*"
                    on:change={handleFileSelect}
                    class="hidden"
                    id="image-upload"
                />
                <label
                    for="image-upload"
                    class="flex items-center gap-2 px-4 py-2 border border-border rounded-md cursor-pointer hover:bg-accent"
                >
                    <Upload class="h-4 w-4" />
                    <span>Choose Image</span>
                </label>
            </div>
        </div>

        {#if imagePreview}
            <div class="space-y-2">
                <Label>Preview</Label>
                <img src={imagePreview} alt="Preview" class="max-w-full h-auto rounded border border-border" />
            </div>
        {/if}

        <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
                <Label>Algorithm</Label>
                <Select
                    value={extractionOptions.algorithm}
                    onValueChange={(value) => {
                        extractionOptions = { ...extractionOptions, algorithm: value as any };
                    }}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="dominant">Dominant</SelectItem>
                        <SelectItem value="kmeans">K-Means</SelectItem>
                        <SelectItem value="simple">Simple</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div class="space-y-2">
                <Label>Color Count</Label>
                <Input
                    type="number"
                    min="1"
                    max="10"
                    value={extractionOptions.colorCount}
                    on:input={(e) => {
                        extractionOptions = {
                            ...extractionOptions,
                            colorCount: parseInt((e.target as HTMLInputElement).value) || 5,
                        };
                    }}
                />
            </div>
        </div>

        <Button onclick={extractColors} disabled={!imagePreview || isExtracting} class="w-full">
            {#if isExtracting}
                <Loader2 class="h-4 w-4 mr-2 animate-spin" />
                Extracting...
            {:else}
                Extract Colors
            {/if}
        </Button>

        {#if colorsStore.extractedPalette}
            <div class="space-y-2">
                <Label>Extracted Colors</Label>
                <div class="flex flex-wrap gap-2 p-4 bg-muted rounded-md">
                    {#each colorsStore.extractedPalette.colors as color}
                        <ColorSwatch {color} size="lg" showHex={true} clickable={true} />
                    {/each}
                </div>
                <Button onclick={savePalette} variant="outline" class="w-full">
                    Save as Palette
                </Button>
            </div>
        {/if}
    </CardContent>
</Card>


<script lang="ts">
    import { colorsStore } from '../stores';
    import ColorPaletteManager from './ColorPaletteManager.svelte';
    import ColorPicker from './ColorPicker.svelte';
    import ImageColorExtractor from './ImageColorExtractor.svelte';
    import ColorHarmonyTool from './ColorHarmonyTool.svelte';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
    import { Palette, Pipette, Image, Sparkles } from 'lucide-svelte';

    $effect(() => {
        colorsStore.setActiveTab(colorsStore.activeTab);
    });
</script>

<div class="container mx-auto p-6 space-y-6">
    <div class="space-y-2">
        <h1 class="text-3xl font-bold">Colors</h1>
        <p class="text-muted-foreground">
            Manage color palettes, extract colors from images, and generate harmonies.
        </p>
    </div>

    <Tabs bind:value={colorsStore.activeTab} onValueChange={(v) => colorsStore.setActiveTab(v as any)}>
        <TabsList class="grid w-full grid-cols-4">
            <TabsTrigger value="palettes">
                <Palette class="h-4 w-4 mr-2" />
                Palettes
            </TabsTrigger>
            <TabsTrigger value="picker">
                <Pipette class="h-4 w-4 mr-2" />
                Picker
            </TabsTrigger>
            <TabsTrigger value="extract">
                <Image class="h-4 w-4 mr-2" />
                Extract
            </TabsTrigger>
            <TabsTrigger value="harmony">
                <Sparkles class="h-4 w-4 mr-2" />
                Harmony
            </TabsTrigger>
        </TabsList>

        <TabsContent value="palettes" class="mt-6">
            <ColorPaletteManager />
        </TabsContent>

        <TabsContent value="picker" class="mt-6">
            <ColorPicker />
        </TabsContent>

        <TabsContent value="extract" class="mt-6">
            <ImageColorExtractor />
        </TabsContent>

        <TabsContent value="harmony" class="mt-6">
            <ColorHarmonyTool />
        </TabsContent>
    </Tabs>
</div>


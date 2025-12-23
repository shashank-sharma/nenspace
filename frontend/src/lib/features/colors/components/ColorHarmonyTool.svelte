<script lang="ts">
    import { colorsStore } from '../stores';
    import { generateHarmony } from '../utils/color-harmony.util';
    import { ColorsService } from '../services';
    import type { ColorHarmonyType } from '../types';
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '$lib/components/ui/select';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import ColorSwatch from './ColorSwatch.svelte';
    import ColorPickerInput from './ColorPickerInput.svelte';
    import { onMount } from 'svelte';

    let baseColorInput = $state('#3B82F6');
    let harmonyType = $state<ColorHarmonyType>('complementary');
    let baseColor = $state<ReturnType<typeof ColorsService.createColorFromHex> | null>(null);
    let harmony = $state<ReturnType<typeof generateHarmony> | null>(null);

    function updateBaseColor(hex: string) {
        baseColorInput = hex;
        if (ColorsService.isValidHex(hex)) {
            try {
                baseColor = ColorsService.createColorFromHex(hex);
                updateHarmony();
            } catch (error) {
                console.error('Invalid color:', error);
            }
        }
    }

    function updateHarmony() {
        if (baseColor) {
            const newHarmony = generateHarmony(baseColor, harmonyType);
            harmony = newHarmony;
            colorsStore.setCurrentHarmony(harmony);
        }
    }

    // Initialize on mount
    onMount(() => {
        try {
            baseColor = ColorsService.createColorFromHex('#3B82F6');
            if (baseColor) {
                harmony = generateHarmony(baseColor, harmonyType);
                colorsStore.setCurrentHarmony(harmony);
            }
        } catch (error) {
            console.error('Failed to initialize base color:', error);
        }
    });

    // Update harmony when type changes - but only if baseColor exists
    $effect(() => {
        if (baseColor && harmonyType) {
            // Only update if harmony doesn't already match
            const newHarmony = generateHarmony(baseColor, harmonyType);
            if (harmony?.type !== newHarmony.type || harmony?.colors.length !== newHarmony.colors.length) {
                harmony = newHarmony;
                colorsStore.setCurrentHarmony(harmony);
            }
        }
    });

    function useColorFromPicker() {
        if (colorsStore.selectedColor) {
            baseColorInput = colorsStore.selectedColor.hex;
            baseColor = colorsStore.selectedColor;
            updateHarmony();
        }
    }

    // Auto-update when selectedColor changes from picker
    $effect(() => {
        if (colorsStore.selectedColor && colorsStore.activeTab === 'harmony') {
            // Only update if we don't already have a base color or if it's different
            if (!baseColor || baseColor.hex !== colorsStore.selectedColor.hex) {
                baseColorInput = colorsStore.selectedColor.hex;
                baseColor = colorsStore.selectedColor;
                updateHarmony();
            }
        }
    });
</script>

<Card>
    <CardHeader>
        <CardTitle>Color Harmony Generator</CardTitle>
        <CardDescription>Generate harmonious color schemes from a base color</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
        <div class="space-y-2">
            <Label>Base Color</Label>
            <div class="flex gap-2 items-center">
                <ColorPickerInput 
                    bind:value={baseColorInput} 
                    onValueChange={updateBaseColor}
                    size="md"
                />
                <Input
                    value={baseColorInput}
                    oninput={(e) => {
                        updateBaseColor((e.target as HTMLInputElement).value);
                    }}
                    class="flex-1 font-mono"
                    placeholder="#3B82F6"
                />
                {#if colorsStore.selectedColor}
                    <Button variant="outline" onclick={useColorFromPicker}>
                        Use Selected
                    </Button>
                {/if}
            </div>
        </div>

        <div class="space-y-2">
            <Label>Harmony Type</Label>
            <Select
                value={harmonyType}
                onValueChange={(value) => {
                    harmonyType = value as ColorHarmonyType;
                }}
            >
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="complementary">Complementary</SelectItem>
                    <SelectItem value="triadic">Triadic</SelectItem>
                    <SelectItem value="tetradic">Tetradic</SelectItem>
                    <SelectItem value="analogous">Analogous</SelectItem>
                    <SelectItem value="monochromatic">Monochromatic</SelectItem>
                    <SelectItem value="split-complementary">Split Complementary</SelectItem>
                </SelectContent>
            </Select>
        </div>

        {#if harmony}
            <div class="space-y-2">
                <Label>Harmony Colors</Label>
                <div class="flex flex-wrap gap-4 p-4 bg-muted rounded-md">
                    {#each harmony.colors as color}
                        <div class="flex flex-col items-center gap-2">
                            <ColorSwatch {color} size="lg" showHex={true} clickable={true} />
                            {#if color === harmony.baseColor}
                                <span class="text-xs text-muted-foreground">Base</span>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </CardContent>
</Card>


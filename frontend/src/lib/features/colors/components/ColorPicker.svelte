<script lang="ts">
    import type { Color } from '../types';
    import { colorsStore } from '../stores';
    import { ColorsService } from '../services';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Copy, Check } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';
    import ColorPickerComponent, { A11yVariant } from 'svelte-awesome-color-picker';
    import { onMount } from 'svelte';

    let colorHex = $state('#000000');
    let currentColor = $state<Color | null>(null);
    let copied = $state(false);

    onMount(() => {
        if (ColorsService.isValidHex(colorHex)) {
            try {
                currentColor = ColorsService.createColorFromHex(colorHex);
                colorsStore.setPickerColor(currentColor);
            } catch (error) {
                console.error('Failed to initialize color:', error);
            }
        }
    });

    $effect(() => {
        if (ColorsService.isValidHex(colorHex)) {
            try {
                const newColor = ColorsService.createColorFromHex(colorHex);
                if (!currentColor || currentColor.hex !== newColor.hex) {
                    currentColor = newColor;
                    colorsStore.setPickerColor(currentColor);
                }
            } catch (error) {
                console.error('Invalid color:', error);
            }
        }
    });

    $effect(() => {
        const storeColor = colorsStore.pickerColor;
        if (storeColor && (!currentColor || currentColor.hex !== storeColor.hex)) {
            if (colorHex !== storeColor.hex) {
                colorHex = storeColor.hex;
            }
        }
    });

    function handleHexInput() {
        if (ColorsService.isValidHex(colorHex)) {
            try {
                const newColor = ColorsService.createColorFromHex(colorHex);
                if (!currentColor || currentColor.hex !== newColor.hex) {
                    currentColor = newColor;
                    colorsStore.setPickerColor(currentColor);
                }
            } catch (error) {
                console.error('Invalid color:', error);
            }
        }
    }

    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            copied = true;
            setTimeout(() => (copied = false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }

    function selectColor() {
        if (currentColor) {
            colorsStore.setSelectedColor(currentColor);
            toast.success('Color selected! You can now use it in other tools.');
        }
    }
</script>

<Card>
    <CardHeader>
        <CardTitle>Color Picker</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
        <div class="flex flex-col gap-4">
            <div class="color-picker-main">
                <div class="color-picker-container">
                    <ColorPickerComponent
                        bind:hex={colorHex}
                        components={A11yVariant}
                        label=""
                        isDialog={false}
                        a11yLevel="AA"
                        a11yColors={[
                            { textHex: '#FFF', reverse: true, placeholder: 'background' },
                            { textHex: '#FFF', bgHex: '#FF0000', reverse: true, placeholder: 'background' },
                            { bgHex: '#FFF', placeholder: 'title', size: 'large' },
                            { bgHex: '#7F7F7F', placeholder: 'button' }
                        ]}
                        --picker-height="200px"
                        --picker-width="200px"
                        --picker-indicator-size="12px"
                        position="responsive"
                    />
                </div>
            </div>

            {#if currentColor}
                <div class="space-y-2">
                    <div class="flex items-center gap-2">
                        <Label class="w-20">HEX:</Label>
                        <div class="flex gap-1 flex-1">
                            <Input
                                value={colorHex}
                                oninput={(e) => {
                                    colorHex = (e.target as HTMLInputElement).value;
                                }}
                                onblur={handleHexInput}
                                class="font-mono"
                                placeholder="#000000"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onclick={() => copyToClipboard(currentColor!.hex)}
                            >
                                {#if copied}
                                    <Check class="h-4 w-4" />
                                {:else}
                                    <Copy class="h-4 w-4" />
                                {/if}
                            </Button>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <Label class="w-20">RGB:</Label>
                        <Input
                            value={`rgb(${currentColor.rgb.r}, ${currentColor.rgb.g}, ${currentColor.rgb.b})`}
                            readonly
                            class="font-mono"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onclick={() =>
                                copyToClipboard(
                                    `rgb(${currentColor.rgb.r}, ${currentColor.rgb.g}, ${currentColor.rgb.b})`
                                )
                            }
                        >
                            <Copy class="h-4 w-4" />
                        </Button>
                    </div>

                    <div class="flex items-center gap-2">
                        <Label class="w-20">HSL:</Label>
                        <Input
                            value={`hsl(${currentColor.hsl.h}, ${currentColor.hsl.s}%, ${currentColor.hsl.l}%)`}
                            readonly
                            class="font-mono"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onclick={() =>
                                copyToClipboard(
                                    `hsl(${currentColor.hsl.h}, ${currentColor.hsl.s}%, ${currentColor.hsl.l}%)`
                                )
                            }
                        >
                            <Copy class="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            {/if}
        </div>

        {#if currentColor}
            <div class="flex gap-2">
                <Button onclick={selectColor} class="flex-1">Select Color</Button>
            </div>
        {/if}
    </CardContent>
</Card>

<style>
    .color-picker-main {
        width: 100%;
        padding: 0;
    }
    
    .color-picker-container {
        position: relative;
        width: 100%;
        max-width: 100%;
        /* Map theme variables to color picker CSS variables for dark mode support */
        --cp-bg-color: hsl(var(--popover));
        --cp-border-color: hsl(var(--border));
        --cp-text-color: hsl(var(--popover-foreground));
        --cp-input-color: hsl(var(--input));
        --cp-button-hover-color: hsl(var(--accent));
    }
    
    /* Make the wrapper expand to full width */
    :global(.color-picker-container .wrapper) {
        width: 100% !important;
        max-width: 100% !important;
    }
    
    /* Hide the label element */
    :global(.color-picker-container label),
    :global(.color-picker-main label) {
        display: none !important;
    }
    
    /* Reset all buttons first, then target only the color preview button */
    :global(.color-picker-container button) {
        width: auto !important;
        height: auto !important;
        min-width: auto !important;
        min-height: auto !important;
        max-width: none !important;
        max-height: none !important;
        padding: 0.5rem 1rem !important;
        border: 1px solid hsl(var(--border)) !important;
        border-radius: 0.375rem !important;
        font-size: 0.875rem !important;
        line-height: normal !important;
    }
    
    /* Only target the color preview button (the main trigger button) */
    :global(.color-picker-container button[aria-haspopup="dialog"]) {
        border-radius: 0.5rem !important;
        border: 2px solid hsl(var(--border)) !important;
        width: 200px !important;
        height: 200px !important;
        min-width: 200px !important;
        min-height: 200px !important;
        padding: 0 !important;
        cursor: pointer !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
    }
    
    /* Fix spans with "appear" class */
    :global(.color-picker-container span.appear) {
        width: auto !important;
        height: auto !important;
        min-width: auto !important;
        min-height: auto !important;
        max-width: none !important;
        max-height: none !important;
        padding: 0 !important;
        display: inline-block !important;
        font-size: 0.875rem !important;
        line-height: normal !important;
    }
    
    /* Style the inner color display */
    :global(.color-picker-container button[aria-haspopup="dialog"] > div),
    :global(.color-picker-container button[aria-haspopup="dialog"] > span) {
        border-radius: 0.5rem !important;
        width: 100% !important;
        height: 100% !important;
        display: block !important;
    }
    
    /* Make the wrapper more contained */
    :global(.color-picker-container .wrapper) {
        max-width: 100% !important;
        overflow: visible !important;
    }
</style>

<script lang="ts">
    import type { Color } from '../types';
    import { colorsStore } from '../stores';

    interface Props {
        color: Color;
        size?: 'sm' | 'md' | 'lg';
        showHex?: boolean;
        showName?: boolean;
        clickable?: boolean;
    }

    let { color, size = 'md', showHex = false, showName = false, clickable = false }: Props = $props();

    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-16 h-16',
    };

    function handleClick(event: MouseEvent) {
        event.stopPropagation();
        if (clickable) {
            colorsStore.setSelectedColor(color);
        }
    }

    async function copyHex(event: MouseEvent) {
        event.stopPropagation();
        try {
            await navigator.clipboard.writeText(color.hex);
            // Could add toast notification here
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }
</script>

<div class="flex flex-col items-center gap-1">
    <button
        type="button"
        class="rounded-md border-2 border-border transition-all hover:scale-105 {sizeClasses[size]} {clickable ? 'cursor-pointer' : ''}"
        style="background-color: {color.hex}"
        title="{color.hex} {color.name || ''}"
        onclick={handleClick}
    >
    </button>
    {#if showHex}
        <span class="text-xs font-mono text-muted-foreground" onclick={copyHex}>
            {color.hex}
        </span>
    {/if}
    {#if showName && color.name}
        <span class="text-xs text-muted-foreground">{color.name}</span>
    {/if}
</div>


<script lang="ts">
    export let type: 'none' | 'grid' | 'dot' = 'none';
    
    $: gridStyle = type === 'grid' 
        ? 'background-image: linear-gradient(to right, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px); background-size: 24px 24px;'
        : '';
    
    $: dotStyle = type === 'dot'
        ? 'background-image: radial-gradient(hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px); background-size: 16px 16px;'
        : '';
    
    $: backgroundStyle = type === 'grid' ? gridStyle : type === 'dot' ? dotStyle : '';
</script>

{#if type !== 'none'}
    <div
        class="absolute inset-0 h-full w-full pointer-events-none"
        style={backgroundStyle}
    ></div>
{/if}


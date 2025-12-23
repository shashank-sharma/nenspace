<script lang="ts">
    import ColorPickerComponent from 'svelte-awesome-color-picker';

    interface Props {
        value: string;
        onValueChange?: (hex: string) => void;
        size?: 'sm' | 'md' | 'lg';
    }

    let { value = $bindable(), onValueChange, size = 'md' }: Props = $props();

    const sizeMap = {
        sm: { width: '32px', height: '32px' },
        md: { width: '48px', height: '48px' },
        lg: { width: '64px', height: '64px' },
    };

    const sizeVars = sizeMap[size];

    // Call onValueChange when value changes (but not on initial mount to avoid loops)
    let isInitialized = false;
    $effect(() => {
        if (isInitialized && onValueChange && value) {
            onValueChange(value);
        }
        isInitialized = true;
    });
</script>

<div class="color-picker-wrapper">
    <ColorPickerComponent
        bind:hex={value}
        label=""
        isDialog={true}
        --picker-height={sizeVars.height}
        --picker-width={sizeVars.width}
        --picker-indicator-size="8px"
    />
</div>

<style>
    /* Hide the label element */
    :global(.color-picker-wrapper > label),
    :global(.color-picker-wrapper label:first-child) {
        display: none !important;
    }
    
    /* Make the color preview square with border - target the actual color display button */
    :global(.color-picker-wrapper button[type="button"]) {
        border-radius: 0.375rem !important; /* rounded-md */
        border: 2px solid hsl(var(--border)) !important;
        width: var(--picker-width) !important;
        height: var(--picker-height) !important;
        padding: 0 !important;
        min-width: var(--picker-width) !important;
        min-height: var(--picker-height) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    }
    
    /* Target the inner color div/span */
    :global(.color-picker-wrapper button[type="button"] > div),
    :global(.color-picker-wrapper button[type="button"] > span) {
        border-radius: 0.375rem !important;
        width: 100% !important;
        height: 100% !important;
        display: block !important;
    }
</style>

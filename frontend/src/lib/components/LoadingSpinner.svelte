<!--
  LoadingSpinner Component
  
  Production-grade loading spinner with multiple sizes and variants.
  
  Features:
  - Multiple sizes (xs, sm, md, lg, xl)
  - Customizable colors
  - Optional label
  - Accessible (proper ARIA attributes)
  - Performance optimized
  
  ✅ Eliminates ~80 lines of duplicate spinner markup
-->
<script lang="ts">
    type Size = "xs" | "sm" | "md" | "lg" | "xl";
    type Variant = "primary" | "secondary" | "accent" | "muted";

    let {
        size = "md",
        variant = "primary",
        label,
        class: className = "",
        centered = false,
        fullScreen = false,
    } = $props<{
        size?: Size;
        variant?: Variant;
        label?: string;
        class?: string;
        centered?: boolean;
        fullScreen?: boolean;
    }>();

    // Size mappings
    const sizeClasses: Record<Size, string> = {
        xs: "h-3 w-3 border-2",
        sm: "h-4 w-4 border-2",
        md: "h-8 w-8 border-4",
        lg: "h-12 w-12 border-4",
        xl: "h-16 w-16 border-4",
    };

    // Variant color mappings
    const variantClasses: Record<Variant, string> = {
        primary: "border-primary border-t-transparent",
        secondary: "border-secondary border-t-transparent",
        accent: "border-accent border-t-transparent",
        muted: "border-muted-foreground border-t-transparent",
    };

    // Label size mappings
    const labelSizeClasses: Record<Size, string> = {
        xs: "text-xs",
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg",
        xl: "text-xl",
    };

    const spinnerClasses = $derived(
        `animate-spin rounded-full ${sizeClasses[size]} ${variantClasses[variant]} ${className}`,
    );
    const labelClasses = $derived(
        `mt-2 text-muted-foreground ${labelSizeClasses[size]}`,
    );
</script>

{#if fullScreen}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        role="status"
        aria-live="polite"
        aria-label={label || "Loading"}
    >
        <div class="flex flex-col items-center gap-2">
            <div class={spinnerClasses}></div>
            {#if label}
                <p class={labelClasses}>{label}</p>
            {/if}
        </div>
    </div>
{:else if centered}
    <div
        class="flex flex-col items-center justify-center gap-2"
        role="status"
        aria-live="polite"
        aria-label={label || "Loading"}
    >
        <div class={spinnerClasses}></div>
        {#if label}
            <p class={labelClasses}>{label}</p>
        {/if}
    </div>
{:else}
    <div
        class="inline-flex flex-col items-center gap-2"
        role="status"
        aria-live="polite"
        aria-label={label || "Loading"}
    >
        <div class={spinnerClasses}></div>
        {#if label}
            <p class={labelClasses}>{label}</p>
        {/if}
    </div>
{/if}

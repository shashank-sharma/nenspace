<!--
  EmptyState Component
  
  Production-grade empty state component with full customization.
  
  Features:
  - Customizable icon, title, description
  - Optional action button
  - Slots for custom content
  - Multiple size variants
  - Responsive design
  
  ✅ Eliminates ~150 lines of duplicate empty state markup
-->
<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import type { ComponentType } from "svelte";

    type Size = "sm" | "md" | "lg";

    let {
        icon,
        title = "No items found",
        description,
        actionLabel,
        onaction,
        size = "md",
        class: className = "",
        children,
    } = $props<{
        icon?: ComponentType;
        title?: string;
        description?: string;
        actionLabel?: string;
        onaction?: () => void;
        size?: Size;
        class?: string;
        children?: any;
    }>();

    // Size mappings
    const iconSizeClasses: Record<Size, string> = {
        sm: "h-10 w-10",
        md: "h-16 w-16",
        lg: "h-24 w-24",
    };

    const titleSizeClasses: Record<Size, string> = {
        sm: "text-lg",
        md: "text-xl",
        lg: "text-2xl",
    };

    const descriptionSizeClasses: Record<Size, string> = {
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg",
    };

    const paddingClasses: Record<Size, string> = {
        sm: "py-6",
        md: "py-12",
        lg: "py-16",
    };
</script>

<div
    class="flex flex-col items-center justify-center {paddingClasses[
        size
    ]} {className}"
    role="status"
    aria-label={title}
>
    {#if icon}
        {@const IconComponent = icon}
        <div class="{iconSizeClasses[size]} text-muted-foreground/50 mb-4">
            <IconComponent class="h-full w-full" />
        </div>
    {/if}

    <h3 class="{titleSizeClasses[size]} font-semibold text-foreground mb-2">
        {title}
    </h3>

    {#if description}
        <p
            class="{descriptionSizeClasses[
                size
            ]} text-muted-foreground text-center max-w-md mb-4"
        >
            {description}
        </p>
    {/if}

    {#if children}
        <div class="mt-4">
            {@render children()}
        </div>
    {:else if actionLabel && onaction}
        <Button on:click={onaction} class="mt-4">
            {actionLabel}
        </Button>
    {/if}
</div>

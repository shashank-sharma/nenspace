<script lang="ts">
    import { Badge } from "$lib/components/ui/badge";
    import type { FeatureCapability } from "$lib/utils/platform";

    let { capability } = $props<{
        capability: FeatureCapability;
    }>();

    const badgeConfig: Record<
        FeatureCapability,
        {
            text: string;
            variant: "secondary" | "outline" | "destructive";
        } | null
    > = {
        full: null, // No badge needed
        limited: {
            text: "Limited",
            variant: "secondary" as const,
        },
        "view-only": {
            text: "View Only",
            variant: "outline" as const,
        },
        disabled: {
            text: "Desktop Only",
            variant: "destructive" as const,
        },
    };

    const config = badgeConfig[capability as keyof typeof badgeConfig];
</script>

{#if config}
    <Badge variant={config.variant} class="text-xs">
        {config.text}
    </Badge>
{/if}

<script lang="ts">
    /**
     * Platform Guard Component
     *
     * Conditionally renders children based on platform capabilities.
     * Shows fallback UI for unavailable features.
     */
    import type { Snippet } from "svelte";
    import { getFeatureCapability } from "$lib/utils/feature-capabilities";
    import FeatureRestrictionBanner from "./FeatureRestrictionBanner.svelte";
    import type { FeatureCapability } from "$lib/utils/platform";

    let {
        feature,
        requiredCapability = "full",
        featureName,
        showBanner = true,
        customMessage,
        fallback,
        children,
    } = $props<{
        feature: string;
        requiredCapability?: FeatureCapability;
        featureName?: string;
        showBanner?: boolean;
        customMessage?: string;
        fallback?: Snippet;
        children: Snippet;
    }>();

    const currentCapability = getFeatureCapability(feature);

    // Check if current capability meets requirement
    const capabilityOrder: FeatureCapability[] = [
        "full",
        "limited",
        "view-only",
        "disabled",
    ];
    const hasRequiredCapability =
        capabilityOrder.indexOf(currentCapability) <=
        capabilityOrder.indexOf(requiredCapability);
</script>

{#if hasRequiredCapability}
    {@render children()}
{:else}
    {#if showBanner}
        <FeatureRestrictionBanner
            capability={currentCapability}
            featureName={featureName || feature}
            {customMessage}
        />
    {/if}
    {#if fallback}
        {@render fallback()}
    {/if}
{/if}

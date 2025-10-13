<script lang="ts">
    /**
     * Platform System Usage Example
     *
     * This component demonstrates all the ways to use the platform detection system.
     * Use this as a reference when implementing platform-aware features.
     */
    import {
        PlatformGuard,
        FeatureBadge,
        FeatureRestrictionBanner,
        isTauri,
        getFeatureCapability,
    } from "$lib/components/platform";
    import { usePlatform } from "$lib/hooks/usePlatform.svelte";
    import { Button } from "$lib/components/ui/button";
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";

    // Method 1: Use the hook for reactive platform state
    const platform = usePlatform();

    // Method 2: Get capability for a specific feature
    const drawingCapability = getFeatureCapability("drawings");

    // Method 3: Direct function calls
    const isDesktopApp = isTauri();

    function handleAction() {
        if (platform.isTauri) {
            console.log("Tauri-specific action");
            // Use Tauri APIs here
        } else {
            console.log("Web/PWA action");
            // Use web APIs here
        }
    }
</script>

<div class="space-y-6 p-6">
    <Card>
        <CardHeader>
            <CardTitle>Platform Detection Examples</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
            <!-- Example 1: Using usePlatform hook -->
            <div>
                <h3 class="font-semibold mb-2">Current Platform Info:</h3>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    <li>Platform: {platform.platformName}</li>
                    <li>OS: {platform.os}</li>
                    <li>Device: {platform.isMobile ? "Mobile" : "Desktop"}</li>
                    <li>Tauri: {platform.isTauri ? "Yes" : "No"}</li>
                    <li>PWA: {platform.isPWA ? "Yes" : "No"}</li>
                </ul>
            </div>

            <!-- Example 2: Conditional UI based on platform -->
            <div>
                <h3 class="font-semibold mb-2">Platform-Specific UI:</h3>
                {#if platform.isTauri}
                    <p class="text-sm text-green-600 dark:text-green-400">
                        ✓ You're using the desktop app with full features!
                    </p>
                {:else if platform.isPWA}
                    <p class="text-sm text-blue-600 dark:text-blue-400">
                        ℹ You're using the PWA with core features.
                    </p>
                {:else}
                    <p class="text-sm text-orange-600 dark:text-orange-400">
                        ⚠ You're using the web version with limited features.
                    </p>
                {/if}
            </div>

            <!-- Example 3: Platform-specific actions -->
            <div>
                <h3 class="font-semibold mb-2">Platform Actions:</h3>
                <Button on:click={handleAction} size="sm">
                    {platform.isTauri ? "Use Native API" : "Use Web API"}
                </Button>
            </div>
        </CardContent>
    </Card>

    <Card>
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                Feature Guards Example
                <FeatureBadge capability={drawingCapability} />
            </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
            <!-- Example 4: Using PlatformGuard -->
            <div>
                <h3 class="font-semibold mb-2">Drawing Feature:</h3>
                <PlatformGuard feature="drawings" featureName="Drawing Editor">
                    <!-- This shows on Tauri (full capability) -->
                    <div class="p-4 bg-green-100 dark:bg-green-900 rounded">
                        <p class="text-sm">
                            ✓ Full drawing editor with layers and export
                        </p>
                    </div>

                    {#snippet fallback()}
                        <!-- This shows on PWA/Web (view-only) -->
                        <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded">
                            <p class="text-sm">View-only mode</p>
                        </div>
                    {/snippet}
                </PlatformGuard>
            </div>

            <!-- Example 5: Using FeatureRestrictionBanner -->
            <div>
                <h3 class="font-semibold mb-2">Feature Banner:</h3>
                <FeatureRestrictionBanner
                    capability={drawingCapability}
                    featureName="Drawing Editor"
                    customMessage="The full drawing editor requires the desktop app for advanced features."
                />
            </div>
        </CardContent>
    </Card>

    <Card>
        <CardHeader>
            <CardTitle>Feature Capability Checks</CardTitle>
        </CardHeader>
        <CardContent>
            <ul class="space-y-2 text-sm">
                <li class="flex items-center gap-2">
                    <span>Calendar:</span>
                    <FeatureBadge
                        capability={getFeatureCapability("calendar")}
                    />
                    <span class="text-muted-foreground">
                        {platform.hasFullFeature("calendar")
                            ? "Full"
                            : "Limited"}
                    </span>
                </li>
                <li class="flex items-center gap-2">
                    <span>Food Log:</span>
                    <FeatureBadge
                        capability={getFeatureCapability("foodLog")}
                    />
                    <span class="text-muted-foreground">
                        {platform.hasFullFeature("foodLog")
                            ? "Full"
                            : "Limited"}
                    </span>
                </li>
                <li class="flex items-center gap-2">
                    <span>Drawings:</span>
                    <FeatureBadge
                        capability={getFeatureCapability("drawings")}
                    />
                    <span class="text-muted-foreground">
                        {platform.hasFullFeature("drawings")
                            ? "Full"
                            : "Limited"}
                    </span>
                </li>
                <li class="flex items-center gap-2">
                    <span>File Sync:</span>
                    <FeatureBadge
                        capability={getFeatureCapability("fileSync")}
                    />
                    <span class="text-muted-foreground">
                        {platform.isFeatureAvailable("fileSync")
                            ? "Available"
                            : "Not Available"}
                    </span>
                </li>
            </ul>
        </CardContent>
    </Card>
</div>

<style>
    /* Add any custom styles if needed */
</style>

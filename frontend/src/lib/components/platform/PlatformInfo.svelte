<script lang="ts">
    /**
     * Platform Info Card
     *
     * Shows current platform information in a compact card.
     * Useful for debugging and development.
     */
    import { usePlatform } from "$lib/hooks/usePlatform.svelte";
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";

    const platform = usePlatform();

    const platformColor = platform.isTauri
        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
        : platform.isPWA
          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
</script>

<Card class="w-full max-w-md">
    <CardHeader>
        <CardTitle class="text-base flex items-center gap-2">
            Platform Info
            <Badge class={platformColor}>
                {platform.platformName}
            </Badge>
        </CardTitle>
    </CardHeader>
    <CardContent>
        <dl class="grid grid-cols-2 gap-2 text-sm">
            <dt class="text-muted-foreground">OS:</dt>
            <dd class="font-medium">{platform.os}</dd>

            <dt class="text-muted-foreground">Device:</dt>
            <dd class="font-medium">
                {platform.isMobile ? "Mobile" : "Desktop"}
            </dd>

            <dt class="text-muted-foreground">Tauri:</dt>
            <dd class="font-medium">{platform.isTauri ? "Yes" : "No"}</dd>

            <dt class="text-muted-foreground">PWA:</dt>
            <dd class="font-medium">{platform.isPWA ? "Yes" : "No"}</dd>

            {#if platform.isDev}
                <dt class="text-muted-foreground">Mode:</dt>
                <dd class="font-medium text-orange-600 dark:text-orange-400">
                    Development
                </dd>
            {/if}
        </dl>
    </CardContent>
</Card>

<script lang="ts">
    import {
        Alert,
        AlertDescription,
        AlertTitle,
    } from "$lib/components/ui/alert";
    import { Button } from "$lib/components/ui/button";
    import { Download, Info, Eye } from "lucide-svelte";
    import type { FeatureCapability } from "$lib/utils/platform";
    import { getDesktopDownloadUrl, getPlatform } from "$lib/utils/platform";
    import type { ComponentType } from "svelte";

    let { capability, featureName, customMessage } = $props<{
        capability: FeatureCapability;
        featureName: string;
        customMessage?: string;
    }>();

    const platform = getPlatform();

    function handleDownload() {
        window.open(getDesktopDownloadUrl(), "_blank");
    }

    type ConfigType = {
        icon: ComponentType;
        title: string;
        message: string;
        variant: "default" | "destructive";
        showDownload: boolean;
    };

    const config: Record<Exclude<FeatureCapability, "full">, ConfigType> = {
        limited: {
            icon: Info,
            title: "Limited Features",
            message:
                customMessage ||
                `Some ${featureName} features are limited on ${platform === "pwa" ? "mobile" : "web"}.`,
            variant: "default" as const,
            showDownload: true,
        },
        "view-only": {
            icon: Eye,
            title: "View Only Mode",
            message:
                customMessage ||
                `${featureName} is read-only on this platform.`,
            variant: "default" as const,
            showDownload: true,
        },
        disabled: {
            icon: Download,
            title: "Desktop App Required",
            message:
                customMessage ||
                `${featureName} is only available in the desktop app.`,
            variant: "destructive" as const,
            showDownload: true,
        },
    };

    const currentConfig =
        capability !== "full"
            ? config[capability as Exclude<FeatureCapability, "full">]
            : null;
    const IconComponent = currentConfig?.icon;
</script>

{#if currentConfig && IconComponent}
    <Alert variant={currentConfig.variant} class="my-4">
        <IconComponent class="h-4 w-4" />
        <AlertTitle>{currentConfig.title}</AlertTitle>
        <AlertDescription class="flex items-center justify-between">
            <span>{currentConfig.message}</span>
            {#if currentConfig.showDownload}
                <Button
                    variant="outline"
                    size="sm"
                    on:click={handleDownload}
                    class="ml-4"
                >
                    <Download class="mr-2 h-4 w-4" />
                    Get Desktop App
                </Button>
            {/if}
        </AlertDescription>
    </Alert>
{/if}

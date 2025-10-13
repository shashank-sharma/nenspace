<script lang="ts">
    /**
     * Limited Functionality Banner
     *
     * Automatically detects if the current page has limited functionality
     * and shows a dismissible banner with a link to download the desktop app.
     */
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import {
        Alert,
        AlertDescription,
        AlertTitle,
    } from "$lib/components/ui/alert";
    import { Button } from "$lib/components/ui/button";
    import { X, Download, Info } from "lucide-svelte";
    import {
        getLimitedPageFeatures,
        getPageLimitationMessage,
    } from "$lib/utils/page-features";
    import { getDesktopDownloadUrl } from "$lib/utils/platform";
    import { usePlatform } from "$lib/hooks/usePlatform.svelte";

    const platform = usePlatform();

    // Reactive state
    let dismissed = $state(false);
    let dismissedPages = $state<Set<string>>(new Set());

    // Load dismissed pages from localStorage
    $effect(() => {
        if (browser) {
            const stored = localStorage.getItem(
                "dismissedLimitedFunctionality",
            );
            if (stored) {
                try {
                    dismissedPages = new Set(JSON.parse(stored));
                } catch (e) {
                    dismissedPages = new Set();
                }
            }
        }
    });

    // Check if current page has limitations
    const currentPath = $derived($page.url.pathname);
    const limitedFeatures = $derived(getLimitedPageFeatures(currentPath));
    const message = $derived(getPageLimitationMessage(currentPath));
    const shouldShow = $derived(
        !platform.isTauri &&
            limitedFeatures.length > 0 &&
            !dismissed &&
            !dismissedPages.has(currentPath),
    );

    function handleDismiss() {
        dismissed = true;
        dismissedPages.add(currentPath);
        if (browser) {
            localStorage.setItem(
                "dismissedLimitedFunctionality",
                JSON.stringify([...dismissedPages]),
            );
        }
    }

    function handleDownload() {
        window.open(getDesktopDownloadUrl(), "_blank");
    }

    // Reset dismissed state when navigating to a new page
    $effect(() => {
        currentPath; // Track dependency
        dismissed = false;
    });
</script>

{#if shouldShow && message}
    <div class="limited-functionality-banner">
        <Alert
            variant="default"
            class="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20"
        >
            <Info class="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertTitle class="text-orange-900 dark:text-orange-100">
                Limited Functionality
            </AlertTitle>
            <AlertDescription
                class="text-orange-800 dark:text-orange-200 flex items-start justify-between gap-4"
            >
                <div class="flex-1">
                    <p class="mb-2">{message}</p>
                    {#if limitedFeatures.length > 0}
                        <p class="text-xs text-orange-700 dark:text-orange-300">
                            Limited features:
                            {limitedFeatures.map((f) => f.name).join(", ")}
                        </p>
                    {/if}
                </div>
                <div class="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        on:click={handleDownload}
                        class="whitespace-nowrap border-orange-600 text-orange-600 hover:bg-orange-100 dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-900/30"
                    >
                        <Download class="mr-2 h-3 w-3" />
                        Get Desktop App
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        on:click={handleDismiss}
                        class="h-8 w-8 p-0 text-orange-600 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-900/30"
                    >
                        <X class="h-4 w-4" />
                        <span class="sr-only">Dismiss</span>
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    </div>
{/if}

<style>
    .limited-functionality-banner {
        position: sticky;
        top: 0;
        z-index: 40;
        margin-bottom: 1rem;
    }

    @media (max-width: 640px) {
        .limited-functionality-banner :global(.alert) {
            font-size: 0.875rem;
        }
    }
</style>

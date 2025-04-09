<script lang="ts">
    import {
        backendStatus,
        updateBackendUrl,
        POCKETBASE_URL_KEY,
    } from "$lib/config/pocketbase";
    import { browser } from "$app/environment";
    import { fade, scale } from "svelte/transition";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { AlertCircle, Database, RefreshCw } from "lucide-svelte";
    import { checkBackendHealth } from "$lib/config/pocketbase";
    import { onMount } from "svelte";

    let pocketbaseUrl = "";
    let isRetrying = false;
    let urlInputElement: any;
    let previousModalState = false;

    onMount(() => {
        if (browser) {
            // Initialize URL on mount
            pocketbaseUrl =
                localStorage.getItem(POCKETBASE_URL_KEY) ||
                "http://127.0.0.1:8090";
        }
    });

    // Only update URL value when modal first becomes visible
    $: if (browser && $backendStatus.showModal && !previousModalState) {
        previousModalState = true;
        pocketbaseUrl =
            localStorage.getItem(POCKETBASE_URL_KEY) || "http://127.0.0.1:8090";
    } else if (!$backendStatus.showModal) {
        previousModalState = false;
    }

    // Handle URL update
    function handleUpdateUrl(e: Event) {
        e?.preventDefault();
        if (!pocketbaseUrl.trim()) return;

        // Ensure URL has protocol
        let url = pocketbaseUrl.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://" + url;
            pocketbaseUrl = url;
        }

        console.log("Updating URL to:", url);
        updateBackendUrl(url);
    }

    // Handle retry without changing URL
    async function handleRetry() {
        isRetrying = true;
        await checkBackendHealth();
        isRetrying = false;
    }

    // Close the modal without action
    function handleContinue() {
        backendStatus.update((s) => ({ ...s, showModal: false }));
    }
</script>

{#if $backendStatus.showModal}
    <div
        class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        transition:fade={{ duration: 200 }}
    >
        <div
            class="bg-card border rounded-lg shadow-lg max-w-md w-full p-6"
            transition:scale={{ duration: 200, start: 0.95 }}
        >
            <form on:submit={handleUpdateUrl} class="flex flex-col gap-6">
                <!-- Header -->
                <div class="flex items-center gap-3">
                    <div
                        class="flex-shrink-0 bg-destructive/10 p-2 rounded-full"
                    >
                        <AlertCircle class="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold">
                            Backend Connection Error
                        </h2>
                        <p class="text-sm text-muted-foreground">
                            Unable to connect to the backend server
                        </p>
                    </div>
                </div>

                <!-- Error details -->
                <div class="bg-muted/50 rounded p-3 text-sm">
                    <p class="font-medium mb-1">Error details:</p>
                    <p class="text-destructive text-xs">
                        {$backendStatus.error || "Connection refused"}
                    </p>
                </div>

                <!-- URL Input -->
                <div class="space-y-2">
                    <label class="text-sm font-medium" for="pocketbase-url">
                        PocketBase URL
                    </label>
                    <div class="flex items-center gap-2">
                        <Database
                            class="h-4 w-4 text-muted-foreground flex-shrink-0"
                        />
                        <Input
                            id="pocketbase-url"
                            type="text"
                            bind:value={pocketbaseUrl}
                            bind:this={urlInputElement}
                            placeholder="Enter backend URL"
                            autocomplete="off"
                        />
                    </div>
                    <p class="text-xs text-muted-foreground">
                        Update the URL if your backend is running on a different
                        address.
                    </p>
                </div>

                <!-- Actions -->
                <div class="grid grid-cols-2 gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        on:click={handleRetry}
                        disabled={isRetrying}
                        class="flex items-center justify-center gap-2"
                    >
                        <RefreshCw
                            class={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
                        />
                        <span>Retry Connection</span>
                    </Button>
                    <Button
                        type="submit"
                        class="flex items-center justify-center gap-2"
                    >
                        <span>Update URL</span>
                    </Button>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    class="text-sm text-muted-foreground mt-2"
                    on:click={handleContinue}
                >
                    Continue Anyway
                </Button>
            </form>
        </div>
    </div>
{/if}

<script lang="ts">
    import DashboardSidebar from "./DashboardSidebar.svelte";
    import DashboardHeader from "./DashboardHeader.svelte";
    import { fade, scale } from "svelte/transition";
    import type { DashboardSection } from "../types";
    import { onMount, onDestroy } from "svelte";
    import { writable } from "svelte/store";
    import { browser } from "$app/environment";
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button";
    import {
        CheckCircle,
        AlertCircle,
        RefreshCw,
        WifiOff,
    } from "lucide-svelte";

    export let sections: DashboardSection[];

    // Create a store for tracking if we're on mobile
    const isMobileView = writable(false);

    // Store for tracking if subsections are expanded
    const mobileExpandedSection = writable<string | null>(null);

    // Health check related state
    const isConnected = writable<boolean | null>(null); // null = unknown, true = connected, false = disconnected
    const checkingConnection = writable(false);
    const showHealthModal = writable(false);
    const errorMessage = writable<string | null>(null);

    const POCKETBASE_URL_KEY = "pocketbase-url";
    const backendUrl = browser
        ? localStorage.getItem(POCKETBASE_URL_KEY) || "http://127.0.0.1:8090"
        : "http://127.0.0.1:8090";
    let inputUrl = backendUrl;

    // Function to check if we're on mobile based on window width
    function checkMobileView() {
        isMobileView.set(window.innerWidth < 768);
    }

    // Check the health of the backend
    async function checkHealth() {
        if ($checkingConnection) return;

        checkingConnection.set(true);
        errorMessage.set(null);

        try {
            // Add a random query parameter to prevent caching
            const timestamp = Date.now();
            const response = await fetch(
                `${backendUrl}/api/health?_t=${timestamp}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    // Short timeout to prevent hanging
                    signal: AbortSignal.timeout(5000),
                },
            );

            if (response.status === 200) {
                isConnected.set(true);
                showHealthModal.set(false);
            } else {
                const data = await response.json().catch(() => ({}));
                throw new Error(
                    data.message || `Server returned status ${response.status}`,
                );
            }
        } catch (error) {
            isConnected.set(false);
            errorMessage.set(
                error instanceof Error ? error.message : String(error),
            );
            showHealthModal.set(true);
        } finally {
            checkingConnection.set(false);
        }
    }

    // Update the backend URL
    function updateBackendUrl() {
        if (browser && inputUrl) {
            localStorage.setItem(POCKETBASE_URL_KEY, inputUrl);
            // This will trigger a page reload to reinitialize PocketBase
            window.location.reload();
        }
    }

    // Dismiss the modal and continue in offline mode
    function continueOffline() {
        showHealthModal.set(false);
    }

    // Set up event listeners and initial checks
    onMount(() => {
        checkMobileView();
        window.addEventListener("resize", checkMobileView);
        checkHealth();

        return () => {
            window.removeEventListener("resize", checkMobileView);
        };
    });
</script>

<div class="flex flex-col h-screen bg-background" in:fade={{ duration: 150 }}>
    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
        <DashboardSidebar
            {sections}
            isMobile={$isMobileView}
            {mobileExpandedSection}
        />

        <div class="flex-1 flex flex-col overflow-hidden">
            <DashboardHeader />

            <main class="flex-1 overflow-auto p-0">
                <slot />
                {#if $isMobileView}
                    <!-- Spacer to prevent content from being hidden behind the mobile navigation -->
                    <div
                        class="h-20 w-full mt-6"
                        class:h-40={$mobileExpandedSection !== null}
                    ></div>
                {/if}
            </main>
        </div>
    </div>

    <!-- Health check modal -->
    {#if $showHealthModal}
        <div
            class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            transition:fade={{ duration: 200 }}
        >
            <div
                class="bg-card border rounded-lg shadow-lg w-full max-w-md p-6"
                transition:scale={{ duration: 200, start: 0.95 }}
            >
                <div class="flex items-center space-x-2 text-destructive mb-4">
                    <AlertCircle class="h-6 w-6" />
                    <h2 class="text-xl font-semibold">
                        Backend Connection Error
                    </h2>
                </div>

                <p class="mb-4 text-muted-foreground">
                    Unable to connect to the backend server. Please check if the
                    server is running or update the endpoint.
                </p>

                {#if $errorMessage}
                    <div
                        class="bg-destructive/10 text-destructive p-3 rounded-md mb-4 text-sm"
                    >
                        {$errorMessage}
                    </div>
                {/if}

                <div class="space-y-4">
                    <div>
                        <label
                            for="backend-url"
                            class="text-sm font-medium mb-1 block"
                            >Backend Endpoint</label
                        >
                        <Input
                            id="backend-url"
                            type="text"
                            bind:value={inputUrl}
                            placeholder="e.g. http://127.0.0.1:8090"
                            class="w-full"
                        />
                    </div>

                    <div class="flex flex-col sm:flex-row gap-2">
                        <Button
                            variant="default"
                            class="flex-1"
                            on:click={updateBackendUrl}
                            disabled={$checkingConnection || !inputUrl}
                        >
                            Update & Reconnect
                        </Button>
                        <Button
                            variant="outline"
                            class="flex-1"
                            on:click={checkHealth}
                            disabled={$checkingConnection}
                        >
                            {#if $checkingConnection}
                                <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                                Checking...
                            {:else}
                                <RefreshCw class="mr-2 h-4 w-4" />
                                Retry
                            {/if}
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        class="w-full"
                        on:click={continueOffline}
                    >
                        <WifiOff class="mr-2 h-4 w-4" />
                        Continue in Offline Mode
                    </Button>
                </div>
            </div>
        </div>
    {/if}
</div>

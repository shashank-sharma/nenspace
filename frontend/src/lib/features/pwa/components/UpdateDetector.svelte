<script lang="ts">
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { RefreshCw } from "lucide-svelte";
    import { isTauri } from "$lib/utils/platform";

    // State
    let updateAvailable = false;
    let registration: ServiceWorkerRegistration | null = null;
    let toastShown = false;

    // Update the service worker
    function updateServiceWorker() {
        if (registration && registration.waiting) {
            // Send message to service worker to skip waiting
            registration.waiting.postMessage({ type: "SKIP_WAITING" });

            // Reload the page to activate the new service worker
            window.location.reload();
        }
    }

    // Setup service worker update detection
    function setupUpdateDetection() {
        // Skip if running in Tauri or service worker not supported
        if (isTauri() || !("serviceWorker" in navigator)) return;

        // Use the existing registration from VitePWA (already auto-registered)
        navigator.serviceWorker.getRegistration().then((reg) => {
            if (!reg) {
                console.log(
                    "[UpdateDetector] No service worker registered (disabled in dev)",
                );
                return;
            }

            registration = reg;

            // Detect if there's already a waiting service worker
            if (reg.waiting) {
                updateAvailable = true;
                showUpdateToast();
            }

            // Detect when a new service worker is installed but waiting
            reg.onupdatefound = () => {
                const newWorker = reg.installing;
                if (!newWorker) return;

                newWorker.onstatechange = () => {
                    if (
                        newWorker.state === "installed" &&
                        navigator.serviceWorker.controller
                    ) {
                        updateAvailable = true;
                        showUpdateToast();
                    }
                };
            };
        });

        // Listen for controller change events
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data && event.data.type === "SW_UPDATED") {
                updateAvailable = true;
                showUpdateToast();
            }
        });
    }

    // Show update toast notification
    function showUpdateToast() {
        if (toastShown) return;
        toastShown = true;

        toast.message("App update available", {
            description: "Reload to get the latest version",
            duration: Infinity,
            action: {
                label: "Update now",
                onClick: updateServiceWorker,
            },
            icon: RefreshCw,
        });
    }

    // Setup periodic checks for updates
    function setupPeriodicUpdates() {
        // Skip if running in Tauri or no registration
        if (isTauri() || !registration) return;

        // Check for updates when the page becomes visible again
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && registration) {
                registration.update();
            }
        });

        // Check for updates every 30 minutes
        const THIRTY_MINUTES = 30 * 60 * 1000;
        setInterval(() => {
            if (registration) {
                registration.update();
            }
        }, THIRTY_MINUTES);
    }

    onMount(() => {
        // Skip entirely if running in Tauri
        if (isTauri()) {
            console.log("[UpdateDetector] Skipping in Tauri mode");
            return;
        }

        setupUpdateDetection();
        setupPeriodicUpdates();

        return () => {
            // Clean up
            if (registration) {
                // No need to unregister, just cleanup our references
                registration = null;
            }
        };
    });
</script>

{#if updateAvailable}
    <div
        class="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground py-2 px-4 rounded-full shadow-lg flex items-center space-x-2"
    >
        <RefreshCw class="h-4 w-4 animate-spin" />
        <span class="text-sm font-medium">Update Ready</span>
        <Button
            variant="secondary"
            size="sm"
            class="ml-2 h-7"
            on:click={updateServiceWorker}
        >
            Refresh
        </Button>
    </div>
{/if}

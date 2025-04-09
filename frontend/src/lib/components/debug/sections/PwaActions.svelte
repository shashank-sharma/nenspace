<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import {
        RefreshCcw,
        Download,
        Trash,
        RotateCcw,
        Shield,
        Zap,
        Database,
        WifiOff,
        Smartphone,
    } from "lucide-svelte";
    import {
        triggerInstallBanner,
        resetInstallBanner,
        toggleInstalledState,
        toggleOfflineMode,
        installPrompt,
        isPwaInstalled,
        isOffline,
        devControls,
        disableServiceWorkerCaching,
        enableServiceWorkerCaching,
        isServiceWorkerCachingDisabled,
    } from "$lib/features/pwa/services";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { writable, derived } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { Input } from "$lib/components/ui/input";
    import {
        Accordion,
        AccordionContent,
        AccordionItem,
        AccordionTrigger,
    } from "$lib/components/ui/accordion";
    import { Label } from "$lib/components/ui/label";
    import { Switch } from "$lib/components/ui/switch";

    // PWA debug status stores
    const installedStore = writable(false);
    const offlineStore = writable(false);
    const promptAvailableStore = derived(installPrompt, ($p) => !!$p);
    const cachingDisabledStore = writable(false);

    // PWA feature detection stores
    const supportsStore = writable({
        serviceWorker: false,
        pushManager: false,
        periodicSync: false,
        backgroundSync: false,
        navigationPreload: false,
        installPrompt: false,
        appBadge: false,
    });

    // PWA cache stats
    const cacheStats = writable({
        cacheNames: [] as string[],
        totalSize: 0,
    });

    let swRegistration: ServiceWorkerRegistration | null = null;

    // Initialize stores
    onMount(async () => {
        if (browser) {
            // Update installed status
            const unsubInstalled = isPwaInstalled.subscribe(
                ($isPwaInstalled) => {
                    const unsubDev = devControls.subscribe(($devControls) => {
                        installedStore.set(
                            $isPwaInstalled || $devControls.simulateInstalled,
                        );
                    });
                },
            );

            // Update offline status
            const unsubOffline = isOffline.subscribe(($isOffline) => {
                offlineStore.set($isOffline);
            });

            // Check for service worker registration
            if ("serviceWorker" in navigator) {
                try {
                    swRegistration =
                        await navigator.serviceWorker.getRegistration();
                } catch (err) {
                    console.error("Error getting SW registration:", err);
                }
            }

            // Initialize caching disabled status
            try {
                const isCachingDisabled =
                    await isServiceWorkerCachingDisabled();
                cachingDisabledStore.set(isCachingDisabled);
            } catch (err) {
                console.error("Error checking caching status:", err);
            }

            // Feature detection
            detectPwaFeatures();

            // Get cache stats
            updateCacheStats();

            return () => {
                // Cleanup subscriptions
                unsubInstalled();
                unsubOffline();
            };
        }
    });

    // Detect available PWA features
    async function detectPwaFeatures() {
        if (!browser) return;

        const features = {
            serviceWorker: "serviceWorker" in navigator,
            pushManager: "PushManager" in window,
            periodicSync: false,
            backgroundSync: false,
            navigationPreload: false,
            installPrompt:
                "BeforeInstallPromptEvent" in window ||
                typeof window.BeforeInstallPromptEvent !== "undefined",
            appBadge:
                "setAppBadge" in navigator ||
                ("ExperimentalBadge" in window &&
                    "set" in (window as any).ExperimentalBadge),
        };

        // Check for background sync support
        if (features.serviceWorker && "SyncManager" in window) {
            features.backgroundSync = true;
        }

        // Check for periodic sync support
        if (features.serviceWorker && "PeriodicSyncManager" in window) {
            features.periodicSync = true;
        }

        // Check for navigation preload support
        if (
            features.serviceWorker &&
            navigator.serviceWorker &&
            "navigationPreload" in navigator.serviceWorker
        ) {
            features.navigationPreload = true;
        }

        supportsStore.set(features);
    }

    // Update cache statistics
    async function updateCacheStats() {
        if (!browser || !("caches" in window)) return;

        try {
            const cacheNames = await caches.keys();
            let totalSize = 0;

            for (const name of cacheNames) {
                const cache = await caches.open(name);
                const keys = await cache.keys();
                totalSize += keys.length;
            }

            cacheStats.set({
                cacheNames,
                totalSize,
            });

            toast.success("Cache stats updated");
        } catch (err) {
            console.error("Error getting cache stats:", err);
            toast.error("Failed to get cache stats");
        }
    }

    // Clear all caches
    async function clearAllCaches() {
        if (!browser || !("caches" in window)) return;

        try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
            toast.success("All caches cleared");
            updateCacheStats();
        } catch (err) {
            console.error("Error clearing caches:", err);
            toast.error("Failed to clear caches");
        }
    }

    // Force service worker update
    async function updateServiceWorker() {
        if (!browser || !navigator.serviceWorker) {
            toast.error("Service Worker not supported");
            return;
        }

        try {
            let registration = swRegistration;

            if (!registration) {
                registration = await navigator.serviceWorker.getRegistration();
            }

            if (registration) {
                await registration.update();
                toast.success("Service Worker update initiated");

                // If there's a waiting worker, notify the user
                if (registration.waiting) {
                    toast.message("New version ready", {
                        description: "Reload to activate the new version",
                        action: {
                            label: "Reload",
                            onClick: () => {
                                if (registration?.waiting) {
                                    registration.waiting.postMessage({
                                        type: "SKIP_WAITING",
                                    });
                                }
                                window.location.reload();
                            },
                        },
                    });
                }
            } else {
                toast.error("No Service Worker registration found");
            }
        } catch (err) {
            console.error("Error updating Service Worker:", err);
            toast.error("Failed to update Service Worker");
        }
    }

    // Toggle functions
    function handleToggleInstalled() {
        toggleInstalledState();
        toast.success(
            `Installation status ${$installedStore ? "disabled" : "enabled"}`,
        );
    }

    function handleToggleOffline() {
        toggleOfflineMode();
        toast.success(`App is now ${$offlineStore ? "online" : "offline"}`);
    }

    function handleShowBanner() {
        triggerInstallBanner();
        toast.success("Install banner triggered");
    }

    function handleResetBanner() {
        resetInstallBanner();
        toast.success("Install banner state reset");
    }

    // Handle service worker caching toggle
    async function toggleCaching() {
        if (!browser) return;

        try {
            if ($cachingDisabledStore) {
                const result = await enableServiceWorkerCaching();
                if (result) {
                    toast.success("Service Worker caching enabled");
                    cachingDisabledStore.set(false);
                } else {
                    toast.error("Failed to enable caching");
                }
            } else {
                const result = await disableServiceWorkerCaching();
                if (result) {
                    toast.success("Service Worker caching disabled");
                    cachingDisabledStore.set(true);
                } else {
                    toast.error("Failed to disable caching");
                }
            }
        } catch (err) {
            console.error("Error toggling caching:", err);
            toast.error("Error toggling cache state");
        }
    }
</script>

<div class="space-y-4">
    <!-- Installation Status -->
    <div class="flex flex-col">
        <label class="text-sm text-muted-foreground mb-1"
            >Installation Status</label
        >
        <div class="flex justify-between items-center">
            <span class="text-sm">
                <span
                    class={$installedStore
                        ? "text-green-500"
                        : "text-amber-500"}
                >
                    {$installedStore ? "Installed" : "Not Installed"}
                </span>
            </span>
            <Button
                variant={$installedStore ? "destructive" : "outline"}
                size="sm"
                class="flex items-center gap-1"
                on:click={handleToggleInstalled}
            >
                <Smartphone size={14} />
                {$installedStore
                    ? "Simulate Not Installed"
                    : "Simulate Installed"}
            </Button>
        </div>
    </div>

    <!-- Install Prompt Status -->
    <div class="flex flex-col">
        <label class="text-sm text-muted-foreground mb-1">Install Prompt</label>
        <div class="flex justify-between items-center">
            <span class="text-sm">
                <span
                    class={$promptAvailableStore
                        ? "text-green-500"
                        : "text-amber-500"}
                >
                    {$promptAvailableStore ? "Available" : "Not Available"}
                </span>
            </span>
            <Button
                variant="outline"
                size="sm"
                disabled={!$promptAvailableStore}
                class="flex items-center gap-1"
                on:click={handleShowBanner}
                title={!$promptAvailableStore
                    ? "No install prompt available"
                    : ""}
            >
                <Download size={14} />
                Show Prompt
            </Button>
        </div>
    </div>

    <!-- Offline Mode -->
    <div class="flex flex-col">
        <label class="text-sm text-muted-foreground mb-1">Offline Mode</label>
        <div class="flex justify-between items-center">
            <span class="text-sm">
                <span
                    class={$offlineStore ? "text-amber-500" : "text-green-500"}
                >
                    {$offlineStore ? "Offline" : "Online"}
                </span>
            </span>
            <Button
                variant={$offlineStore ? "destructive" : "outline"}
                size="sm"
                class="flex items-center gap-1"
                on:click={handleToggleOffline}
            >
                <WifiOff size={14} />
                {$offlineStore ? "Go Online" : "Simulate Offline"}
            </Button>
        </div>
    </div>

    <!-- Caching Disabled -->
    <div class="flex flex-col">
        <label class="text-sm text-muted-foreground mb-1"
            >Service Worker Caching</label
        >
        <div class="flex justify-between items-center">
            <span class="text-sm">
                <span
                    class={$cachingDisabledStore
                        ? "text-amber-500"
                        : "text-green-500"}
                >
                    {$cachingDisabledStore ? "Disabled" : "Enabled"}
                </span>
            </span>
            <Button
                variant={$cachingDisabledStore ? "destructive" : "outline"}
                size="sm"
                class="flex items-center gap-1"
                on:click={toggleCaching}
            >
                <Database size={14} />
                {$cachingDisabledStore ? "Enable Caching" : "Disable Caching"}
            </Button>
        </div>
    </div>

    <!-- Advanced Controls -->
    <Accordion type="single" collapsible class="mt-6">
        <!-- Cache Management -->
        <AccordionItem value="cache">
            <AccordionTrigger>
                <div class="flex items-center gap-2">
                    <Database size={16} />
                    <span>Cache Management</span>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div class="space-y-3 pt-2">
                    <div class="text-sm">
                        <div class="font-medium mb-1">Cache Stats</div>
                        <div class="text-muted-foreground text-xs space-y-1">
                            <div>
                                Names: {$cacheStats.cacheNames.join(", ") ||
                                    "None"}
                            </div>
                            <div>Total Entries: {$cacheStats.totalSize}</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            class="flex items-center justify-center gap-1"
                            on:click={updateCacheStats}
                        >
                            <RotateCcw size={14} />
                            <span>Refresh Stats</span>
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            class="flex items-center justify-center gap-1"
                            on:click={clearAllCaches}
                        >
                            <Trash size={14} />
                            <span>Clear All</span>
                        </Button>
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>

        <!-- Service Worker -->
        <AccordionItem value="service-worker">
            <AccordionTrigger>
                <div class="flex items-center gap-2">
                    <Shield size={16} />
                    <span>Service Worker</span>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div class="space-y-3 pt-2">
                    <div class="text-sm">
                        <div class="font-medium mb-1">Controls</div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        class="flex items-center justify-center gap-1 w-full"
                        on:click={updateServiceWorker}
                    >
                        <RefreshCcw size={14} />
                        <span>Update Service Worker</span>
                    </Button>
                </div>
            </AccordionContent>
        </AccordionItem>

        <!-- Feature Detection -->
        <AccordionItem value="features">
            <AccordionTrigger>
                <div class="flex items-center gap-2">
                    <Zap size={16} />
                    <span>Feature Detection</span>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div class="space-y-3 pt-2">
                    <div class="grid grid-cols-2 gap-y-2 text-sm">
                        <div>Service Worker:</div>
                        <div
                            class={$supportsStore.serviceWorker
                                ? "text-green-500"
                                : "text-red-500"}
                        >
                            {$supportsStore.serviceWorker ? "✓" : "✗"}
                        </div>

                        <div>Push API:</div>
                        <div
                            class={$supportsStore.pushManager
                                ? "text-green-500"
                                : "text-red-500"}
                        >
                            {$supportsStore.pushManager ? "✓" : "✗"}
                        </div>

                        <div>Background Sync:</div>
                        <div
                            class={$supportsStore.backgroundSync
                                ? "text-green-500"
                                : "text-red-500"}
                        >
                            {$supportsStore.backgroundSync ? "✓" : "✗"}
                        </div>

                        <div>Periodic Sync:</div>
                        <div
                            class={$supportsStore.periodicSync
                                ? "text-green-500"
                                : "text-red-500"}
                        >
                            {$supportsStore.periodicSync ? "✓" : "✗"}
                        </div>

                        <div>Navigation Preload:</div>
                        <div
                            class={$supportsStore.navigationPreload
                                ? "text-green-500"
                                : "text-red-500"}
                        >
                            {$supportsStore.navigationPreload ? "✓" : "✗"}
                        </div>

                        <div>App Badge:</div>
                        <div
                            class={$supportsStore.appBadge
                                ? "text-green-500"
                                : "text-red-500"}
                        >
                            {$supportsStore.appBadge ? "✓" : "✗"}
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        class="flex items-center justify-center gap-1 w-full"
                        on:click={detectPwaFeatures}
                    >
                        <RefreshCcw size={14} />
                        <span>Recheck Features</span>
                    </Button>
                </div>
            </AccordionContent>
        </AccordionItem>
    </Accordion>

    <!-- Action Buttons -->
    <div class="grid grid-cols-2 gap-2 mt-4">
        <Button
            variant="outline"
            size="sm"
            class="flex items-center justify-center gap-1"
            on:click={handleShowBanner}
        >
            <Download size={14} />
            <span>Show Banner</span>
        </Button>
        <Button
            variant="outline"
            size="sm"
            class="flex items-center justify-center gap-1"
            on:click={handleResetBanner}
        >
            <RefreshCcw size={14} />
            <span>Reset Banner</span>
        </Button>
    </div>
</div>

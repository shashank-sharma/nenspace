import { browser } from "$app/environment";
import { toast } from "svelte-sonner";
import { isTauri, getPlatform, getPlatformName } from "$lib/utils/platform";

class PwaServiceImpl {
    // --- State ---
    #installPromptEvent = $state<Event | null>(null);
    #isInstalled = $state(false);
    #isOffline = $state(false);
    #simulateInstalled = $state(false);
    #simulateOffline = $state(false);
    readonly #cachingDisabled = $state(false);
    readonly #isTauriApp = $state(false);

    cacheStats = $state<{ cacheNames: string[]; totalSize: number }>({
        cacheNames: [],
        totalSize: 0,
    });

    supportedFeatures = $state({
        serviceWorker: false,
        pushManager: false,
        periodicSync: false,
        backgroundSync: false,
        navigationPreload: false,
        installPrompt: false,
        appBadge: false,
    });

    constructor() {
        if (browser) {
            this.#isTauriApp = isTauri();
            this.init();
        }
    }
    
    // --- Platform Getters ---
    get isTauri() {
        return this.#isTauriApp;
    }
    
    get platform() {
        return getPlatform();
    }
    
    get platformName() {
        return getPlatformName();
    }

    // --- Getters ---
    get isPromptAvailable() {
        return this.#installPromptEvent !== null;
    }

    get effectiveInstallStatus() {
        return this.#isInstalled || this.#simulateInstalled;
    }

    get effectiveOfflineStatus() {
        return this.#isOffline || this.#simulateOffline;
    }

    get isCachingDisabled() {
        return this.#cachingDisabled;
    }

    // --- Core PWA Logic ---
    init() {
        if (!browser) return;
        
        // Skip PWA init if running in Tauri
        if (this.#isTauriApp) {
            console.log('[PWA] Running in Tauri, skipping PWA initialization');
            return;
        }

        this.registerServiceWorker();
        this.checkInstallStatus();

        // Monitor online/offline status
        const updateOnlineStatus = () => {
            this.#isOffline = !navigator.onLine;
        };
        updateOnlineStatus();
        window.addEventListener("online", updateOnlineStatus);
        window.addEventListener("offline", updateOnlineStatus);

        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            this.#installPromptEvent = e;
        });

        window.addEventListener("appinstalled", () => {
            this.#installPromptEvent = null;
            this.#isInstalled = true;
        });

        this.detectPwaFeatures();
        this.updateCacheStats();
    }

    async registerServiceWorker() {
        if (browser && "serviceWorker" in navigator) {
            try {
                // Check if service worker is actually registered (VitePWA might be disabled in dev)
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await navigator.serviceWorker.ready;
                    console.log("[PWA] Service worker is ready (managed by VitePWA)");
                } else {
                    console.log("[PWA] Service worker not registered (disabled in development)");
                }
            } catch (error) {
                // Service worker might be disabled in dev mode - this is expected
                console.log("[PWA] Service worker not available:", error);
            }
        }
    }

    checkInstallStatus() {
        if (!browser) return;
        const isStandalone = window.matchMedia(
            "(display-mode: standalone)",
        ).matches;
        // @ts-ignore
        const isIosStandalone = window.navigator.standalone === true;
        this.#isInstalled = isStandalone || isIosStandalone;
    }

    async showInstallPrompt() {
        if (this.#isTauriApp) {
            toast.info("You're already using the desktop app!");
            return;
        }
        
        if (!this.#installPromptEvent) {
            toast.error("Install prompt not available. Try adding to home screen from your browser menu.");
            return;
        }
        const prompt = this.#installPromptEvent as any;
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") {
            this.#installPromptEvent = null;
        }
    }

    // --- Debug/Dev Tools ---
    toggleSimulateInstalled() {
        this.#simulateInstalled = !this.#simulateInstalled;
        toast.success(
            `Simulating PWA ${this.#simulateInstalled ? "installed" : "not installed"}`,
        );
    }

    toggleSimulateOffline() {
        this.#simulateOffline = !this.#simulateOffline;
        toast.success(
            `Simulating ${this.#simulateOffline ? "Offline" : "Online"} mode`,
        );
    }

    async updateServiceWorker() {
        if (!browser || !navigator.serviceWorker) {
            toast.error("Service Worker not supported");
            return;
        }
        try {
            const registration =
                await navigator.serviceWorker.getRegistration();
            if (registration) {
                await registration.update();
                toast.success("Service Worker update check initiated.");
                if (registration.waiting) {
                    toast.info("New version available. Reload to update.");
                }
            }
        } catch (error) {
            console.error("[PWA] Failed to update Service Worker:", error);
            toast.error("Failed to update Service Worker.");
        }
    }

    // --- Cache Management ---
    async updateCacheStats() {
        if (!browser || !("caches" in window)) return;
        try {
            const cacheNames = await caches.keys();
            let totalSize = 0;
            for (const name of cacheNames) {
                const cache = await caches.open(name);
                const keys = await cache.keys();
                totalSize += keys.length;
            }
            this.cacheStats = { cacheNames, totalSize };
            toast.success("Cache stats updated");
        } catch (error) {
            console.error("[PWA] Failed to get cache stats:", error);
            toast.error("Failed to get cache stats");
        }
    }

    async clearAllCaches() {
        if (!browser || !("caches" in window)) return;
        try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
            toast.success("All caches cleared");
            this.updateCacheStats();
        } catch (error) {
            console.error("[PWA] Failed to clear caches:", error);
            toast.error("Failed to clear caches");
        }
    }

    // --- Caching Toggle ---
    // Note: VitePWA/Workbox handles caching automatically
    // Toggle functionality removed as it's managed by Workbox configuration
    async toggleCaching() {
        toast.info("Caching is managed by Workbox. Clear cache to disable.");
    }

    async isServiceWorkerCachingDisabled(): Promise<boolean> {
        // VitePWA always has caching enabled when SW is active
        return false;
    }

    // --- Feature Detection ---
    detectPwaFeatures() {
        if (!browser) return;
        this.supportedFeatures = {
            serviceWorker: "serviceWorker" in navigator,
            pushManager: "PushManager" in window,
            periodicSync:
                "serviceWorker" in navigator &&
                "PeriodicSyncManager" in window,
            backgroundSync:
                "serviceWorker" in navigator && "SyncManager" in window,
            navigationPreload:
                "serviceWorker" in navigator &&
                "navigationPreload" in ServiceWorkerRegistration.prototype,
            installPrompt: "BeforeInstallPromptEvent" in window,
            appBadge: "setAppBadge" in navigator,
        };
    }
}

export const PwaService = new PwaServiceImpl();

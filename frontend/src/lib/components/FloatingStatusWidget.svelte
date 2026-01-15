<script lang="ts">
    /**
     * Floating Status Widget for Tauri (Refactored)
     * 
     * Handles Tauri-specific window management while delegating
     * UI rendering and animations to the FloatingIsland framework.
     */
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import {
        STATUS_INDICATOR_CONFIG,
        type SystemStatus,
        IslandController,
    } from "$lib/features/status-indicator";
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import FloatingIsland from "$lib/features/status-indicator/components/FloatingIsland.svelte";
    import { isTauriEnvironment } from "$lib/utils/tauri.util";

    // ============================================================================
    // STATE
    // ============================================================================

    let systemStatus = $state<SystemStatus>({
        isBackendDown: false,
        isOffline: false,
        realtimeStatus: "disconnected" as const,
        isApiLoading: false,
        realtimeConnected: false,
        backendError: null,
        realtimeError: null,
    });

    let currentNotification = $state<any>(null);
    let musicState = $state<any>(null);
    let expansionMode = $derived(SettingsService.appearance.statusIndicatorExpansionMode);

    // Cached API imports
    let windowApi: typeof import("@tauri-apps/api/window") | null = null;
    let dpiApi: typeof import("@tauri-apps/api/dpi") | null = null;
    let eventApi: typeof import("@tauri-apps/api/event") | null = null;

    // ============================================================================
    // TAURI WINDOW MANAGEMENT
    // ============================================================================

    async function handleResize(targetWidth: number, targetHeight: number) {
        if (!browser || !windowApi || !dpiApi) return;

        try {
            const currentWindow = windowApi.getCurrentWindow();
            const currentPos = await currentWindow.outerPosition();
            const scaleFactor = await currentWindow.scaleFactor();

            const currentLogicalX = Math.round(currentPos.x / scaleFactor);
            const currentLogicalY = Math.round(currentPos.y / scaleFactor);

            // Calculate position adjustment for center mode
            let targetX = currentLogicalX;
            if (expansionMode === "center") {
                const previousWidth = await (await currentWindow.outerSize()).width / scaleFactor;
                const widthDelta = targetWidth - previousWidth;
                targetX = currentLogicalX - (widthDelta / 2);
            }

            const newSize = new dpiApi.LogicalSize(targetWidth, targetHeight);
            const newPosition = new windowApi.LogicalPosition(targetX, currentLogicalY);

            await Promise.all([
                currentWindow.setSize(newSize),
                currentWindow.setPosition(newPosition)
            ]);
        } catch (err) {
            console.error("[FloatingWidget] Resize failed:", err);
        }
    }

    async function handleDragStart() {
        if (!isTauriEnvironment() || !windowApi) return;
        try {
            await windowApi.getCurrentWindow().startDragging();
        } catch (err) {
                console.error("[FloatingWidget] Drag failed:", err);
        }
    }

    async function handleDoubleClick() {
        if (!isTauriEnvironment() || !windowApi) return;
        try {
            const windows = await windowApi.getAllWindows();
            const mainWindow = windows.find((w) => w.label === "main");
            if (mainWindow) {
                await mainWindow.show();
                await mainWindow.setFocus();
            }
        } catch (err) {
            console.error("[FloatingWidget] Show main failed:", err);
        }
    }

    // ============================================================================
    // TAURI EVENT LISTENERS
    // ============================================================================

    async function setupTauriListeners() {
        if (!eventApi) return [];
        const cleanup: any[] = [];

        const unhealth = await eventApi.listen<any>("health-status-update", (e) => {
            systemStatus.isBackendDown = !e.payload.connected;
            systemStatus.backendError = e.payload.error;
        });

        const unnetwork = await eventApi.listen<any>("network-status-update", (e) => {
            systemStatus.isOffline = e.payload.isOffline;
        });

        const unapi = await eventApi.listen<any>("api-loading-update", (e) => {
            systemStatus.isApiLoading = e.payload.isLoading;
        });

        const unnotif = await eventApi.listen<any>("island-notification", (e) => {
            currentNotification = e.payload;
        });

        const unmusic = await eventApi.listen<any>("music-playback-update", (e) => {
            musicState = e.payload;
            // Handle music view registration/showing via controller
            if (musicState.track) {
                import('$lib/features/status-indicator/components/views/MusicView.svelte').then(Views => {
                    IslandController.register({
                        id: 'music',
                        priority: 60, // IslandPriority.MUSIC
                        dimensions: { width: 180, height: 40 },
                        component: Views.default,
                        props: {}
                    });
                    IslandController.show('music');
                });
            } else if (IslandController.activeView?.id === 'music') {
                IslandController.hide('music');
            }
        });

        const unreset = await eventApi.listen("reset-widget-position", async () => {
             // Reset logic here (positioning to top-left)
        });

        return [unhealth, unnetwork, unapi, unnotif, unmusic, unreset];
    }

    // ============================================================================
    // LIFECYCLE
    // ============================================================================

    onMount(() => {
        if (!browser) return;
        let cleanupFuncs: any[] = [];

        (async () => {
            try {
                [windowApi, dpiApi, eventApi] = await Promise.all([
                    import("@tauri-apps/api/window"),
                    import("@tauri-apps/api/dpi"),
                    import("@tauri-apps/api/event"),
                ]);

                const listeners = await setupTauriListeners();
                cleanupFuncs.push(...listeners);
            } catch (err) {
                console.error("[FloatingWidget] Init failed:", err);
            }
        })();

        return () => {
            cleanupFuncs.forEach((fn) => fn());
        };
    });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
    class="status-island-wrapper"
    onmousedown={handleDragStart}
    ondblclick={handleDoubleClick}
    role="status"
    aria-live="polite"
>
    <FloatingIsland 
        {systemStatus} 
        {currentNotification} 
        isTauri={true}
        onResize={handleResize}
    />
</div>

<style>
    .status-island-wrapper {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
    }

    .status-island-wrapper:active {
        cursor: grabbing;
    }
</style>

<script lang="ts">
    /**
     * Floating Status Widget for Tauri
     *
     * A standalone floating window that displays system status and notifications.
     * Designed specifically for Tauri desktop applications.
     *
     * Features:
     * - Real-time status updates via Tauri events
     * - Compact mode displaying current time
     * - Expands to show notifications with smooth animations
     * - Draggable with persistent positioning (survives app restarts)
     * - Two expansion modes: edge (right-side) and center (bidirectional)
     * - Off-screen detection and automatic repositioning
     * - High-DPI display support with proper pixel scaling
     * - Double-click to show main application window
     *
     * @component
     */
    import { blur } from "svelte/transition";
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import { Clock, Music, Play, Pause, SkipBack, SkipForward } from "lucide-svelte";
    import {
        STATUS_INDICATOR_CONFIG,
        getStatusIndicatorState,
        type SystemStatus,
        type IslandNotification,
        getNotificationBgRgb,
        getNotificationTextRgb,
    } from "$lib/features/status-indicator";
    import { isTauriEnvironment } from "$lib/utils/tauri.util";

    interface MusicState {
        isPlaying: boolean;
        track: { title: string; artist: string } | null;
        progress: number;
    }

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const WIDGET_DIMENSIONS = {
        COMPACT_WIDTH: 120,
        EXPANDED_WIDTH: 280,
        HEIGHT: 40,
        PADDING: 20,
        MIN_VISIBLE: 20,
    } as const;

    const STORAGE_KEY = "floating-widget-position" as const;
    const EXPANSION_MODE_KEY = "floating-widget-expansion-mode" as const;

    type ExpansionMode = "edge" | "center";

    // ============================================================================
    // TYPES
    // ============================================================================

    interface Monitor {
        position: { x: number; y: number };
        size: { width: number; height: number };
    }

    type TauriWindow = ReturnType<
        typeof import("@tauri-apps/api/window").getCurrentWindow
    >;
    type UnlistenFn = () => void;

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

    let currentNotification = $state<IslandNotification | null>(null);
    let currentTime = $state("");
    let timeInterval: NodeJS.Timeout | null = null;
    let expansionMode = $state<ExpansionMode>("edge");
    let currentWidthState = $state<number>(WIDGET_DIMENSIONS.COMPACT_WIDTH);
    let musicState = $state<MusicState>({ isPlaying: false, track: null, progress: 0 });
    let isExpanded = $state(false);

    // Cached API imports for performance
    let windowApi: typeof import("@tauri-apps/api/window") | null = null;
    let dpiApi: typeof import("@tauri-apps/api/dpi") | null = null;
    let eventApi: typeof import("@tauri-apps/api/event") | null = null;

    // ============================================================================
    // DERIVED STATE
    // ============================================================================

    let statusState = $derived(getStatusIndicatorState(systemStatus));

    async function emitMusicCommand(command: 'previous' | 'toggle' | 'next') {
        if (!eventApi) return;
        try {
            await eventApi.emit('music-controls', { command });
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error('[FloatingWidget] Failed to emit music command:', err);
            }
        }
    }

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    /**
     * Easing function for smooth animations (cubic ease-in-out)
     * @param t - Progress value between 0 and 1
     * @returns Eased progress value
     */
    function easeInOutCubic(t: number): number {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * Smoothly animate the window resize and position change
     * Uses requestAnimationFrame for 60fps smooth animation
     *
     * @param currentWindow - The Tauri window instance
     * @param fromWidth - Starting width in logical pixels
     * @param toWidth - Target width in logical pixels
     * @param fromX - Starting X position in logical pixels
     * @param toX - Target X position in logical pixels
     * @param y - Y position in logical pixels (stays constant)
     * @returns Promise that resolves when animation completes
     */
    async function animateWindowResize(
        currentWindow: TauriWindow,
        fromWidth: number,
        toWidth: number,
        fromX: number,
        toX: number,
        y: number,
    ): Promise<void> {
        const duration = 250; // 250ms for snappy feel
        const startTime = performance.now();

        return new Promise<void>((resolve) => {
            const animate = async (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = easeInOutCubic(progress);

                // Interpolate width and x position
                const currentWidth = Math.round(
                    fromWidth + (toWidth - fromWidth) * easedProgress,
                );
                const currentX = Math.round(
                    fromX + (toX - fromX) * easedProgress,
                );

                try {
                    if (!windowApi || !dpiApi) return;

                    const newSize = new dpiApi.LogicalSize(
                        currentWidth,
                        WIDGET_DIMENSIONS.HEIGHT,
                    );
                    const newPosition = new windowApi.LogicalPosition(
                        currentX,
                        y,
                    );

                    await Promise.all([
                        currentWindow.setSize(newSize),
                        currentWindow.setPosition(newPosition),
                    ]);
                } catch (err) {
                    if (import.meta.env.DEV) {
                        console.error("[FloatingWidget] Animation error:", err);
                    }
                    // Resolve anyway to prevent animation hang
                    resolve();
                    return;
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    function updateTime() {
        if (!browser) return;
        const now = new Date();
        currentTime = now.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }

    function getIslandColor(): string {
        if (currentNotification) {
            return (
                currentNotification.backgroundColor ||
                getVariantBg(currentNotification.variant)
            );
        }
        return "rgb(0, 0, 0)"; // Pure black background
    }

    function getTextColor(): string {
        if (currentNotification) {
            return (
                currentNotification.textColor ||
                getVariantText(currentNotification.variant)
            );
        }
        return statusState?.iconColor || "rgb(255, 255, 255)";
    }

    function getVariantBg(variant: string): string {
        return getNotificationBgRgb(variant);
    }

    function getVariantText(variant: string): string {
        return getNotificationTextRgb(variant);
    }

    function getStatusIcon() {
        if (currentNotification) {
            return Clock;
        }
        return statusState.icon;
    }

    // ============================================================================
    // POSITION MANAGEMENT
    // ============================================================================

    function savePosition(x: number, y: number) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
            if (import.meta.env.DEV) {
                console.log(`[FloatingWidget] Position saved: (${x}, ${y})`);
            }
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error("[FloatingWidget] Failed to save position:", err);
            }
        }
    }

    function loadExpansionMode(): ExpansionMode {
        try {
            const saved = localStorage.getItem(EXPANSION_MODE_KEY);
            if (saved === "center" || saved === "edge") {
                return saved;
            }
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error(
                    "[FloatingWidget] Failed to load expansion mode:",
                    err,
                );
            }
        }
        return "center";
    }

    function saveExpansionMode(mode: ExpansionMode) {
        try {
            localStorage.setItem(EXPANSION_MODE_KEY, mode);
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error(
                    "[FloatingWidget] Failed to save expansion mode:",
                    err,
                );
            }
        }
    }

    /**
     * Toggle between edge and center expansion modes
     * Shows a notification to inform the user of the current mode
     */
    async function toggleExpansionMode() {
        expansionMode = expansionMode === "edge" ? "center" : "edge";
        saveExpansionMode(expansionMode);

        // 1. Show notification locally
        currentNotification = {
            id: "expansion-mode-toggle",
            message: `Expansion mode: ${expansionMode.toUpperCase()}`,
            variant: "info",
            duration: 2000,
            backgroundColor: getNotificationBgRgb("info"),
            textColor: getNotificationTextRgb("info"),
        };

        // 2. Broadcast to main window
        if (eventApi) {
            try {
                await eventApi.emit("broadcast-notification", {
                    message: `Expansion mode: ${expansionMode.toUpperCase()}`,
                    variant: "info",
                    duration: 2000,
                });
            } catch (err) {
                if (import.meta.env.DEV) {
                    console.error(
                        "[FloatingWidget] Failed to broadcast expansion mode notification:",
                        err,
                    );
                }
            }
        }

        // 3. Auto-dismiss
        setTimeout(() => {
            if (currentNotification?.id === "expansion-mode-toggle") {
                currentNotification = null;
            }
        }, 2000);
    }

    function isPositionVisible(
        x: number,
        y: number,
        monitors: Monitor[],
    ): boolean {
        for (const monitor of monitors) {
            const mX = monitor.position.x;
            const mY = monitor.position.y;
            const mW = monitor.size.width;
            const mH = monitor.size.height;

            const isInHorizontal =
                x + WIDGET_DIMENSIONS.MIN_VISIBLE > mX && x < mX + mW;
            const isInVertical =
                y + WIDGET_DIMENSIONS.MIN_VISIBLE > mY && y < mY + mH;

            if (isInHorizontal && isInVertical) {
                return true;
            }
        }
        return false;
    }

    function getTopLeftPosition(monitor: Monitor): { x: number; y: number } {
        return {
            x: WIDGET_DIMENSIONS.PADDING,
            y: WIDGET_DIMENSIONS.PADDING,
        };
    }

    /**
     * Restore widget position from localStorage or default to top-left
     * Validates position is visible on available monitors
     * Also sets up listener to save position on drag
     * @returns Cleanup function for the move listener
     */
    async function restorePosition(): Promise<UnlistenFn | null> {
        if (!windowApi) return null;

        try {
            const currentWindow = windowApi.getCurrentWindow();
            const monitors = await windowApi.availableMonitors();

            if (!monitors || monitors.length === 0) {
                if (import.meta.env.DEV) {
                    console.error("[FloatingWidget] No monitors found");
                }
                return null;
            }

            const primaryMonitor = monitors[0];
            let finalPosition: { x: number; y: number };

            const savedPos = localStorage.getItem(STORAGE_KEY);

            if (savedPos) {
                try {
                    const { x, y } = JSON.parse(savedPos);

                    if (isPositionVisible(x, y, monitors)) {
                        finalPosition = { x, y };
                        if (import.meta.env.DEV) {
                            console.log(
                                `[FloatingWidget] Restoring saved position: (${x}, ${y})`,
                            );
                        }
                    } else {
                        finalPosition = getTopLeftPosition(primaryMonitor);
                        savePosition(finalPosition.x, finalPosition.y);
                        if (import.meta.env.DEV) {
                            console.log(
                                `[FloatingWidget] Saved position off-screen, using default: (${finalPosition.x}, ${finalPosition.y})`,
                            );
                        }
                    }
                } catch (parseErr) {
                    finalPosition = getTopLeftPosition(primaryMonitor);
                    savePosition(finalPosition.x, finalPosition.y);
                }
            } else {
                finalPosition = getTopLeftPosition(primaryMonitor);
                savePosition(finalPosition.x, finalPosition.y);
                if (import.meta.env.DEV) {
                    console.log(
                        `[FloatingWidget] No saved position, using default: (${finalPosition.x}, ${finalPosition.y})`,
                    );
                }
            }

            await currentWindow.setPosition(
                new windowApi.LogicalPosition(finalPosition.x, finalPosition.y),
            );

            if (import.meta.env.DEV) {
                console.log(
                    `[FloatingWidget] Position applied: (${finalPosition.x}, ${finalPosition.y})`,
                );
            }

            if (!eventApi) return null;

            const unlisten = await eventApi.listen("tauri://move", async () => {
                try {
                    const physicalPos = await currentWindow.outerPosition();
                    const scaleFactor = await currentWindow.scaleFactor();

                    const logicalX = Math.round(physicalPos.x / scaleFactor);
                    const logicalY = Math.round(physicalPos.y / scaleFactor);

                    savePosition(logicalX, logicalY);
                } catch (err) {
                    if (import.meta.env.DEV) {
                        console.error(
                            "[FloatingWidget] Failed to get position:",
                            err,
                        );
                    }
                }
            });

            return unlisten;
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error(
                    "[FloatingWidget] Failed to restore position:",
                    err,
                );
            }
            return null;
        }
    }

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================

    async function handleDragStart(e: MouseEvent) {
        if (!isTauriEnvironment() || !windowApi) return;

        try {
            await windowApi.getCurrentWindow().startDragging();
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error("[FloatingWidget] Drag failed:", err);
            }
        }
    }

    async function handleDoubleClick(e: MouseEvent) {
        if (!isTauriEnvironment() || !windowApi) return;

        try {
            const windows = await windowApi.getAllWindows();
            const mainWindow = windows.find((w) => w.label === "main");

            if (mainWindow) {
                await mainWindow.show();
                await mainWindow.setFocus();
            }
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error(
                    "[FloatingWidget] Failed to show main window:",
                    err,
                );
            }
        }
    }

    /**
     * Setup event listener for reset position command from tray menu
     * Resets widget to top-left corner with padding
     */
    async function setupResetPositionListener(): Promise<UnlistenFn | null> {
        if (!eventApi || !windowApi) return null;

        try {
            const unlisten = await eventApi.listen(
                "reset-widget-position",
                async () => {
                    try {
                        const currentWindow = windowApi!.getCurrentWindow();
                        const monitors = await windowApi!.availableMonitors();

                        if (monitors && monitors.length > 0) {
                            const topLeftPos = getTopLeftPosition(monitors[0]);
                            await currentWindow.setPosition(
                                new windowApi!.LogicalPosition(
                                    topLeftPos.x,
                                    topLeftPos.y,
                                ),
                            );
                            savePosition(topLeftPos.x, topLeftPos.y);
                        }
                    } catch (err) {
                        if (import.meta.env.DEV) {
                            console.error(
                                "[FloatingWidget] Failed to reset position:",
                                err,
                            );
                        }
                    }
                },
            );
            return unlisten;
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error(
                    "[FloatingWidget] Failed to setup reset listener:",
                    err,
                );
            }
            return null;
        }
    }

    async function setupToggleExpansionModeListener(): Promise<UnlistenFn | null> {
        if (!eventApi) return null;

        try {
            const unlisten = await eventApi.listen(
                "toggle-expansion-mode",
                toggleExpansionMode,
            );
            return unlisten;
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error(
                    "[FloatingWidget] Failed to setup expansion mode listener:",
                    err,
                );
            }
            return null;
        }
    }

    /**
     * Setup all Tauri event listeners for system status updates
     * @returns Array of cleanup functions
     */
    async function setupTauriEventListeners(): Promise<UnlistenFn[]> {
        if (!eventApi) return [];

        const cleanupFuncs: UnlistenFn[] = [];

        try {
            const unlistenHealth = await eventApi.listen<{
                connected: boolean;
                checking: boolean;
                error: string | null;
            }>("health-status-update", (event) => {
                systemStatus = {
                    ...systemStatus,
                    isBackendDown: !event.payload.connected,
                    backendError: event.payload.error,
                };
            });

            const unlistenNetwork = await eventApi.listen<{
                isOnline: boolean;
                isOffline: boolean;
            }>("network-status-update", (event) => {
                systemStatus = {
                    ...systemStatus,
                    isOffline: event.payload.isOffline,
                };
            });

            const unlistenRealtime = await eventApi.listen<{
                status: string;
                connected: boolean;
                error: string | null;
            }>("realtime-status-update", (event) => {
                systemStatus = {
                    ...systemStatus,
                    realtimeStatus: event.payload.status as any,
                    realtimeConnected: event.payload.connected,
                    realtimeError: event.payload.error,
                };
            });

            const unlistenApiLoading = await eventApi.listen<{
                isLoading: boolean;
                activeCount: number;
            }>("api-loading-update", (event) => {
                systemStatus = {
                    ...systemStatus,
                    isApiLoading: event.payload.isLoading,
                };
            });

            const unlistenNotification =
                await eventApi.listen<IslandNotification>(
                    "island-notification",
                    (event) => {
                        currentNotification = event.payload;

                        if (
                            event.payload.duration &&
                            event.payload.duration > 0
                        ) {
                            setTimeout(() => {
                                currentNotification = null;
                            }, event.payload.duration);
                        }
                    },
                );

            const unlistenMusic = await eventApi.listen<MusicState>(
                "music-playback-update",
                (event) => {
                    musicState = event.payload;
                },
            );

            cleanupFuncs.push(
                unlistenHealth,
                unlistenNetwork,
                unlistenRealtime,
                unlistenApiLoading,
                unlistenNotification,
                unlistenMusic,
            );
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error(
                    "[FloatingWidget] Failed to setup Tauri listeners:",
                    err,
                );
            }
        }

        return cleanupFuncs;
    }

    // ============================================================================
    // REACTIVE EFFECTS
    // ============================================================================

    /**
     * Reactive effect: Resize window when notification state changes
     * Handles both edge and center expansion modes with smooth animations
     */
    $effect(() => {
        let targetWidth: number;
        if (currentNotification || isExpanded) {
            targetWidth = WIDGET_DIMENSIONS.EXPANDED_WIDTH;
        } else if (musicState.track) {
            targetWidth = 180;
        } else {
            targetWidth = WIDGET_DIMENSIONS.COMPACT_WIDTH;
        }

        const previousWidth = currentWidthState;

        // Skip if width hasn't changed
        if (
            previousWidth === targetWidth ||
            !browser ||
            !windowApi ||
            !dpiApi
        ) {
            return;
        }

        (async () => {
            try {
                const currentWindow = windowApi!.getCurrentWindow();
                const currentPos = await currentWindow.outerPosition();
                const scaleFactor = await currentWindow.scaleFactor();

                const currentLogicalX = Math.round(currentPos.x / scaleFactor);
                const currentLogicalY = Math.round(currentPos.y / scaleFactor);

                // Calculate position adjustment for center mode
                let targetX = currentLogicalX;
                if (expansionMode === "center") {
                    const widthDelta = targetWidth - previousWidth;
                    const positionAdjustment = -widthDelta / 2;
                    targetX = currentLogicalX + positionAdjustment;
                }

                // Animate the resize smoothly
                await animateWindowResize(
                    currentWindow,
                    previousWidth,
                    targetWidth,
                    currentLogicalX,
                    targetX,
                    currentLogicalY,
                );

                // Update width state after successful animation
                currentWidthState = targetWidth;
            } catch (err) {
                if (import.meta.env.DEV) {
                    console.error(
                        "[FloatingWidget] Failed to resize window:",
                        err,
                    );
                }
            }
        })();
    });

    // ============================================================================
    // LIFECYCLE
    // ============================================================================

    onMount(() => {
        if (!browser) return;

        // Load expansion mode preference from localStorage
        expansionMode = loadExpansionMode();

        const cleanupFuncs: UnlistenFn[] = [];

        // Initialize async operations
        (async () => {
            // Load Tauri APIs
            try {
                [windowApi, dpiApi, eventApi] = await Promise.all([
                    import("@tauri-apps/api/window"),
                    import("@tauri-apps/api/dpi"),
                    import("@tauri-apps/api/event"),
                ]);
            } catch (err) {
                console.error(
                    "[FloatingWidget] Failed to load Tauri APIs:",
                    err,
                );
                return;
            }

            updateTime();
            timeInterval = setInterval(updateTime, 1000);

            // IMPORTANT: Restore position BEFORE showing notification
            // This prevents the resize animation from running at the wrong position
            const positionUnlisten = await restorePosition();
            if (positionUnlisten) cleanupFuncs.push(positionUnlisten);

            // Show initialization notification after position is restored
            // 1. Show locally in FloatingWidget
            currentNotification = {
                id: "init",
                message: "Initialized successfully",
                variant: "success",
                duration: 3000,
                backgroundColor: getNotificationBgRgb("success"),
                textColor: getNotificationTextRgb("success"),
            };

            // 2. Broadcast to main window (for StatusIndicator)
            if (eventApi) {
                try {
                    await eventApi.emit("broadcast-notification", {
                        message: "Initialized successfully",
                        variant: "success",
                        duration: 3000,
                    });
                    
                    if (import.meta.env.DEV) {
                        console.log("[FloatingWidget] Broadcast notification emitted");
                    }
                } catch (err) {
                    if (import.meta.env.DEV) {
                        console.error(
                            "[FloatingWidget] Failed to broadcast init notification:",
                            err,
                        );
                    }
                }
            }

            // 3. Auto-dismiss after duration
            setTimeout(() => {
                if (currentNotification?.id === "init") {
                    currentNotification = null;
                }
            }, 3000);

            const resetUnlisten = await setupResetPositionListener();
            if (resetUnlisten) cleanupFuncs.push(resetUnlisten);

            const expansionUnlisten = await setupToggleExpansionModeListener();
            if (expansionUnlisten) cleanupFuncs.push(expansionUnlisten);

            const eventListeners = await setupTauriEventListeners();
            cleanupFuncs.push(...eventListeners);
        })();

        return () => {
            if (timeInterval) clearInterval(timeInterval);
            cleanupFuncs.forEach((fn) => fn());
        };
    });

    onDestroy(() => {
        if (timeInterval) clearInterval(timeInterval);
    });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
    class="status-island"
    style="
        background-color: {getIslandColor()};
        color: {getTextColor()};
    "
    onmousedown={handleDragStart}
    ondblclick={handleDoubleClick}
    role="status"
    aria-live="polite"
>
    <!-- Status Icon (left side) -->
    <div class="icon-container">
        {#if getStatusIcon()}
            {@const IconComponent = getStatusIcon()}
            {#if IconComponent}
                <IconComponent class="status-icon" size={16} />
            {/if}
        {/if}
    </div>

    <div class="content">
        {#if currentNotification}
            <div
                class="notification-message"
                transition:blur={{ duration: 200 }}
            >
                {currentNotification.message}
            </div>
        {:else if musicState.track && isExpanded}
            <div class="music-expanded" transition:blur={{ duration: 200 }}>
                <div class="music-info">
                    <span class="music-title">{musicState.track.title}</span>
                    <span class="music-artist">{musicState.track.artist}</span>
                </div>
                <div class="music-controls">
                    <button class="music-btn" onclick={() => emitMusicCommand('previous')}>
                        <SkipBack size={12} />
                    </button>
                    <button class="music-btn" onclick={() => emitMusicCommand('toggle')}>
                        {#if musicState.isPlaying}
                            <Pause size={14} />
                        {:else}
                            <Play size={14} />
                        {/if}
                    </button>
                    <button class="music-btn" onclick={() => emitMusicCommand('next')}>
                        <SkipForward size={12} />
                    </button>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {musicState.progress}%"></div>
            </div>
        {:else if musicState.track}
            <div 
                class="music-compact" 
                transition:blur={{ duration: 200 }}
                onclick={() => isExpanded = !isExpanded}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && (isExpanded = !isExpanded)}
            >
                <Music size={14} class={musicState.isPlaying ? 'animate-pulse' : ''} />
                <span class="music-title">{musicState.track.title}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {musicState.progress}%"></div>
            </div>
        {:else if currentTime}
            <div class="time-display" transition:blur={{ duration: 200 }}>
                {currentTime}
            </div>
        {:else}
            <div class="time-display">Loading...</div>
        {/if}
    </div>

    <!-- Loading shimmer effect when API is loading and no notification -->
    {#if systemStatus.isApiLoading && !currentNotification}
        <div
            class="shimmer"
        ></div>
    {/if}
</div>

<style>
    .status-island {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 40px;
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 12px;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        transition:
            background-color 0.3s ease,
            width 0.3s ease;
        overflow: visible;
        isolation: isolate;
        box-sizing: border-box;
    }

    .status-island:active {
        cursor: grabbing;
    }

    .icon-container {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .icon-container :global(.status-icon) {
        color: currentColor;
        transition: transform 0.2s ease;
        pointer-events: none;
    }

    .icon-container :global(.status-icon.animate) {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.5;
        }
    }

    .content {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
    }

    .time-display {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: -0.025em;
        white-space: nowrap;
        pointer-events: none;
    }

    .notification-message {
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: none;
    }

    /* Loading shimmer animation */
    .shimmer {
        position: absolute;
        inset: 0;
        background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.1) 50%,
            transparent 100%
        );
        background-size: 200% 100%;
        animation: shimmer 2s infinite linear;
        border-radius: inherit;
        pointer-events: none;
    }

    @keyframes shimmer {
        0% {
            background-position: -200% 0;
        }
        100% {
            background-position: 200% 0;
        }
    }

    .music-compact {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
    }

    .music-compact .music-title {
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
    }

    .music-expanded {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
    }

    .music-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        text-align: left;
    }

    .music-info .music-title {
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .music-info .music-artist {
        font-size: 10px;
        opacity: 0.7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .music-controls {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .music-btn {
        padding: 4px;
        border-radius: 4px;
        background: transparent;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: currentColor;
        transition: background-color 0.2s;
    }

    .music-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .progress-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: rgba(255, 255, 255, 0.2);
    }

    .progress-fill {
        height: 100%;
        background: rgba(255, 255, 255, 0.6);
        transition: width 0.1s linear;
    }

    :global(.animate-pulse) {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
</style>

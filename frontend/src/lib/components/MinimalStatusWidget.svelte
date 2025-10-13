<script lang="ts">
    /**
     * MINIMAL STATUS WIDGET - Zero dependencies on app services
     * This is a completely isolated component that only:
     * - Listens to Tauri events
     * - Displays time and status
     * - Shows notifications
     * NO services, NO utilities, NO shared code
     */
    import { onMount, onDestroy } from "svelte";

    // Minimal type definitions (inline, no imports)
    type SystemStatus = {
        isBackendDown: boolean;
        isOffline: boolean;
        realtimeConnected: boolean;
        isApiLoading: boolean;
        backendError: string | null;
    };

    type Notification = {
        message: string;
        variant: "success" | "error" | "info" | "warning" | "loading";
        duration: number;
    };

    // State
    let currentTime = $state("");
    let status = $state<SystemStatus>({
        isBackendDown: false,
        isOffline: false,
        realtimeConnected: false,
        isApiLoading: false,
        backendError: null,
    });
    let notification = $state<Notification | null>(null);
    let showDetails = $state(false);
    let width = $state(120); // Compact width
    let settings = $state({ enabled: true, size: 1.0, opacity: 0.95 });

    // Update time every second
    function updateTime() {
        const now = new Date();
        currentTime = now.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }

    // Get status icon (returns emoji for simplicity - no lucide-svelte dependency)
    function getStatusIcon(): string {
        if (status.isBackendDown) return "🔴";
        if (status.isOffline) return "📡";
        if (!status.realtimeConnected) return "🟡";
        if (status.isApiLoading) return "⏳";
        return "🕐";
    }

    // Get status message
    function getStatusMessage(): string {
        if (status.isBackendDown) return "Backend Offline";
        if (status.isOffline) return "No Internet";
        if (!status.realtimeConnected) return "Connecting...";
        if (status.isApiLoading) return "Loading...";
        return "All Systems OK";
    }

    // Get background color
    function getBackgroundColor(): string {
        if (notification) {
            switch (notification.variant) {
                case "success":
                    return "bg-green-500/90";
                case "error":
                    return "bg-red-500/90";
                case "warning":
                    return "bg-yellow-500/90";
                case "info":
                    return "bg-blue-500/90";
                case "loading":
                    return "bg-gray-500/90";
            }
        }
        if (status.isBackendDown || status.isOffline) return "bg-red-500/90";
        if (!status.realtimeConnected) return "bg-yellow-500/90";
        return "bg-gray-800/90";
    }

    // Animate width changes
    $effect(() => {
        width = notification ? 280 : 120;
    });

    // Setup Tauri event listeners
    onMount(() => {
        updateTime();
        const interval = setInterval(updateTime, 1000);
        const unlistenFns: Array<() => void> = [];

        // Only load Tauri API when needed
        if ((window as any).__TAURI__) {
            (async () => {
                const { listen } = await import("@tauri-apps/api/event");

                // Listen for status updates
                unlistenFns.push(
                    await listen("health-status-update", (event: any) => {
                        status.isBackendDown =
                            event.payload.connected === false;
                        status.backendError = event.payload.error;
                    }),
                );

                unlistenFns.push(
                    await listen("network-status-update", (event: any) => {
                        status.isOffline = event.payload.isOffline;
                    }),
                );

                unlistenFns.push(
                    await listen("realtime-status-update", (event: any) => {
                        status.realtimeConnected = event.payload.connected;
                    }),
                );

                unlistenFns.push(
                    await listen("api-loading-update", (event: any) => {
                        status.isApiLoading = event.payload.isLoading;
                    }),
                );

                unlistenFns.push(
                    await listen("island-notification", (event: any) => {
                        const payload = event.payload as any;
                        notification = {
                            message: payload.message,
                            variant: payload.variant,
                            duration: payload.duration || 3000,
                        };

                        // Auto-dismiss
                        setTimeout(() => {
                            notification = null;
                        }, payload.duration || 3000);
                    }),
                );

                unlistenFns.push(
                    await listen("indicator-settings-update", (event: any) => {
                        settings = event.payload.settings;
                    }),
                );
            })();
        }

        return () => {
            clearInterval(interval);
            unlistenFns.forEach((fn) => fn());
        };
    });

    onDestroy(() => {
        // Cleanup handled in onMount return
    });
</script>

{#if settings.enabled}
    <div
        class="fixed inset-0 flex items-center justify-center"
        style="opacity: {settings.opacity}; transform: scale({settings.size});"
    >
        <div
            class="widget-container {getBackgroundColor()}"
            style="width: {width}px; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);"
            role="button"
            tabindex="0"
            onclick={() => (showDetails = !showDetails)}
            onkeydown={(e) => e.key === "Enter" && (showDetails = !showDetails)}
        >
            {#if notification}
                <!-- Notification -->
                <div class="widget-content">
                    <span class="text-lg">
                        {notification.variant === "loading" ? "⏳" : ""}
                        {notification.variant === "success" ? "✅" : ""}
                        {notification.variant === "error" ? "❌" : ""}
                        {notification.variant === "warning" ? "⚠️" : ""}
                        {notification.variant === "info" ? "ℹ️" : ""}
                    </span>
                    <span class="text-sm font-medium truncate text-white">
                        {notification.message}
                    </span>
                </div>
            {:else}
                <!-- Status + Time -->
                <div class="widget-content">
                    <span class="text-sm">{getStatusIcon()}</span>
                    <span
                        class="text-xs font-semibold text-white tracking-tight"
                    >
                        {currentTime}
                    </span>
                </div>
            {/if}

            <!-- Loading shimmer -->
            {#if status.isApiLoading && !notification}
                <div class="shimmer"></div>
            {/if}
        </div>

        <!-- Details popup -->
        {#if showDetails}
            <div class="details-popup">
                <h3 class="text-sm font-semibold text-white mb-2">
                    System Status
                </h3>
                <div class="space-y-2 text-xs">
                    <div class="flex justify-between">
                        <span class="text-gray-400">Backend:</span>
                        <span
                            class={status.isBackendDown
                                ? "text-red-400"
                                : "text-green-400"}
                        >
                            {status.isBackendDown ? "Offline" : "Online"}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">Network:</span>
                        <span
                            class={status.isOffline
                                ? "text-red-400"
                                : "text-green-400"}
                        >
                            {status.isOffline ? "Offline" : "Online"}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">Realtime:</span>
                        <span
                            class={status.realtimeConnected
                                ? "text-green-400"
                                : "text-yellow-400"}
                        >
                            {status.realtimeConnected
                                ? "Connected"
                                : "Disconnected"}
                        </span>
                    </div>
                    {#if status.backendError}
                        <div class="mt-2 pt-2 border-t border-gray-700">
                            <p class="text-red-400 text-xs">
                                {status.backendError}
                            </p>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    /* All styles inline - no external CSS dependencies */
    .widget-container {
        position: relative;
        height: 40px;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(24px);
        cursor: pointer;
    }

    .widget-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        height: 100%;
        padding: 0 0.75rem;
    }

    .shimmer {
        position: absolute;
        inset: 0;
        background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.1),
            transparent
        );
        background-size: 200% 100%;
        animation: shimmer 2s infinite linear;
    }

    @keyframes shimmer {
        0% {
            background-position: -200% 0;
        }
        100% {
            background-position: 200% 0;
        }
    }

    .details-popup {
        position: absolute;
        top: calc(100% + 0.5rem);
        left: 50%;
        transform: translateX(-50%) scale(0.9);
        background: rgba(17, 24, 39, 0.95);
        backdrop-filter: blur(24px);
        border-radius: 0.5rem;
        padding: 1rem;
        min-width: 250px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        z-index: 50;
        animation: popup 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    @keyframes popup {
        to {
            transform: translateX(-50%) scale(1);
        }
    }

    /* Tailwind-like utilities (minimal inline) */
    :global(.bg-green-500\/90) {
        background-color: rgba(34, 197, 94, 0.9);
    }
    :global(.bg-red-500\/90) {
        background-color: rgba(239, 68, 68, 0.9);
    }
    :global(.bg-yellow-500\/90) {
        background-color: rgba(234, 179, 8, 0.9);
    }
    :global(.bg-blue-500\/90) {
        background-color: rgba(59, 130, 246, 0.9);
    }
    :global(.bg-gray-500\/90) {
        background-color: rgba(107, 114, 128, 0.9);
    }
    :global(.bg-gray-800\/90) {
        background-color: rgba(31, 41, 55, 0.9);
    }

    :global(.text-white) {
        color: white;
    }
    :global(.text-gray-400) {
        color: rgb(156, 163, 175);
    }
    :global(.text-green-400) {
        color: rgb(74, 222, 128);
    }
    :global(.text-red-400) {
        color: rgb(248, 113, 113);
    }
    :global(.text-yellow-400) {
        color: rgb(250, 204, 21);
    }

    :global(.space-y-2 > * + *) {
        margin-top: 0.5rem;
    }
    :global(.border-t) {
        border-top-width: 1px;
    }
    :global(.border-gray-700) {
        border-color: rgb(55, 65, 81);
    }
</style>

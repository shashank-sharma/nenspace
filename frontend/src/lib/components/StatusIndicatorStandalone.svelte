<script lang="ts">
    /**
     * Standalone Status Indicator for Floating Tauri Window
     * This component fills the entire small window - no positioning needed
     */
    import { onMount, onDestroy } from "svelte";
    import { blur, scale } from "svelte/transition";
    import { spring } from "svelte/motion";
    import { Clock, Loader2, AlertCircle } from "lucide-svelte";
    import { listen, type UnlistenFn } from "@tauri-apps/api/event";
    import {
        STATUS_INDICATOR_CONFIG,
        getStatusIndicatorState,
        shouldIconAnimate,
        type SystemStatus,
    } from "$lib/features/status-indicator";

    // State from Tauri events
    let systemStatus = $state<SystemStatus>({
        isBackendDown: false,
        isOffline: false,
        realtimeStatus: "disconnected",
        isApiLoading: false,
        realtimeConnected: false,
        backendError: null,
        realtimeError: null,
    });

    let currentNotification = $state<{
        message: string;
        variant: "success" | "error" | "info" | "warning" | "loading";
        backgroundColor?: string;
        textColor?: string;
        icon?: any;
    } | null>(null);

    // Settings from main window
    let settings = $state({
        enabled: true,
        size: 1.0,
        opacity: 0.95,
    });

    // Derived state
    let statusState = $derived(getStatusIndicatorState(systemStatus));

    // Current time
    let currentTime = $state("");
    let timeInterval: NodeJS.Timeout | null = null;

    // Show detailed popup
    let showDetails = $state(false);

    // Animation springs
    let width = spring<number>(
        STATUS_INDICATOR_CONFIG.DIMENSIONS.COMPACT_WIDTH,
        {
            stiffness: STATUS_INDICATOR_CONFIG.ANIMATION.SPRING_STIFFNESS,
            damping: STATUS_INDICATOR_CONFIG.ANIMATION.SPRING_DAMPING,
        },
    );

    // Update time
    function updateTime() {
        const now = new Date();
        currentTime = now.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }

    // Get island background color
    function getIslandColor(): string {
        if (currentNotification) {
            return (
                currentNotification.backgroundColor ||
                getVariantBg(currentNotification.variant)
            );
        }
        return statusState.backgroundColor;
    }

    function getVariantBg(variant: string): string {
        switch (variant) {
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
            default:
                return "bg-gray-800/90";
        }
    }

    // Handle click - show detailed popup
    function handleStatusClick() {
        showDetails = !showDetails;
    }

    // Update width based on notification
    $effect(() => {
        if (currentNotification) {
            width.set(STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH);
        } else {
            width.set(STATUS_INDICATOR_CONFIG.DIMENSIONS.COMPACT_WIDTH);
        }
    });

    // Setup Tauri event listeners and time interval
    onMount(() => {
        updateTime();
        timeInterval = setInterval(updateTime, 1000);

        // Listen for status updates from main window
        const unlisteners: UnlistenFn[] = [];

        // Setup all event listeners
        (async () => {
            unlisteners.push(
                await listen("health-status-update", (event: any) => {
                    systemStatus = {
                        ...systemStatus,
                        isBackendDown: event.payload.connected === false,
                        backendError: event.payload.error,
                    };
                }),
            );

            unlisteners.push(
                await listen("network-status-update", (event: any) => {
                    systemStatus = {
                        ...systemStatus,
                        isOffline: event.payload.isOffline,
                    };
                }),
            );

            unlisteners.push(
                await listen("realtime-status-update", (event: any) => {
                    systemStatus = {
                        ...systemStatus,
                        realtimeStatus: event.payload.status,
                        realtimeConnected: event.payload.connected,
                        realtimeError: event.payload.error,
                    };
                }),
            );

            unlisteners.push(
                await listen("api-loading-update", (event: any) => {
                    systemStatus = {
                        ...systemStatus,
                        isApiLoading: event.payload.isLoading,
                    };
                }),
            );

            unlisteners.push(
                await listen("island-notification", (event: any) => {
                    const payload = event.payload as any;
                    currentNotification = {
                        message: payload.message,
                        variant: payload.variant,
                        backgroundColor: payload.backgroundColor,
                        textColor: payload.textColor,
                        icon: getIconForVariant(payload.variant),
                    };

                    // Auto-dismiss after duration
                    setTimeout(() => {
                        currentNotification = null;
                    }, payload.duration || 3000);
                }),
            );

            unlisteners.push(
                await listen("indicator-settings-update", (event: any) => {
                    settings = event.payload.settings;
                }),
            );
        })();

        return () => {
            unlisteners.forEach((fn) => fn());
            if (timeInterval) clearInterval(timeInterval);
        };
    });

    onDestroy(() => {
        if (timeInterval) clearInterval(timeInterval);
    });

    function getIconForVariant(variant: string) {
        switch (variant) {
            case "error":
                return AlertCircle;
            case "loading":
                return Loader2;
            default:
                return null;
        }
    }
</script>

{#if settings.enabled}
    <!-- Centered container that fills the window -->
    <div
        class="fixed inset-0 flex items-center justify-center"
        style="opacity: {settings.opacity}; transform: scale({settings.size});"
    >
        <div
            class="relative overflow-hidden shadow-2xl backdrop-blur-xl transition-colors duration-300 {getIslandColor()} cursor-pointer"
            style="width: {$width}px; height: {STATUS_INDICATOR_CONFIG
                .DIMENSIONS.HEIGHT}px; border-radius: 20px;"
            role="button"
            tabindex="0"
            aria-label="Status Indicator - {statusState.message}"
            onclick={handleStatusClick}
            onkeydown={(e) => e.key === "Enter" && handleStatusClick()}
        >
            {#if currentNotification}
                <!-- Notification State -->
                {@const IconComponent = currentNotification.icon}
                {@const isLoading = currentNotification.variant === "loading"}

                <div
                    class="px-4 flex items-center gap-3 h-full"
                    in:scale={{ duration: 300, start: 0.9 }}
                    out:scale={{ duration: 200, start: 0.9 }}
                >
                    <!-- Icon -->
                    {#if IconComponent}
                        <div class="flex-shrink-0 text-white">
                            <IconComponent
                                size={18}
                                class={isLoading ? "animate-spin" : ""}
                            />
                        </div>
                    {/if}

                    <!-- Message -->
                    {#key currentNotification.message}
                        <div
                            class="text-sm font-medium truncate text-white"
                            in:blur={{ amount: 3, duration: 200 }}
                            out:blur={{ amount: 3, duration: 150 }}
                        >
                            {currentNotification.message}
                        </div>
                    {/key}
                </div>
            {:else}
                <!-- Default State: Time + Status -->
                {@const StatusIcon = statusState.icon}
                <div
                    class="px-3 flex items-center justify-center gap-2 h-full"
                    in:scale={{ duration: 300, start: 1.1 }}
                >
                    <!-- Status Icon -->
                    {#if StatusIcon}
                        <div class="{statusState.iconColor} flex-shrink-0">
                            <StatusIcon
                                size={14}
                                class={shouldIconAnimate(systemStatus)
                                    ? "animate-spin"
                                    : ""}
                            />
                        </div>
                    {:else}
                        <div class="text-gray-400 flex-shrink-0">
                            <Clock size={14} />
                        </div>
                    {/if}

                    <!-- Time -->
                    <div
                        class="text-xs font-semibold text-white tracking-tight"
                    >
                        {currentTime}
                    </div>
                </div>
            {/if}

            <!-- Loading shimmer effect -->
            {#if systemStatus.isApiLoading && !currentNotification}
                <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
                    style="background-size: 200% 100%;"
                ></div>
            {/if}
        </div>

        <!-- Detailed Status Popup -->
        {#if showDetails}
            <div
                class="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-gray-900/95 backdrop-blur-xl rounded-lg p-4 min-w-[250px] shadow-2xl z-50"
                transition:scale={{ duration: 200 }}
            >
                <h3 class="text-sm font-semibold text-white mb-2">
                    System Status
                </h3>
                <div class="space-y-2 text-xs">
                    <div class="flex justify-between">
                        <span class="text-gray-400">Backend:</span>
                        <span
                            class={systemStatus.isBackendDown
                                ? "text-red-400"
                                : "text-green-400"}
                        >
                            {systemStatus.isBackendDown ? "Offline" : "Online"}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">Network:</span>
                        <span
                            class={systemStatus.isOffline
                                ? "text-red-400"
                                : "text-green-400"}
                        >
                            {systemStatus.isOffline ? "Offline" : "Online"}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">Realtime:</span>
                        <span
                            class={systemStatus.realtimeConnected
                                ? "text-green-400"
                                : "text-yellow-400"}
                        >
                            {systemStatus.realtimeConnected
                                ? "Connected"
                                : "Disconnected"}
                        </span>
                    </div>
                    {#if systemStatus.backendError}
                        <div class="mt-2 pt-2 border-t border-gray-700">
                            <p class="text-red-400 text-xs">
                                {systemStatus.backendError}
                            </p>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    @keyframes shimmer {
        0% {
            background-position: -200% 0;
        }
        100% {
            background-position: 200% 0;
        }
    }

    :global(.animate-shimmer) {
        animation: shimmer 2s infinite linear;
    }
</style>

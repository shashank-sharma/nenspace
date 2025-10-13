<script lang="ts">
    /**
     * Dynamic Island Status Indicator
     *
     * iPhone-inspired Dynamic Island notification system.
     * Shows time by default, expands for notifications, then rolls back.
     *
     * Features:
     * - Always visible island at top center
     * - Shows current time in compact state
     * - Expands smoothly for notifications
     * - Status indicators (offline, connecting, backend status)
     * - Smooth spring-based animations
     * - Draggable with position persistence
     * - Click to see detailed status
     */
    import { blur, scale } from "svelte/transition";
    import { spring } from "svelte/motion";
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import { IslandNotificationService } from "$lib/services/island-notification.service.svelte";
    import { NetworkService } from "$lib/services/network.service.svelte";
    import { ApiLoadingService } from "$lib/services/api-loading.service.svelte";
    import { RealtimeService } from "$lib/services/realtime.service.svelte";
    import { HealthService } from "$lib/services/health.service.svelte";
    import { Clock } from "lucide-svelte";
    import {
        STATUS_INDICATOR_CONFIG,
        getStatusIndicatorState,
        shouldIconAnimate,
        type SystemStatus,
    } from "$lib/utils/status-indicator.util";
    import {
        loadPosition,
        savePosition,
        validatePosition,
        type Position,
    } from "$lib/utils/draggable.util";

    // Reactive state from services
    let currentNotification = $derived(IslandNotificationService.current);
    let backendStatus = $derived(HealthService.status);

    // Compute system status
    let systemStatus = $derived<SystemStatus>({
        isBackendDown: backendStatus.connected === false,
        isOffline: NetworkService.isOffline,
        realtimeStatus: RealtimeService.connectionStatus,
        isApiLoading: ApiLoadingService.isLoading,
        realtimeConnected: RealtimeService.isConnected,
        backendError: backendStatus.error,
        realtimeError: RealtimeService.connectionError,
    });

    // Get status indicator state
    let statusState = $derived(getStatusIndicatorState(systemStatus));

    // Current time
    let currentTime = $state("");
    let timeInterval: NodeJS.Timeout | null = null;

    // Dragging state
    let position = $state<Position>({ x: 0, y: 0 });
    let dragging = $state(false);
    let dragCleanup: (() => void) | null = null;

    // Animation springs for smooth iPhone-like transitions
    let width = spring<number>(
        STATUS_INDICATOR_CONFIG.DIMENSIONS.COMPACT_WIDTH,
        {
            stiffness: STATUS_INDICATOR_CONFIG.ANIMATION.SPRING_STIFFNESS,
            damping: STATUS_INDICATOR_CONFIG.ANIMATION.SPRING_DAMPING,
        },
    );

    // Update time
    function updateTime() {
        if (!browser) return;
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
                IslandNotificationService.getVariantColors(
                    currentNotification.variant,
                ).bg
            );
        }
        return statusState.backgroundColor;
    }

    // Handle click to show status details
    function handleStatusClick() {
        if (systemStatus.isBackendDown) {
            IslandNotificationService.error(statusState.message, {
                duration: STATUS_INDICATOR_CONFIG.NOTIFICATION_DURATION,
            });
        } else if (systemStatus.isOffline) {
            IslandNotificationService.error(statusState.message, {
                duration: STATUS_INDICATOR_CONFIG.NOTIFICATION_DURATION,
            });
        } else if (systemStatus.realtimeStatus === "error") {
            IslandNotificationService.warning(statusState.message, {
                duration: STATUS_INDICATOR_CONFIG.NOTIFICATION_DURATION,
            });
        }
    }

    // Drag handlers
    function handleMouseDown(event: MouseEvent) {
        event.preventDefault();
        startDragging(event.clientX, event.clientY);
    }

    function handleTouchStart(event: TouchEvent) {
        event.preventDefault();
        startDragging(event.touches[0].clientX, event.touches[0].clientY);
    }

    function startDragging(startX: number, startY: number) {
        dragCleanup?.();

        dragging = true;
        const startPosX = position.x;
        const startPosY = position.y;
        let hasMoved = false;

        const handleDragMove = (e: MouseEvent | TouchEvent) => {
            if (!dragging) return;

            const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
            const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

            const deltaX = Math.abs(clientX - startX);
            const deltaY = Math.abs(clientY - startY);

            if (
                deltaX > STATUS_INDICATOR_CONFIG.DRAG.THRESHOLD ||
                deltaY > STATUS_INDICATOR_CONFIG.DRAG.THRESHOLD
            ) {
                hasMoved = true;
            }

            const newX = startPosX + (clientX - startX);
            const newY = startPosY + (clientY - startY);

            position = validatePosition(
                { x: newX, y: newY },
                {
                    width: STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH,
                    height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT,
                },
            );
        };

        const stopDragging = () => {
            dragging = false;
            document.removeEventListener("mousemove", handleDragMove);
            document.removeEventListener("touchmove", handleDragMove);
            document.removeEventListener("mouseup", stopDragging);
            document.removeEventListener("touchend", stopDragging);

            if (!hasMoved) {
                handleStatusClick();
            } else {
                savePosition(STATUS_INDICATOR_CONFIG.STORAGE_KEY, position);
            }

            dragCleanup = null;
        };

        document.addEventListener("mousemove", handleDragMove);
        document.addEventListener("touchmove", handleDragMove);
        document.addEventListener("mouseup", stopDragging);
        document.addEventListener("touchend", stopDragging);

        dragCleanup = stopDragging;
    }

    // Update width based on notification (height stays constant)
    $effect(() => {
        if (currentNotification) {
            width.set(STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH);
        } else {
            width.set(STATUS_INDICATOR_CONFIG.DIMENSIONS.COMPACT_WIDTH);
        }
    });

    // Load position from localStorage
    $effect(() => {
        if (!browser) return;

        const defaultPosition: Position = {
            x:
                window.innerWidth / 2 -
                STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH / 2,
            y: STATUS_INDICATOR_CONFIG.DIMENSIONS.MARGIN_TOP,
        };

        position = loadPosition(
            STATUS_INDICATOR_CONFIG.STORAGE_KEY,
            {
                width: STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH,
                height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT,
            },
            defaultPosition,
        );
    });

    // Handle window resize to revalidate position
    $effect(() => {
        if (!browser) return;

        const elementSize = {
            width: STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH,
            height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT,
        };

        const handleResize = () => {
            position = validatePosition(position, elementSize);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    });

    // Initialize time and interval
    onMount(() => {
        if (!browser) return;

        updateTime();
        timeInterval = setInterval(updateTime, 1000);

        return () => {
            if (timeInterval) clearInterval(timeInterval);
        };
    });

    // Cleanup
    onDestroy(() => {
        if (timeInterval) clearInterval(timeInterval);
        dragCleanup?.();
    });
</script>

<div
    class="fixed transition-all duration-300 ease-out {dragging
        ? 'cursor-grabbing'
        : 'cursor-grab'}"
    style="z-index: 99999; left: {position.x}px; top: {position.y}px;"
    role="button"
    tabindex="0"
    aria-label="Dynamic Island - {statusState.message}"
    title={statusState.message}
    aria-live="polite"
    onmousedown={handleMouseDown}
    ontouchstart={handleTouchStart}
>
    <div
        class="relative overflow-hidden shadow-2xl backdrop-blur-xl transition-colors duration-300 {getIslandColor()}"
        style="width: {$width}px; height: {STATUS_INDICATOR_CONFIG.DIMENSIONS
            .HEIGHT}px; border-radius: 20px;"
    >
        {#if currentNotification}
            <!-- Notification State -->
            {@const colors = IslandNotificationService.getVariantColors(
                currentNotification.variant,
            )}
            {@const IconComponent = currentNotification.icon}
            {@const isLoading = currentNotification.variant === "loading"}

            <div
                class="px-4 flex items-center gap-3 h-full"
                in:scale={{ duration: 300, start: 0.9 }}
                out:scale={{ duration: 200, start: 0.9 }}
            >
                <!-- Icon -->
                <div class="flex-shrink-0 {colors.iconColor}">
                    {#if IconComponent}
                        <IconComponent
                            size={18}
                            class={isLoading ? "animate-spin" : ""}
                        />
                    {/if}
                </div>

                <!-- Message -->
                {#key currentNotification.message}
                    <div
                        class="text-sm font-medium truncate {currentNotification.textColor ||
                            colors.text}"
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
                <div class="text-xs font-semibold text-white tracking-tight">
                    {currentTime}
                </div>
            </div>
        {/if}

        <!-- Loading shimmer effect when API is loading and no notification -->
        {#if systemStatus.isApiLoading && !currentNotification}
            <div
                class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
                style="background-size: 200% 100%;"
            ></div>
        {/if}
    </div>
</div>

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

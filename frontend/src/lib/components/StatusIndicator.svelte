<script lang="ts">
    import { blur, scale } from "svelte/transition";
    import { spring } from "svelte/motion";
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import {
        IslandNotificationService,
        STATUS_INDICATOR_CONFIG,
        getStatusIndicatorState,
        shouldIconAnimate,
        type SystemStatus,
    } from "$lib/features/status-indicator";
    import { NetworkService } from "$lib/services/network.service.svelte";
    import { ApiLoadingService } from "$lib/services/api-loading.service.svelte";
    import { RealtimeService } from "$lib/services/realtime.service.svelte";
    import { HealthService } from "$lib/services/health.service.svelte";
    import { MusicPlayerService, MusicService } from "$lib/features/music";
    import { Clock, Music, Play, Pause, SkipBack, SkipForward } from "lucide-svelte";
    import {
        loadPosition,
        savePosition,
        validatePosition,
        type Position,
    } from "$lib/utils/draggable.util";

    let currentNotification = $derived(IslandNotificationService.current);
    let backendStatus = $derived(HealthService.status);
    
    let musicTrack = $derived(MusicPlayerService.currentTrack);
    let musicPlaying = $derived(MusicPlayerService.isPlaying);
    let musicProgress = $derived(MusicPlayerService.progress);
    let isExpanded = $state(false);

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

    // Debug: log API loading changes
    // $effect(() => {
    //     console.log(
    //         '[StatusIndicator] isApiLoading:',
    //         systemStatus.isApiLoading,
    //         '| activeCount:', ApiLoadingService.activeCount,
    //         '| activeRequestIds:', ApiLoadingService.activeRequestIds,
    //         '| direct isLoading:', ApiLoadingService.isLoading,
    //     );
    // });

    // // Debug: log when systemStatus changes
    // $effect(() => {
    //     console.log('[StatusIndicator] systemStatus changed:', {
    //         isApiLoading: systemStatus.isApiLoading,
    //         isBackendDown: systemStatus.isBackendDown,
    //         isOffline: systemStatus.isOffline,
    //         realtimeStatus: systemStatus.realtimeStatus,
    //     });
    // });

    // // Debug: log shimmer condition
    // $effect(() => {
    //     const shouldShowShimmer = systemStatus.isApiLoading && !currentNotification;
    //     console.log('[StatusIndicator] Shimmer condition:', {
    //         shouldShowShimmer,
    //         isApiLoading: systemStatus.isApiLoading,
    //         hasNotification: !!currentNotification,
    //     });
    // });

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

    $effect(() => {
        if (currentNotification || isExpanded) {
            width.set(STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH);
        } else if (musicTrack && !isExpanded) {
            width.set(180);
        } else {
            width.set(STATUS_INDICATOR_CONFIG.DIMENSIONS.COMPACT_WIDTH);
        }
    });

    function handleMusicClick(e: MouseEvent) {
        e.stopPropagation();
        if (musicTrack) {
            isExpanded = !isExpanded;
        }
    }

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
        {:else if musicTrack && isExpanded}
            <div
                class="px-3 flex items-center gap-2 h-full"
                in:scale={{ duration: 300, start: 0.9 }}
                role="button"
                tabindex="0"
                onclick={handleMusicClick}
                onkeydown={(e) => e.key === 'Enter' && handleMusicClick(e as unknown as MouseEvent)}
            >
                <div class="flex-shrink-0 text-white">
                    <Music size={14} />
                </div>
                <div class="flex-1 min-w-0 text-left">
                    <div class="text-xs font-medium text-white truncate">{musicTrack.title}</div>
                    <div class="text-[10px] text-white/70 truncate">{musicTrack.artist}</div>
                </div>
                <div class="flex items-center gap-1">
                    <button class="p-1 hover:bg-white/10 rounded" onclick={(e) => { e.stopPropagation(); MusicPlayerService.previous(); }}>
                        <SkipBack size={12} class="text-white" />
                    </button>
                    <button class="p-1 hover:bg-white/10 rounded" onclick={(e) => { e.stopPropagation(); MusicPlayerService.togglePlayPause(); }}>
                        {#if musicPlaying}
                            <Pause size={14} class="text-white" />
                        {:else}
                            <Play size={14} class="text-white" />
                        {/if}
                    </button>
                    <button class="p-1 hover:bg-white/10 rounded" onclick={(e) => { e.stopPropagation(); MusicPlayerService.next(); }}>
                        <SkipForward size={12} class="text-white" />
                    </button>
                </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                <div class="h-full bg-white/60 transition-all" style="width: {musicProgress}%"></div>
            </div>
        {:else if musicTrack}
            <div
                class="px-3 flex items-center gap-2 h-full cursor-pointer"
                in:scale={{ duration: 300, start: 1.1 }}
                role="button"
                tabindex="0"
                onclick={handleMusicClick}
                onkeydown={(e) => e.key === 'Enter' && handleMusicClick(e as unknown as MouseEvent)}
            >
                <div class="flex-shrink-0 text-white">
                    {#if musicPlaying}
                        <Music size={14} class="animate-pulse" />
                    {:else}
                        <Music size={14} />
                    {/if}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium text-white truncate">{musicTrack.title}</div>
                </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                <div class="h-full bg-white/60 transition-all" style="width: {musicProgress}%"></div>
            </div>
        {:else}
            {@const StatusIcon = (systemStatus.isApiLoading && !currentNotification) ? Clock : statusState.icon}
            <div
                class="px-3 flex items-center justify-center gap-2 h-full"
                in:scale={{ duration: 300, start: 1.1 }}
            >
                {#if StatusIcon}
                    <div class="{statusState.iconColor} flex-shrink-0">
                        <StatusIcon
                            size={14}
                            class={(shouldIconAnimate(systemStatus) && !(systemStatus.isApiLoading && !currentNotification))
                                ? "animate-spin"
                                : ""}
                        />
                    </div>
                {:else}
                    <div class="text-gray-400 flex-shrink-0">
                        <Clock size={14} />
                    </div>
                {/if}
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

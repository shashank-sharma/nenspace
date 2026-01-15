<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import {
        IslandNotificationService,
        STATUS_INDICATOR_CONFIG,
        type SystemStatus,
        IslandController,
    } from "$lib/features/status-indicator";
    import { NetworkService } from "$lib/services/network.service.svelte";
    import { ApiLoadingService } from "$lib/services/api-loading.service.svelte";
    import { RealtimeService } from "$lib/services/realtime.service.svelte";
    import { HealthService } from "$lib/services/health.service.svelte";
    import { MusicPlayerService } from "$lib/features/music";
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import FloatingIsland from "$lib/features/status-indicator/components/FloatingIsland.svelte";
    import {
        loadPosition,
        savePosition,
        validatePosition,
        type Position,
    } from "$lib/utils/draggable.util";
    import * as Views from "$lib/features/status-indicator/components/views";

    let currentNotification = $derived(IslandNotificationService.current);
    let backendStatus = $derived(HealthService.status);
    let musicTrack = $derived(MusicPlayerService.currentTrack);

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

    // Settings
    let expansionMode = $derived(SettingsService.appearance.statusIndicatorExpansionMode);
    
    // Dragging state
    let position = $state<Position>({ x: 0, y: 0 });
    let dragging = $state(false);
    let dragCleanup: (() => void) | null = null;
    let previousWidth = $state<number>(STATUS_INDICATOR_CONFIG.DIMENSIONS.COMPACT_WIDTH);

    // Handle music view registration
    $effect(() => {
        if (musicTrack) {
            IslandController.register({
                id: 'music',
                priority: 60, // IslandPriority.MUSIC
                dimensions: { width: 180, height: 40 },
                component: Views.MusicView,
                props: {}
            });
            IslandController.show('music');
        } else if (IslandController.activeView?.id === 'music') {
            IslandController.hide('music');
        }
    });

    // Drag handlers
    function handleMouseDown(event: MouseEvent) {
        if (event.button !== 0) return;
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

            if (deltaX > 5 || deltaY > 5) hasMoved = true;

            const newX = startPosX + (clientX - startX);
            const newY = startPosY + (clientY - startY);

            position = validatePosition(
                { x: newX, y: newY },
                { width: 280, height: 40 } // Use expanded width for safety
            );
        };

        const stopDragging = () => {
            dragging = false;
            document.removeEventListener("mousemove", handleDragMove);
            document.removeEventListener("touchmove", handleDragMove);
            document.removeEventListener("mouseup", stopDragging);
            document.removeEventListener("touchend", stopDragging);

            if (hasMoved) {
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

    onMount(() => {
        if (!browser) return;

        // Initialize position
        const defaultPosition: Position = {
            x: window.innerWidth / 2 - 60, // compact width / 2
            y: 8,
        };

        position = loadPosition(
            STATUS_INDICATOR_CONFIG.STORAGE_KEY,
            { width: 120, height: 40 },
            defaultPosition
        );

        const handleResize = () => {
            position = validatePosition(position, { width: 120, height: 40 });
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    });

    // Handle width changes from FloatingIsland
    function handleWidthChange(newWidth: number) {
        if (dragging || !browser) return;
        
        const widthDelta = newWidth - previousWidth;
        
        // Adjust position based on expansion mode
        if (expansionMode === "center" && widthDelta !== 0) {
            // Shift left by half the width delta to keep center point fixed
            const newX = position.x - (widthDelta / 2);
            position = validatePosition(
                { x: newX, y: position.y },
                { width: newWidth, height: 40 }
            );
        }
        // For "edge" mode, position stays the same (expands to the right)
        
        previousWidth = newWidth;
    }

    onDestroy(() => {
        dragCleanup?.();
    });
</script>

<div
    class="fixed transition-all duration-300 ease-out {dragging ? 'cursor-grabbing' : 'cursor-grab'}"
    style="z-index: 99999; left: {position.x}px; top: {position.y}px;"
    onmousedown={handleMouseDown}
    ontouchstart={handleTouchStart}
    role="presentation"
>
    <FloatingIsland 
        {systemStatus} 
        {currentNotification}
        onWidthChange={handleWidthChange}
    />
</div>

<style>
    /* Draggable container needs to be interactive */
    div {
        pointer-events: auto;
    }
</style>

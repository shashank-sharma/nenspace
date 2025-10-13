<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte";
    import { fade, slide } from "svelte/transition";
    import { Search, X, ChevronDown, Grip } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { page } from "$app/stores";
    import { ConfigService } from "$lib/services/config.service.svelte";
    import { NetworkService } from "$lib/services/network.service.svelte";
    import {
        DebugService,
        type DebugSection,
    } from "$lib/services/debug.service.svelte";
    import { usePlatform } from "$lib/hooks/usePlatform.svelte";
    import {
        loadPosition,
        savePosition,
        validatePosition,
        type Position,
    } from "$lib/utils/draggable.util";
    import { browser } from "$app/environment";

    let { enabled = false } = $props<{
        enabled?: boolean;
    }>();

    const dispatch = createEventDispatcher();

    // Configuration constants
    const PANEL_WIDTH = 380;
    const PANEL_MIN_HEIGHT = 200;
    const STORAGE_KEY = "debugPanelPosition";
    const DRAG_THRESHOLD = 5;

    // --- State ---
    let position = $state<Position>({ x: 0, y: 0 });
    let dragging = $state(false);
    // svelte-ignore non_reactive_update
    let panelElement: HTMLElement;
    let expandedSection = $state("");
    let searchQuery = $state("");
    let dragCleanup: (() => void) | null = null;
    let hasInitialized = $state(false);

    // Platform detection
    const platform = usePlatform();

    let pageSections = $derived(
        DebugService.sections.filter((section) => section.isPageSpecific),
    );

    let globalSections = $derived(
        DebugService.sections.filter((section) => !section.isPageSpecific),
    );

    let filteredSections = $derived(
        globalSections.filter((section: DebugSection) =>
            section.title.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    );

    // --- Effects ---
    $effect(() => {
        if (!browser) return;

        // Load position from localStorage with validation
        const defaultPosition: Position = {
            x: window.innerWidth - PANEL_WIDTH - 20,
            y: 20,
        };

        position = loadPosition(
            STORAGE_KEY,
            { width: PANEL_WIDTH, height: PANEL_MIN_HEIGHT },
            defaultPosition,
        );
    });

    $effect(() => {
        if (
            filteredSections.length > 0 &&
            !expandedSection &&
            !hasInitialized
        ) {
            expandedSection = filteredSections[0].id;
            hasInitialized = true;
        }
    });

    // Reset initialization flag when panel is disabled
    $effect(() => {
        if (!enabled) {
            hasInitialized = false;
        }
    });

    // Handle window resize to revalidate position
    $effect(() => {
        if (!browser) return;

        const elementSize = {
            width: PANEL_WIDTH,
            height: PANEL_MIN_HEIGHT,
        };

        const handleResize = () => {
            position = validatePosition(position, elementSize);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    });

    // Escape key handler
    $effect(() => {
        if (!enabled) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                dispatch("close");
            }
        };

        window.addEventListener("keydown", handleEscape);
        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    });

    // --- Drag Logic ---
    function handleMouseDown(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const isHeader = target.closest(".debug-panel-header");
        const isCloseButton = target.closest(".close-button");

        if (isHeader && !isCloseButton) {
            event.preventDefault();
            startDragging(event.clientX, event.clientY);
        }
    }

    function handleTouchStart(event: TouchEvent) {
        const target = event.target as HTMLElement;
        const isHeader = target.closest(".debug-panel-header");
        const isCloseButton = target.closest(".close-button");

        if (isHeader && !isCloseButton) {
            event.preventDefault();
            startDragging(event.touches[0].clientX, event.touches[0].clientY);
        }
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

            if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                hasMoved = true;
            }

            const newX = startPosX + (clientX - startX);
            const newY = startPosY + (clientY - startY);

            position = validatePosition(
                { x: newX, y: newY },
                { width: PANEL_WIDTH, height: PANEL_MIN_HEIGHT },
            );
        };

        const stopDragging = () => {
            dragging = false;
            document.removeEventListener("mousemove", handleDragMove);
            document.removeEventListener("touchmove", handleDragMove);
            document.removeEventListener("mouseup", stopDragging);
            document.removeEventListener("touchend", stopDragging);

            // Only save if actually dragged
            if (hasMoved) {
                savePosition(STORAGE_KEY, position);
            }

            dragCleanup = null;
        };

        document.addEventListener("mousemove", handleDragMove);
        document.addEventListener("touchmove", handleDragMove);
        document.addEventListener("mouseup", stopDragging);
        document.addEventListener("touchend", stopDragging);

        dragCleanup = stopDragging;
    }

    // Cleanup on component destroy
    onDestroy(() => {
        dragCleanup?.();
    });
</script>

{#if enabled}
    <div
        class="debug-panel"
        role="dialog"
        tabindex="-1"
        transition:fade={{ duration: 150 }}
        style="left: {position.x}px; top: {position.y}px;"
        bind:this={panelElement}
        onmousedown={handleMouseDown}
        ontouchstart={handleTouchStart}
    >
        <div class="debug-panel-header">
            <div class="panel-title">
                <Grip size={16} />
                <span>Debug Panel</span>
            </div>
            <button
                class="close-button"
                onclick={() => dispatch("close")}
                aria-label="Close debug panel"
                title="Close debug panel (Esc)"
            >
                <X size={16} />
                <span class="sr-only">Close</span>
            </button>
        </div>
        <div class="debug-panel-search">
            <div class="search-input-wrapper">
                <Search size={14} class="search-icon" />
                <Input
                    type="text"
                    placeholder="Search debug options..."
                    bind:value={searchQuery}
                    class="search-input"
                />
            </div>
        </div>
        <div class="debug-panel-content">
            <div class="page-specific-section">
                <h4 class="page-section-title">Current Page</h4>
                {#if pageSections.length === 0}
                    <div class="no-results">
                        No debug config found for this page.
                    </div>
                {:else if pageSections.length === 1}
                    <!-- Single section: render controls directly without collapsible wrapper -->
                    <div class="section-content space-y-4">
                        {#each pageSections[0].controls as control}
                            {@const Component = control.component}
                            <Component {...control.props} />
                        {/each}
                    </div>
                {:else}
                    <!-- Multiple sections: render with collapsible headers -->
                    {#each pageSections as section}
                        <div class="debug-section">
                            <button
                                class="section-header"
                                onclick={() =>
                                    (expandedSection =
                                        expandedSection === section.id
                                            ? ""
                                            : section.id)}
                            >
                                <span>{section.title}</span>
                                <span
                                    class="transform transition-transform duration-300 {expandedSection ===
                                    section.id
                                        ? 'rotate-180'
                                        : ''}"
                                >
                                    <ChevronDown size={16} />
                                </span>
                            </button>
                            {#if expandedSection === section.id}
                                <div
                                    class="section-content space-y-4"
                                    transition:slide={{ duration: 200 }}
                                >
                                    {#each section.controls as control}
                                        {@const Component = control.component}
                                        <Component {...control.props} />
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/each}
                {/if}
            </div>

            <hr class="section-divider" />

            {#if filteredSections.length === 0 && searchQuery}
                <div class="no-results">No matching debug options found.</div>
            {:else}
                {#each filteredSections as section}
                    <div class="debug-section">
                        <button
                            class="section-header"
                            onclick={() =>
                                (expandedSection =
                                    expandedSection === section.id
                                        ? ""
                                        : section.id)}
                        >
                            <span>{section.title}</span>
                            <span
                                class="transform transition-transform duration-300 {expandedSection ===
                                section.id
                                    ? 'rotate-180'
                                    : ''}"
                            >
                                <ChevronDown size={16} />
                            </span>
                        </button>
                        {#if expandedSection === section.id}
                            <div
                                class="section-content space-y-4"
                                transition:slide={{ duration: 200 }}
                            >
                                {#each section.controls as control}
                                    {@const Component = control.component}
                                    <Component {...control.props} />
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>
        <div class="debug-panel-footer">
            <div class="footer-item">
                <span>Page:</span>
                <span class="footer-value" title={$page.url.href}>
                    {$page.url.pathname}
                </span>
            </div>
            <div class="footer-item">
                <span>API:</span>
                <span
                    class="footer-value"
                    title={ConfigService.pocketbaseUrl.value}
                >
                    {ConfigService.pocketbaseUrl.value}
                </span>
            </div>
            <div class="footer-item">
                <span>Platform:</span>
                <span class="footer-value" title={platform.summary}>
                    {platform.platformName}
                    {#if platform.isTauri}
                        <span class="platform-badge tauri">Tauri</span>
                    {:else if platform.isPWA}
                        <span class="platform-badge pwa">PWA</span>
                    {:else}
                        <span class="platform-badge web">Web</span>
                    {/if}
                </span>
            </div>
            <div class="footer-item">
                <span>Device:</span>
                <span class="footer-value">
                    {platform.os}
                    {#if platform.isMobile}
                        <span class="device-badge">Mobile</span>
                    {:else}
                        <span class="device-badge">Desktop</span>
                    {/if}
                </span>
            </div>
            <div class="footer-item">
                <span>Network:</span>
                <span class="footer-value">
                    <button
                        class="network-badge-button"
                        onclick={() => NetworkService.toggleSimulateOffline()}
                        title="Click to toggle offline simulation"
                    >
                        {#if NetworkService.isOnline}
                            <span class="network-badge online">
                                Online
                                {#if NetworkService.isSimulatingOffline}
                                    <span class="simulated-indicator"
                                        >(sim)</span
                                    >
                                {/if}
                            </span>
                        {:else}
                            <span class="network-badge offline">
                                Offline
                                {#if NetworkService.isSimulatingOffline}
                                    <span class="simulated-indicator"
                                        >(sim)</span
                                    >
                                {/if}
                            </span>
                        {/if}
                    </button>
                </span>
            </div>
        </div>
    </div>
{/if}

<style>
    .debug-panel {
        position: fixed;
        width: 380px;
        max-width: calc(100vw - 20px);
        background-color: hsl(var(--background) / 95%);
        border: 1px solid hsl(var(--border) / 70%);
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        color: hsl(var(--foreground));
        z-index: 9999;
        max-height: calc(100vh - 40px);
        overflow: hidden;
        resize: both;
    }

    .debug-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        border-bottom: 1px solid hsl(var(--border) / 70%);
        background-color: hsl(var(--secondary) / 70%);
        cursor: move;
        user-select: none;
    }

    .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        font-size: 14px;
    }

    .close-button {
        background: transparent;
        border: none;
        color: hsl(var(--muted-foreground));
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        padding: 4px;
    }

    .close-button:hover {
        color: hsl(var(--foreground));
        background-color: hsl(var(--muted) / 30%);
    }

    .debug-panel-search {
        padding: 10px 12px;
        border-bottom: 1px solid hsl(var(--border) / 70%);
    }

    .search-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    :global(.search-icon) {
        position: absolute;
        left: 10px;
        color: hsl(var(--muted-foreground));
    }

    :global(.search-input) {
        width: 100%;
        padding-left: 32px;
        font-size: 14px;
        background-color: hsl(var(--background));
        color: hsl(var(--foreground));
        border: 1px solid hsl(var(--border));
        border-radius: 4px;
    }

    .debug-panel-content {
        overflow-y: auto;
        padding: 8px;
        flex: 1;
    }

    .debug-section {
        margin-bottom: 8px;
        border: 1px solid hsl(var(--border) / 50%);
        border-radius: 6px;
        overflow: hidden;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        width: 100%;
        text-align: left;
        background-color: hsl(var(--secondary) / 60%);
        border: none;
        cursor: pointer;
        font-weight: 400;
        font-size: 14px;
        color: hsl(var(--foreground));
    }

    .section-header:hover {
        background-color: hsl(var(--secondary) / 80%);
    }

    .section-content {
        padding: 12px;
        background-color: hsl(var(--secondary) / 30%);
        font-size: 13px;
    }

    .no-results {
        padding: 16px;
        text-align: center;
        color: hsl(var(--muted-foreground));
        font-style: italic;
        font-size: 13px;
    }

    .page-specific-section {
        padding: 4px;
    }

    .page-section-title {
        font-size: 12px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: hsl(var(--muted-foreground));
        padding: 8px 4px;
    }

    .section-divider {
        border: none;
        border-top: 1px solid hsl(var(--border) / 70%);
        margin: 8px 0;
    }

    .debug-panel-footer {
        padding: 8px 12px;
        border-top: 1px solid hsl(var(--border) / 70%);
        background-color: hsl(var(--secondary) / 50%);
        font-size: 11px;
        color: hsl(var(--muted-foreground));
        display: flex;
        flex-direction: column;
        gap: 4px;
        user-select: none;
    }

    .footer-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
    }

    .footer-value {
        font-family: monospace;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
        direction: rtl;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .platform-badge,
    .device-badge {
        font-size: 9px;
        padding: 1px 4px;
        border-radius: 3px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        direction: ltr;
    }

    .platform-badge.tauri {
        background-color: hsl(142 76% 36% / 20%);
        color: hsl(142 76% 36%);
        border: 1px solid hsl(142 76% 36% / 30%);
    }

    .platform-badge.pwa {
        background-color: hsl(221 83% 53% / 20%);
        color: hsl(221 83% 53%);
        border: 1px solid hsl(221 83% 53% / 30%);
    }

    .platform-badge.web {
        background-color: hsl(0 0% 50% / 20%);
        color: hsl(0 0% 50%);
        border: 1px solid hsl(0 0% 50% / 30%);
    }

    .device-badge {
        background-color: hsl(var(--muted) / 80%);
        color: hsl(var(--muted-foreground));
        border: 1px solid hsl(var(--border));
    }

    .network-badge {
        font-size: 9px;
        padding: 1px 4px;
        border-radius: 3px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        direction: ltr;
    }

    .network-badge.online {
        background-color: hsl(142 76% 36% / 20%);
        color: hsl(142 76% 36%);
        border: 1px solid hsl(142 76% 36% / 30%);
    }

    .network-badge.offline {
        background-color: hsl(0 84% 60% / 20%);
        color: hsl(0 84% 60%);
        border: 1px solid hsl(0 84% 60% / 30%);
    }

    .network-badge-button {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        transition: opacity 0.2s;
    }

    .network-badge-button:hover {
        opacity: 0.8;
    }

    .network-badge-button:active {
        opacity: 0.6;
    }

    .simulated-indicator {
        font-size: 7px;
        opacity: 0.7;
        margin-left: 2px;
    }

    /* Screen reader only - accessibility */
    :global(.sr-only) {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
    }
</style>

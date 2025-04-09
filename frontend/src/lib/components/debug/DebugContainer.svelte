<!-- Add easing function for better animation -->
<script lang="ts" context="module">
    // Cubic easing function for natural motion
    export function cubicOut(t: number): number {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }
</script>

<script lang="ts">
    import { onMount, createEventDispatcher } from "svelte";
    import { fade, slide } from "svelte/transition";
    import { Search, X, ChevronDown, ChevronUp, Grip } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";

    // Import our section components
    import ConnectionSettings from "./sections/ConnectionSettings.svelte";
    import AppearanceSettings from "./sections/AppearanceSettings.svelte";
    import PwaActions from "./sections/PwaActions.svelte";
    import PageDebugSettings from "./sections/PageDebugSettings.svelte";

    // Define sections for the debug panel
    const allSections = [
        {
            id: "page_debug",
            title: "Page Debug Settings",
            expanded: true,
            component: PageDebugSettings,
        },
        {
            id: "appearance",
            title: "Appearance",
            expanded: false,
            component: AppearanceSettings,
        },
        {
            id: "connection",
            title: "Connection",
            expanded: false,
            component: ConnectionSettings,
        },
        {
            id: "pwa",
            title: "PWA Options",
            expanded: false,
            component: PwaActions,
        },
    ];

    // Props
    export let enabled: boolean = false;
    export let initialPosition = { x: window.innerWidth - 420, y: 20 };
    export let width = 380;

    // State
    let dragging = false;
    let position = { ...initialPosition };
    let searchQuery = "";
    let panelElement: HTMLElement;
    let sections = [...allSections];
    let filteredSections = [...sections];

    // Font scale variables
    let fontScaleFactor = 1;
    let currentWidth = width;
    let resizeObserver: ResizeObserver;

    // Initialize event dispatcher
    const dispatch = createEventDispatcher<{
        close: void;
    }>();

    // Load position from localStorage
    onMount(() => {
        const savedPosition = localStorage.getItem("debugPanelPosition");
        if (savedPosition) {
            try {
                position = JSON.parse(savedPosition);
            } catch (e) {
                position = { ...initialPosition };
            }
        }

        // Initialize the first section as expanded
        if (
            sections.length > 0 &&
            !sections.some((section) => section.expanded)
        ) {
            sections = sections.map((section, index) => ({
                ...section,
                expanded: index === 0, // Only expand the first section
            }));
        }

        updateFilteredSections();

        // Set up resize observer to track panel size changes
        if (panelElement && typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    const newWidth = entry.contentRect.width;
                    currentWidth = newWidth;

                    // Calculate font scale based on width
                    // Use 380px as the base width (fontScaleFactor = 1)
                    const baseWidth = 380;
                    const newFontScale = Math.max(
                        0.8,
                        Math.min(1, newWidth / baseWidth),
                    );
                    fontScaleFactor = newFontScale;

                    // Apply CSS variables to the panel element
                    panelElement.style.setProperty(
                        "--font-scale",
                        fontScaleFactor.toString(),
                    );
                }
            });

            resizeObserver.observe(panelElement);
        }

        return () => {
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    });

    // Handle dragging - now the entire header is draggable
    function handleMouseDown(event: MouseEvent) {
        // Check if clicked in the header but not on the close button
        const target = event.target as HTMLElement;
        const isHeader = target.closest(".debug-panel-header");
        const isCloseButton = target.closest(".close-button");

        if (isHeader && !isCloseButton) {
            dragging = true;

            const startX = event.clientX;
            const startY = event.clientY;
            const startPosX = position.x;
            const startPosY = position.y;

            const handleMouseMove = (e: MouseEvent) => {
                if (dragging) {
                    position = {
                        x: startPosX + (e.clientX - startX),
                        y: startPosY + (e.clientY - startY),
                    };
                }
            };

            const handleMouseUp = () => {
                dragging = false;
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);

                // Save position to localStorage
                localStorage.setItem(
                    "debugPanelPosition",
                    JSON.stringify(position),
                );
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);

            // Prevent text selection during drag
            event.preventDefault();
        }
    }

    // Toggle section expansion
    function toggleSection(sectionId: string) {
        // Find the currently expanded section
        const expandedSection = sections.find((section) => section.expanded);

        // Update sections to implement accordion behavior
        sections = sections.map((section) => ({
            ...section,
            // If this is the clicked section and it's not expanded, expand it
            // otherwise collapse everything
            expanded: section.id === sectionId ? !section.expanded : false,
        }));

        // Also update filtered sections to maintain consistency
        filteredSections = filteredSections.map((section) => ({
            ...section,
            expanded: section.id === sectionId ? !section.expanded : false,
        }));
    }

    // Close panel
    function closePanel() {
        // Instead of directly setting enabled to false, dispatch an event to notify parent
        dispatch("close");
    }

    // Handle search
    function updateFilteredSections() {
        if (!searchQuery.trim()) {
            filteredSections = [...sections];
            return;
        }

        const query = searchQuery.toLowerCase();
        filteredSections = sections.filter((section) =>
            section.title.toLowerCase().includes(query),
        );

        // Auto-expand all sections when searching
        filteredSections = filteredSections.map((section) => ({
            ...section,
            expanded: true,
        }));
    }

    // Watch search query changes
    $: {
        searchQuery;
        updateFilteredSections();
    }
</script>

{#if enabled}
    <div
        class="debug-panel"
        transition:fade={{ duration: 150 }}
        style="left: {position.x}px; top: {position.y}px; width: {width}px; --font-scale: {fontScaleFactor};"
        bind:this={panelElement}
        on:mousedown={handleMouseDown}
    >
        <div class="debug-panel-header">
            <div class="panel-title">
                <Grip size={16} />
                <span>Debug Panel</span>
            </div>
            <button class="close-button" on:click={closePanel}>
                <X size={16} />
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
            {#if filteredSections.length === 0}
                <div class="no-results">No matching debug options found.</div>
            {:else}
                {#each filteredSections as section}
                    <div
                        class="debug-section transition-all duration-300 hover:shadow-md"
                    >
                        <button
                            class="section-header transition-all duration-200 hover:bg-muted/50"
                            on:click={() => toggleSection(section.id)}
                            aria-expanded={section.expanded}
                        >
                            <span>{section.title}</span>
                            <span
                                class="transform transition-transform duration-300 ease-in-out {section.expanded
                                    ? 'rotate-180'
                                    : ''}"
                            >
                                <ChevronDown size={16} />
                            </span>
                        </button>

                        {#if section.expanded}
                            <div
                                transition:slide={{
                                    duration: 300,
                                    easing: cubicOut,
                                }}
                                class="section-content overflow-hidden"
                            >
                                <div
                                    class="p-1 transition-all duration-300 ease-in-out"
                                >
                                    <svelte:component
                                        this={section.component}
                                    />
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/if}

<style>
    .debug-panel {
        position: fixed;
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

        /* Default font scale factor (will be updated by JS) */
        --font-scale: 1;
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
        position: relative;
        overflow: hidden;
    }

    /* Visual indicator that the whole header is draggable */
    .debug-panel-header:hover {
        background-color: hsl(var(--secondary) / 95%);
    }

    .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        font-size: calc(14px * var(--font-scale));
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

    .search-icon {
        position: absolute;
        left: 10px;
        color: hsl(var(--muted-foreground));
    }

    .search-input {
        width: 100%;
        padding-left: 32px;
        font-size: calc(14px * var(--font-scale));
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
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
        font-size: calc(14px * var(--font-scale));
        color: hsl(var(--foreground));
    }

    .section-header:hover {
        background-color: hsl(var(--secondary) / 80%);
    }

    .section-content {
        padding: 12px;
        background-color: hsl(var(--secondary) / 30%);
        font-size: calc(13px * var(--font-scale));
    }

    .no-results {
        padding: 16px;
        text-align: center;
        color: hsl(var(--muted-foreground));
        font-style: italic;
        font-size: calc(13px * var(--font-scale));
    }

    /* Apply scaling to all labels and text elements in the debug panel */
    .debug-panel :global(.text-sm) {
        font-size: calc(0.875rem * var(--font-scale)) !important;
    }

    .debug-panel :global(.text-xs) {
        font-size: calc(0.75rem * var(--font-scale)) !important;
    }

    /* Scale icons */
    .debug-panel :global(svg) {
        transform: scale(var(--font-scale));
    }

    /* Override and fix button styles for both theme modes */
    .debug-panel :global(.btn),
    .debug-panel :global(button[class*="size-sm"]) {
        padding: calc(0.5rem * var(--font-scale))
            calc(0.75rem * var(--font-scale));
        font-size: calc(0.875rem * var(--font-scale));
        height: calc(2rem * var(--font-scale));
        min-height: calc(2rem * var(--font-scale));
        color: hsl(var(--foreground));
        background-color: hsl(var(--secondary));
        border-color: hsl(var(--border));
    }

    /* Fix button hover states */
    .debug-panel :global(button:hover) {
        background-color: hsl(var(--secondary) / 80%);
    }

    /* Fix variant specific button styling */
    .debug-panel :global(button[class*="variant-outline"]) {
        background-color: transparent;
        border: 1px solid hsl(var(--border));
        color: hsl(var(--foreground));
    }

    .debug-panel :global(button[class*="variant-outline"]:hover) {
        background-color: hsl(var(--accent) / 10%);
    }

    .debug-panel :global(button[class*="variant-destructive"]) {
        background-color: hsl(var(--destructive));
        color: hsl(var(--destructive-foreground));
    }

    .debug-panel :global(button[class*="variant-destructive"]:hover) {
        background-color: hsl(var(--destructive) / 90%);
    }

    /* Fix form elements for theme compatibility */
    .debug-panel :global(input),
    .debug-panel :global(select),
    .debug-panel :global(.form-input) {
        font-size: calc(0.875rem * var(--font-scale));
        height: calc(2.5rem * var(--font-scale));
        padding: calc(0.5rem * var(--font-scale))
            calc(0.75rem * var(--font-scale));
        background-color: hsl(var(--background));
        color: hsl(var(--foreground));
        border-color: hsl(var(--border));
    }

    /* Fix text colors for different themes */
    .debug-panel :global(.text-muted-foreground) {
        color: hsl(var(--muted-foreground));
    }

    /* Status colors that work in both themes */
    .debug-panel :global(.text-green-500) {
        color: hsl(142.1 76.2% 36.3%);
    }

    .debug-panel :global(.text-amber-500) {
        color: hsl(37.7 92.1% 50.2%);
    }

    /* Update padding and spacing based on scale */
    .debug-panel :global(.space-y-3) {
        margin-top: calc(0.75rem * var(--font-scale));
    }

    .debug-panel :global(.gap-1) {
        gap: calc(0.25rem * var(--font-scale));
    }

    .debug-panel :global(.gap-2) {
        gap: calc(0.5rem * var(--font-scale));
    }

    .debug-panel :global(.mt-2) {
        margin-top: calc(0.5rem * var(--font-scale));
    }

    .debug-panel :global(.mb-1) {
        margin-bottom: calc(0.25rem * var(--font-scale));
    }

    .debug-panel :global(.p-1) {
        padding: calc(0.25rem * var(--font-scale));
    }

    .debug-panel :global(.p-2) {
        padding: calc(0.5rem * var(--font-scale));
    }
</style>

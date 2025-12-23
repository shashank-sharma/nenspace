<script lang="ts">
    import * as React from "react";
    import { createRoot, type Root } from "react-dom/client";
    import { onMount, onDestroy } from "svelte";
    import { tick } from "svelte";

    // Patch canvas prototypes IMMEDIATELY at module load time
    // This must happen before ANY canvas is created, including Excalidraw's
    if (typeof window !== "undefined" && !(window as any).__canvasPatched) {
        (window as any).React = React;
        (window as any).ReactDOM = { createRoot };

        // Patch HTMLCanvasElement width/height to clamp values globally
        const originalWidthDesc = Object.getOwnPropertyDescriptor(
            HTMLCanvasElement.prototype,
            "width",
        );
        const originalHeightDesc = Object.getOwnPropertyDescriptor(
            HTMLCanvasElement.prototype,
            "height",
        );

        if (originalWidthDesc && originalHeightDesc) {
            // Global canvas size limit - browsers typically support up to 4096x4096
            const maxCanvasSize = 4096;

            Object.defineProperty(HTMLCanvasElement.prototype, "width", {
                get: originalWidthDesc.get,
                set: function (value: number) {
                    // Only clamp if value exceeds browser limits
                    const safeValue = Math.min(
                        Math.max(0, value),
                        maxCanvasSize,
                    );
                    if (value > maxCanvasSize) {
                        console.warn(
                            `[ReactComponent] Canvas width exceeds limit: ${value} -> ${safeValue}`,
                        );
                    }
                    if (originalWidthDesc.set) {
                        originalWidthDesc.set.call(this, safeValue);
                    }
                },
                configurable: true,
                enumerable: true,
            });

            Object.defineProperty(HTMLCanvasElement.prototype, "height", {
                get: originalHeightDesc.get,
                set: function (value: number) {
                    // Only clamp if value exceeds browser limits
                    const safeValue = Math.min(
                        Math.max(0, value),
                        maxCanvasSize,
                    );
                    if (value > maxCanvasSize) {
                        console.warn(
                            `[ReactComponent] Canvas height exceeds limit: ${value} -> ${safeValue}`,
                        );
                    }
                    if (originalHeightDesc.set) {
                        originalHeightDesc.set.call(this, safeValue);
                    }
                },
                configurable: true,
                enumerable: true,
            });

            // Patch setTransform globally
            const originalSetTransform =
                CanvasRenderingContext2D.prototype.setTransform;
            CanvasRenderingContext2D.prototype.setTransform = function (
                aOrTransform?: number | DOMMatrix2DInit,
                b?: number,
                c?: number,
                d?: number,
                e?: number,
                f?: number,
            ): void {
                // Check canvas dimensions first - if canvas is too large, always use identity
                // Canvas dimension checks removed - let browser handle large canvases naturally

                if (typeof aOrTransform === "number" && b !== undefined) {
                    // Use VERY conservative thresholds - any large value = use identity
                    // This prevents canvas from ever entering error state
                    const maxVal = 50; // Even more conservative
                    const maxTranslate = 500; // Translation can be slightly larger

                    if (
                        !isFinite(aOrTransform) ||
                        !isFinite(b) ||
                        !isFinite(c || 0) ||
                        !isFinite(d || 0) ||
                        !isFinite(e || 0) ||
                        !isFinite(f || 0) ||
                        Math.abs(aOrTransform) > maxVal ||
                        Math.abs(b) > maxVal ||
                        Math.abs(c || 0) > maxVal ||
                        Math.abs(d || 0) > maxVal ||
                        Math.abs(e || 0) > maxTranslate ||
                        Math.abs(f || 0) > maxTranslate
                    ) {
                        // Always use identity matrix for any suspicious values
                        try {
                            (originalSetTransform as any).call(
                                this,
                                1,
                                0,
                                0,
                                1,
                                0,
                                0,
                            );
                        } catch (e) {
                            // Canvas might already be in error state - ignore
                        }
                        return;
                    }

                    // Values look safe, clamp them to be extra safe
                    const safeA = Math.max(
                        -maxVal,
                        Math.min(aOrTransform, maxVal),
                    );
                    const safeB = Math.max(-maxVal, Math.min(b, maxVal));
                    const safeC = Math.max(-maxVal, Math.min(c || 0, maxVal));
                    const safeD = Math.max(-maxVal, Math.min(d || 0, maxVal));
                    const safeE = Math.max(
                        -maxTranslate,
                        Math.min(e || 0, maxTranslate),
                    );
                    const safeF = Math.max(
                        -maxTranslate,
                        Math.min(f || 0, maxTranslate),
                    );

                    try {
                        (originalSetTransform as any).call(
                            this,
                            safeA,
                            safeB,
                            safeC,
                            safeD,
                            safeE,
                            safeF,
                        );
                    } catch (error) {
                        // If it still fails, try identity matrix
                        try {
                            (originalSetTransform as any).call(
                                this,
                                1,
                                0,
                                0,
                                1,
                                0,
                                0,
                            );
                        } catch (e2) {
                            // Canvas in error state - ignore
                        }
                    }
                    return;
                } else {
                    // Single-parameter version (DOMMatrix2DInit) - pass through
                    try {
                        (originalSetTransform as any).call(this, aOrTransform);
                    } catch (e) {
                        // If it fails, try identity
                        try {
                            (originalSetTransform as any).call(this, {
                                a: 1,
                                b: 0,
                                c: 0,
                                d: 1,
                                e: 0,
                                f: 0,
                            });
                        } catch (e2) {
                            // Ignore
                        }
                    }
                }
            };

            // Patch scale globally
            const originalScale = CanvasRenderingContext2D.prototype.scale;
            CanvasRenderingContext2D.prototype.scale = function (
                x: number,
                y: number,
            ): void {
                if (
                    !isFinite(x) ||
                    !isFinite(y) ||
                    Math.abs(x) > 10 ||
                    Math.abs(y) > 10
                ) {
                    try {
                        originalScale.call(this, 1, 1);
                    } catch (e) {
                        // Ignore
                    }
                    return;
                }
                originalScale.call(this, x, y);
            };

            // Patch translate globally
            const originalTranslate =
                CanvasRenderingContext2D.prototype.translate;
            CanvasRenderingContext2D.prototype.translate = function (
                x: number,
                y: number,
            ): void {
                if (
                    !isFinite(x) ||
                    !isFinite(y) ||
                    Math.abs(x) > 5000 ||
                    Math.abs(y) > 5000
                ) {
                    return; // Skip translation
                }
                try {
                    originalTranslate.call(this, x, y);
                } catch (e) {
                    // Ignore
                }
            };

            // Also patch getContext to ensure canvas dimensions don't exceed browser limits
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (
                this: HTMLCanvasElement,
                contextId: string | OffscreenRenderingContextId,
                options?: any,
            ): RenderingContext | null {
                // Ensure canvas dimensions don't exceed browser limits (4096x4096)
                const maxSize = 4096;
                if (this.width > maxSize) {
                    this.width = Math.min(this.width, maxSize);
                }
                if (this.height > maxSize) {
                    this.height = Math.min(this.height, maxSize);
                }

                const ctx = originalGetContext.call(this, contextId, options);
                return ctx;
            } as any; // Type assertion to satisfy TypeScript overloads

            (window as any).__canvasPatched = true;
            console.log("[ReactComponent] Global canvas patches applied");
        }
    }

    let {
        this: component,
        children,
        ref,
        excalidrawAPI,
        ...props
    } = $props<{
        this: any;
        children?: any;
        ref?: ((instance: any) => void) | null;
        excalidrawAPI?: ((api: any) => void) | null;
        [key: string]: any;
    }>();

    let container: HTMLElement;
    let root: Root | null = null;
    let mounted = false;
    let resizeObserver: ResizeObserver | null = null;
    let reactInstance: any = null;

    function getValidDimensions() {
        if (!container) return { width: 800, height: 600 };

        const rect = container.getBoundingClientRect();
        const devicePixelRatio = window.devicePixelRatio || 1;

        // Check if container is set to fill parent (full-screen mode)
        const computedStyle = window.getComputedStyle(container);
        const parent = container.parentElement;

        // If container or parent has width: 100%, we're in full-screen mode
        const isFullScreen =
            computedStyle.width === "100%" ||
            (parent && window.getComputedStyle(parent).width === "100%");

        if (isFullScreen && rect.width > 0 && rect.height > 0) {
            // Full-screen mode: use actual dimensions but clamp to reasonable max
            // Most browsers have a canvas size limit around 4096x4096, so we use 3840x2160 (4K) as safe max
            const maxWidth = 3840;
            const maxHeight = 2160;

            const width = Math.min(Math.max(rect.width, 400), maxWidth);
            const height = Math.min(Math.max(rect.height, 400), maxHeight);

            return { width, height };
        }

        // Legacy mode: use conservative 600px max for modal/small containers
        const maxWidth = 600;
        const maxHeight = 600;

        let width = rect.width > 0 ? rect.width : 800;
        let height = rect.height > 0 ? rect.height : 600;

        width = Math.max(400, Math.min(width, maxWidth));
        height = Math.max(400, Math.min(height, maxHeight));

        return { width, height };
    }

    async function renderComponent() {
        if (!container || !mounted) return;

        // Ensure container is in the DOM
        if (!container.isConnected) {
            await tick();
            if (!container.isConnected) return;
        }

        // Wait for container to have valid dimensions
        let rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            await tick();
            rect = container.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                rect = container.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    console.warn(
                        "Excalidraw container has no dimensions, using defaults",
                    );
                    // Use safe defaults if container still has no dimensions
                    container.style.width = "800px";
                    container.style.height = "600px";
                    rect = container.getBoundingClientRect();
                }
            }
        }

        const { width, height } = getValidDimensions();
        const devicePixelRatio = window.devicePixelRatio || 1;

        // Check if we're in full-screen mode
        const computedStyle = window.getComputedStyle(container);
        const isFullScreen =
            computedStyle.width === "100%" || container.style.width === "";

        if (isFullScreen) {
            // Full-screen mode: let CSS handle sizing naturally
            // Don't set explicit dimensions - let the container fill its parent
            container.style.width = "";
            container.style.height = "";
            container.style.maxWidth = "100%";
            container.style.maxHeight = "100%";
            container.style.overflow = "hidden";
            container.style.boxSizing = "border-box";
            container.style.position = "relative";
            container.style.display = "block";
        } else {
            // Fixed size mode: set explicit dimensions
            container.style.width = `${width}px`;
            container.style.height = `${height}px`;
            container.style.maxWidth = `${width}px`;
            container.style.maxHeight = `${height}px`;
            container.style.overflow = "visible";
            container.style.boxSizing = "border-box";
            container.style.position = "relative";
            container.style.display = "block";
        }

        // Wait for styles to apply and get final dimensions
        await tick();
        await tick(); // Double tick to ensure layout has settled

        const finalRect = container.getBoundingClientRect();

        // Excalidraw handles devicePixelRatio internally, so we don't need to worry about it
        // Just ensure the container has valid dimensions and let Excalidraw do its thing
        // The only thing we check is that we don't exceed browser canvas limits
        const maxCanvasSize = 4096;
        const effectiveWidth = finalRect.width * devicePixelRatio;
        const effectiveHeight = finalRect.height * devicePixelRatio;

        if (effectiveWidth > maxCanvasSize || effectiveHeight > maxCanvasSize) {
            // Only scale down if we exceed browser limits
            const scale = Math.min(
                maxCanvasSize / effectiveWidth,
                maxCanvasSize / effectiveHeight,
            );
            const scaledWidth = Math.floor(finalRect.width * scale);
            const scaledHeight = Math.floor(finalRect.height * scale);

            container.style.maxWidth = `${scaledWidth}px`;
            container.style.maxHeight = `${scaledHeight}px`;

            console.warn(
                `[ReactComponent] Scaled down to fit canvas limits: ${scaledWidth}x${scaledHeight}`,
            );
        }

        if (!root) {
            root = createRoot(container);
        }

        // Use the same React instance consistently
        // Handle excalidrawAPI callback - Excalidraw exposes API via excalidrawAPI prop (not ref)
        // Also support ref for backwards compatibility
        const finalProps: any = { ...props };

        if (excalidrawAPI) {
            finalProps.excalidrawAPI = (api: any) => {
                console.log(
                    "[ReactComponent] excalidrawAPI callback called with:",
                    !!api,
                    api,
                );
                reactInstance = api;
                if (excalidrawAPI) {
                    try {
                        excalidrawAPI(api);
                        console.log(
                            "[ReactComponent] excalidrawAPI callback invoked successfully",
                        );
                    } catch (e) {
                        console.error(
                            "[ReactComponent] Error invoking excalidrawAPI callback:",
                            e,
                        );
                    }
                }
            };
        }

        if (ref) {
            finalProps.ref = (instance: any) => {
                console.log(
                    "[ReactComponent] Ref callback called with instance:",
                    !!instance,
                    instance,
                );
                if (!reactInstance) {
                    reactInstance = instance;
                }
                if (ref) {
                    try {
                        ref(instance);
                        console.log(
                            "[ReactComponent] Ref callback invoked successfully",
                        );
                    } catch (e) {
                        console.error(
                            "[ReactComponent] Error invoking ref callback:",
                            e,
                        );
                    }
                }
            };
        }

        const propsWithRef = finalProps;

        const ReactElement = React.createElement(
            component,
            propsWithRef,
            children,
        );
        root.render(ReactElement);

        // Excalidraw handles canvas sizing, devicePixelRatio, and coordinate mapping internally
        // We should not interfere with its canvas management
    }

    onMount(async () => {
        mounted = true;
        await tick();
        await renderComponent();

        // Set up resize observer to handle dimension changes
        // Only re-render if dimensions actually change significantly (prevents unnecessary re-renders)
        if (container && window.ResizeObserver) {
            let lastWidth = container.offsetWidth;
            let lastHeight = container.offsetHeight;

            resizeObserver = new ResizeObserver(() => {
                const currentWidth = container.offsetWidth;
                const currentHeight = container.offsetHeight;

                // Only re-render if dimensions actually changed significantly (>1px)
                // This prevents unnecessary re-renders from minor layout shifts
                if (
                    Math.abs(currentWidth - lastWidth) > 1 ||
                    Math.abs(currentHeight - lastHeight) > 1
                ) {
                    lastWidth = currentWidth;
                    lastHeight = currentHeight;
                    renderComponent();
                }
            });
            resizeObserver.observe(container);
        }
    });

    // Use $effect to react to prop changes
    $effect(() => {
        // Track prop changes by accessing them
        component;
        children;
        Object.keys(props);

        if (mounted && root && container) {
            renderComponent();
        }
    });

    onDestroy(() => {
        // Excalidraw manages its own canvas cleanup

        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        if (root) {
            root.unmount();
            root = null;
        }
        mounted = false;
    });
</script>

<div class="reactComponent" bind:this={container}></div>

<style>
    .reactComponent {
        width: 100% !important;
        height: 100% !important;
        min-height: 100% !important;
        max-height: 100% !important;
        position: relative;
        display: flex !important;
        flex-direction: column;
        box-sizing: border-box;
        overflow: hidden;
        flex: 1 1 auto;
    }

    .reactComponent :global(*) {
        box-sizing: border-box;
    }

    .reactComponent :global(canvas) {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
    }
</style>

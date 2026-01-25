<script lang="ts">
    import type { Snippet } from "svelte";
    import { onMount } from "svelte";
    import { navigating, page } from "$app/stores";
    import { fade } from "svelte/transition";
    import Loading from "$lib/components/Loading.svelte";
    import PageTransition from "$lib/components/PageTransition.svelte";
    import { FontService } from "$lib/services/font.service.svelte";
    import { NotificationSyncService } from "$lib/features/status-indicator";
    import "../app.css";
    import { browser } from "$app/environment";
    import { usePlatform } from "$lib/hooks/usePlatform.svelte";
    import LimitedFunctionalityBanner from "$lib/components/platform/LimitedFunctionalityBanner.svelte";
    import { Button } from "$lib/components/ui/button";
    import { RefreshCw } from "lucide-svelte";
    import BuildInfoBadge from "$lib/components/BuildInfoBadge.svelte";

    let { children } = $props<{ children: Snippet }>();
    let isLoading = $state(true);
    let isFadingOut = $state(false);
    let showLoadingIndicator = $state(true);
    let loadingTime = $state(0.0);
    let revealProgress = $state(0.0);
    let revealAnimationFrame: number | null = $state(null);
    let revealStartTime: number | null = $state(null);

    const platform = usePlatform();
    let pwaInitFinished = $state(false);
    let pwaUpdateAvailable = $state(false);
    let UpdateDetector: any = $state(null);
    let OfflineIndicator: any = $state(null);

    let isDashboardRoute = $derived($page.url.pathname.startsWith("/dashboard"));
    let isHomepage = $derived($page.url.pathname === "/");
    
    if (browser) {
        function updateReveal() {
            if (isFadingOut && showLoadingIndicator) {
                if (revealStartTime === null) {
                    revealStartTime = performance.now();
                }
                const elapsed = (performance.now() - revealStartTime!) * 0.001;
                const progress = Math.min(1.0, elapsed / 5.0);
                revealProgress = 1 - Math.pow(1 - progress, 3);
                revealAnimationFrame = requestAnimationFrame(updateReveal);
            } else {
                revealProgress = 0.0;
                revealStartTime = null;
                if (revealAnimationFrame !== null) {
                    cancelAnimationFrame(revealAnimationFrame);
                    revealAnimationFrame = null;
                }
            }
        }
        
        $effect(() => {
            if (isFadingOut && showLoadingIndicator && revealAnimationFrame === null) {
                updateReveal();
            } else if (!isFadingOut && revealAnimationFrame !== null) {
                cancelAnimationFrame(revealAnimationFrame);
                revealAnimationFrame = null;
                revealProgress = 0.0;
                revealStartTime = null;
            }
        });
    }

    onMount(() => {
        NotificationSyncService.initialize().catch((err) => {
            console.error('[RootLayout] Failed to initialize notification sync:', err);
        });
        
        if (browser) {
            const startTime = performance.now();
            function updateLoadingColor() {
                if (isLoading) {
                    const elapsed = (performance.now() - startTime) * 0.001;
                    loadingTime = elapsed;
                    requestAnimationFrame(updateLoadingColor);
                }
            }
            updateLoadingColor();

            FontService.initialize();
            console.log(`[App] Platform: ${platform.summary}`);
            console.log(
                `[App] Tauri: ${platform.isTauri}, PWA: ${platform.isPWA}, Mobile: ${platform.isMobile}`,
            );

            if (!platform.isTauri) {
                Promise.all([
                    import("$lib/features/pwa/services/pwa.service.svelte"),
                    import("$lib/features/pwa/components/UpdateDetector.svelte"),
                    import("$lib/features/pwa/components/OfflineIndicator.svelte"),
                ])
                    .then(
                        ([, updateDetectorModule, offlineModule]) => {
                            UpdateDetector = updateDetectorModule.default;
                            OfflineIndicator = offlineModule.default;
                            pwaInitFinished = true;
                        },
                    )
                    .catch((err) => {
                        console.error("[App] Failed to load PWA modules:", err);
                    });
            }

            setTimeout(() => {
                isLoading = false;
                isFadingOut = true;
            }, 2000);
            
            setTimeout(() => {
                showLoadingIndicator = false;
            }, 7000);
        }
    });

    function handlePwaUpdateAvailable() {
        pwaUpdateAvailable = true;
    }

    function reload() {
        if (browser) {
            window.location.reload();
        }
    }
</script>

{#if !platform.isTauri && pwaInitFinished}
    {#if UpdateDetector}
        <UpdateDetector on:update-available={handlePwaUpdateAvailable} />
    {/if}

    {#if OfflineIndicator}
        <OfflineIndicator />
    {/if}

    {#if pwaUpdateAvailable}
        <div
            transition:fade={{ duration: 200 }}
            class="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full bg-card border rounded-lg shadow-lg p-4 flex items-center justify-between"
        >
            <span>A new version is available!</span>
            <Button variant="outline" size="sm" on:click={reload}>
                <RefreshCw class="mr-2 h-4 w-4" />
                Update Now
            </Button>
        </div>
    {/if}
{/if}

{#if $navigating}
    <div
        class="fixed inset-0 bg-background/30 backdrop-blur-sm flex items-center justify-center z-50"
    >
        <Loading />
    </div>
{/if}

{#if isLoading && !isHomepage}
    <div
        class="fixed inset-0 bg-background flex items-center justify-center z-50"
        transition:fade={{ duration: 300 }}
    >
        <Loading />
    </div>
{/if}

{#if showLoadingIndicator && isHomepage}
    {@const flowPhase = loadingTime * 0.15}
    {@const spectralR = Math.floor((0.5 + 0.5 * Math.cos(flowPhase + 0.0)) * 255)}
    {@const spectralG = Math.floor((0.5 + 0.5 * Math.cos(flowPhase + 2.0)) * 255)}
    {@const spectralB = Math.floor((0.5 + 0.5 * Math.cos(flowPhase + 4.0)) * 255)}
    {@const spectralColor = `rgb(${spectralR}, ${spectralG}, ${spectralB})`}
    {@const gradientStops = [
        `${spectralColor} 0%`,
        `rgba(${spectralR}, ${spectralG}, ${spectralB}, 0.95) 0.5%`,
        `rgba(${spectralR}, ${spectralG}, ${spectralB}, 0.85) 1%`,
        `rgba(${spectralR}, ${spectralG}, ${spectralB}, 0.75) 2%`,
        `rgba(${spectralR}, ${spectralG}, ${spectralB}, 0.5) 4%`,
        `rgba(${spectralR}, ${spectralG}, ${spectralB}, 0.3) 8%`,
        `rgba(${spectralR}, ${spectralG}, ${spectralB}, 0.15) 15%`,
        `rgba(${spectralR}, ${spectralG}, ${spectralB}, 0.08) 25%`,
        `rgba(${spectralR}, ${spectralG}, ${spectralB}, 0.03) 40%`,
        `transparent 80%`
    ].join(', ')}
    
    <div
        class="fixed inset-0 bg-black z-50 pointer-events-none reveal-mask"
        style="--reveal-progress: {revealProgress}; --reveal-opacity: {1 - revealProgress};"
    ></div>
    
    <div
        class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
    >
        <div 
            class="w-64 h-64 rounded-full {isFadingOut ? 'dot-fade-out' : 'dot-pulse'}"
            style="background: radial-gradient(circle, {gradientStops});"
        ></div>
    </div>
{/if}

<LimitedFunctionalityBanner />

<main class="">
    {#if isDashboardRoute}
        {@render children()}
    {:else}
        <PageTransition type="page" duration={350}>
            {@render children()}
        </PageTransition>
    {/if}
</main>

{#if !isHomepage}
    <BuildInfoBadge />
{/if}

<style>
    :global(html) {
        height: 100%;
        margin: 0;
        padding: 0;
    }

    :global(body) {
        height: 100%;
        min-height: 100%;
        overflow-x: hidden;
    }

    main {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 100vh;
    }

    .dot-pulse {
        animation: pulseGlow 3s ease-in-out infinite;
    }

    .dot-fade-out {
        animation: fadeOutSlow 3s ease-out forwards;
    }

    .reveal-mask {
        --max-radius: 150%;
        --current-radius: calc(var(--reveal-progress) * var(--max-radius));
        --blur-zone: 12%;
        --edge-start: calc(var(--current-radius) - var(--blur-zone));
        --edge-end: calc(var(--current-radius) + var(--blur-zone) * 0.2);
        opacity: var(--reveal-opacity, 1);
        mask-image: radial-gradient(
            circle at center,
            transparent 0%,
            transparent var(--edge-start),
            rgba(0, 0, 0, 0.05) calc(var(--edge-start) + var(--blur-zone) * 0.1),
            rgba(0, 0, 0, 0.15) calc(var(--edge-start) + var(--blur-zone) * 0.25),
            rgba(0, 0, 0, 0.3) calc(var(--edge-start) + var(--blur-zone) * 0.4),
            rgba(0, 0, 0, 0.5) calc(var(--edge-start) + var(--blur-zone) * 0.55),
            rgba(0, 0, 0, 0.7) calc(var(--edge-start) + var(--blur-zone) * 0.7),
            rgba(0, 0, 0, 0.85) calc(var(--edge-start) + var(--blur-zone) * 0.85),
            black var(--edge-end),
            black 100%
        );
        -webkit-mask-image: radial-gradient(
            circle at center,
            transparent 0%,
            transparent var(--edge-start),
            rgba(0, 0, 0, 0.05) calc(var(--edge-start) + var(--blur-zone) * 0.1),
            rgba(0, 0, 0, 0.15) calc(var(--edge-start) + var(--blur-zone) * 0.25),
            rgba(0, 0, 0, 0.3) calc(var(--edge-start) + var(--blur-zone) * 0.4),
            rgba(0, 0, 0, 0.5) calc(var(--edge-start) + var(--blur-zone) * 0.55),
            rgba(0, 0, 0, 0.7) calc(var(--edge-start) + var(--blur-zone) * 0.7),
            rgba(0, 0, 0, 0.85) calc(var(--edge-start) + var(--blur-zone) * 0.85),
            black var(--edge-end),
            black 100%
        );
    }

    @keyframes pulseGlow {
        0%, 100% {
            transform: scale(1);
            opacity: 1;
            filter: brightness(1);
        }
        50% {
            transform: scale(1.6);
            opacity: 0.9;
            filter: brightness(1.3);
        }
    }

    @keyframes fadeOutSlow {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
</style>

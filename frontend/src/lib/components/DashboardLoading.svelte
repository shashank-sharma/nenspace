<script lang="ts">
    import { authService } from "$lib/services/authService.svelte";
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import { RealtimeService } from "$lib/services/realtime.service.svelte";
    import { HealthService } from "$lib/services/health.service.svelte";
    import { onMount, onDestroy } from "svelte";
    import { fade } from "svelte/transition";
    import { animate } from "animejs";
    import type { Snippet } from "svelte";
    import Logo from "$lib/components/Logo.svelte";

    interface LoadingStep {
        id: string;
        label: string;
        status: "pending" | "loading" | "success" | "error";
        error?: string;
    }

    let { children } = $props<{ children: Snippet }>();

    const TESTING_MODE = false;
    const TESTING_DELAY = 100000;
    const NORMAL_DELAY = 300;

    let steps = $state<LoadingStep[]>([
        { id: "auth", label: "Checking authentication...", status: "pending" },
        { id: "settings", label: "Loading user settings...", status: "pending" },
        { id: "apply-settings", label: "Applying settings (theme, font)...", status: "pending" },
        { id: "realtime", label: "Initializing realtime service...", status: "pending" },
        { id: "health", label: "Checking backend health...", status: "pending" },
        { id: "complete", label: "Finalizing...", status: "pending" },
    ]);

    let progress = $state(0);
    let isComplete = $state(false);
    let glitch = $state(false);
    let glitchInterval: ReturnType<typeof setInterval> | null = null;
    let containerElement: HTMLDivElement;
    let progressBarElement: HTMLDivElement;
    let progressCircleElement: SVGCircleElement;
    let logContainerElement: HTMLDivElement;
    let previousProgress = 0;

    function updateStep(id: string, status: LoadingStep["status"], error?: string) {
        const step = steps.find((s) => s.id === id);
        if (step) {
            step.status = status;
            if (error) step.error = error;
        }

        const completedSteps = steps.filter(
            (s) => s.status === "success" || s.status === "error"
        ).length;
        progress = Math.round((completedSteps / steps.length) * 100);
    }

    function getCurrentStatusMessage(): string {
        const loadingStep = steps.find((s) => s.status === "loading");
        if (loadingStep) {
            return loadingStep.label.toUpperCase();
        }
        return "All done";
    }

    async function initializeDashboard() {
        const delay = TESTING_MODE ? TESTING_DELAY : NORMAL_DELAY;

        try {
            updateStep("auth", "loading");
            await new Promise((resolve) => setTimeout(resolve, delay));

            if (!authService.isAuthenticated) {
                updateStep("auth", "error", "User not authenticated");
                return;
            }
            updateStep("auth", "success");

            updateStep("settings", "loading");
            try {
                await SettingsService.ensureLoaded();
                await new Promise((resolve) => setTimeout(resolve, delay));
                updateStep("settings", "success");
            } catch (error) {
                const errorMsg =
                    error instanceof Error ? error.message : "Failed to load settings";
                updateStep("settings", "error", errorMsg);
            }

            updateStep("apply-settings", "loading");
            await new Promise((resolve) => setTimeout(resolve, delay));
            updateStep("apply-settings", "success");

            updateStep("realtime", "loading");
            try {
                await RealtimeService.initialize();
                await new Promise((resolve) => setTimeout(resolve, delay));
                updateStep("realtime", "success");
            } catch (error) {
                const errorMsg =
                    error instanceof Error
                        ? error.message
                        : "Failed to initialize realtime service";
                updateStep("realtime", "error", errorMsg);
            }

            updateStep("health", "loading");
            try {
                await new Promise((resolve) => setTimeout(resolve, delay));
                const healthStatus = HealthService.status;
                if (healthStatus.connected === false && healthStatus.error) {
                    updateStep("health", "error", healthStatus.error);
                } else {
                    updateStep("health", "success");
                }
            } catch (error) {
                const errorMsg =
                    error instanceof Error ? error.message : "Health check failed";
                updateStep("health", "error", errorMsg);
            }

            updateStep("complete", "loading");
            await new Promise((resolve) => setTimeout(resolve, delay));
            updateStep("complete", "success");
            progress = 100;

            await new Promise((resolve) => setTimeout(resolve, TESTING_MODE ? delay : 1000));
            isComplete = true;
        } catch (error) {
            console.error("[DashboardLoading] Initialization failed:", error);
            steps.forEach((step) => {
                if (step.status === "pending" || step.status === "loading") {
                    updateStep(
                        step.id,
                        "error",
                        error instanceof Error ? error.message : "Unknown error"
                    );
                }
            });
        }
    }

    function animateProgress() {
        if (progressBarElement && progress !== previousProgress) {
            animate(progressBarElement, {
                width: `${progress}%`,
                duration: 75,
                easing: "linear",
            });
        }
        if (progressCircleElement && progress !== previousProgress) {
            const circumference = 2 * Math.PI * 70;
            const offset = circumference - (progress / 100) * circumference;
            const currentOffset = progressCircleElement.getAttribute("stroke-dashoffset");
            animate(progressCircleElement, {
                strokeDashoffset: [currentOffset ? parseFloat(currentOffset) : circumference, offset],
                duration: 75,
                easing: "linear",
            });
        }
        previousProgress = progress;
    }

    function animateLogEntries() {
        if (logContainerElement) {
            const logItems = logContainerElement.querySelectorAll("[data-log-item]:not([data-animated])");
            if (logItems.length > 0) {
                Array.from(logItems).forEach((item, i) => {
                    item.setAttribute("data-animated", "true");
                    animate(item, {
                        opacity: [0, 1],
                        translateY: [10, 0],
                        duration: 400,
                        delay: i * 50,
                        easing: "easeOutCubic",
                    });
                });
            }
        }
    }

    onMount(() => {

        if (containerElement) {
            animate(containerElement, {
                opacity: [0, 1],
                duration: 400,
                easing: "easeOutCubic",
            });
        }

        setTimeout(() => {
            animateLogEntries();
        }, 100);

        initializeDashboard();

        glitchInterval = setInterval(() => {
            if (Math.random() > 0.9) {
                glitch = true;
                setTimeout(() => {
                    glitch = false;
                }, 150);
            }
        }, 500);
    });

    $effect(() => {
        animateProgress();
    });

    onDestroy(() => {
        if (glitchInterval) {
            clearInterval(glitchInterval);
        }
    });

</script>

{#if !isComplete}
    <div
        bind:this={containerElement}
        class="absolute inset-0 flex items-center justify-center z-50 bg-black"
    >
        <div class="relative flex flex-col items-center justify-center w-full max-w-lg">

            <div class="relative w-64 h-64 flex items-center justify-center">
                <Logo
                    size={256}
                    progress={progress}
                    progressCircleRef={(el) => { progressCircleElement = el; }}
                    animated={true}
                />
            </div>

            <div class="mt-12 w-full px-12 text-center space-y-4">

                <div class="h-6 overflow-hidden">
                    <p
                        class="font-mono text-xs tracking-[0.3em] text-white uppercase {glitch
                            ? 'opacity-50 blur-[1px]'
                            : 'opacity-100'}"
                    >
                        {'>'} {getCurrentStatusMessage()}
                    </p>
                </div>

                <div class="relative w-full h-[1px] bg-white/10 overflow-hidden">
                    <div
                        bind:this={progressBarElement}
                        class="absolute left-0 top-0 h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                        style="width: {progress}%"
                    ></div>
                </div>

                <div
                    class="flex justify-between text-[8px] font-mono text-white/30 uppercase tracking-widest"
                >
                    <span>Mem: {4096 + Math.floor(progress * 12)}MB</span>
                    <span>Threads: ACTIVE</span>
                </div>

                <div class="mt-8 w-full max-w-md px-4">
                    <div
                        bind:this={logContainerElement}
                        class="border border-white/10 rounded bg-black/20 p-4 max-h-48 overflow-y-auto"
                    >
                        <div class="space-y-1.5">
                            {#each steps as step (step.id)}
                                <div
                                    data-log-item
                                    class="flex items-start gap-2 text-[10px] font-mono {step.status ===
                                    "success"
                                        ? "text-green-400"
                                        : step.status === "error"
                                          ? "text-red-400"
                                          : step.status === "loading"
                                            ? "text-white"
                                            : "text-white/40"}"
                                >
                                    <span class="text-white/30">
                                        {step.status === "success"
                                            ? "[✓]"
                                            : step.status === "error"
                                              ? "[✗]"
                                              : step.status === "loading"
                                                ? "[→]"
                                                : "[ ]"}
                                    </span>
                                    <span class="flex-1">
                                        {step.label}
                                        {#if step.error}
                                            <span class="text-red-400 ml-2">- {step.error}</span>
                                        {/if}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div
            class="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_2px,2px_100%] opacity-20"
        ></div>
    </div>
{:else}
    <div transition:fade={{ duration: 300 }}>{@render children()}</div>
{/if}


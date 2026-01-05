<script lang="ts">
    import { Progress } from "$lib/components/ui/progress";
    import { authService } from "$lib/services/authService.svelte";
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import { RealtimeService } from "$lib/services/realtime.service.svelte";
    import { HealthService } from "$lib/services/health.service.svelte";
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";
    import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-svelte";
    import type { Snippet } from "svelte";

    interface LoadingStep {
        id: string;
        label: string;
        status: "pending" | "loading" | "success" | "error";
        error?: string;
    }

    let { children } = $props<{ children: Snippet }>();

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

    async function initializeDashboard() {
        try {

            updateStep("auth", "loading");
            await new Promise((resolve) => setTimeout(resolve, 300));

            if (!authService.isAuthenticated) {
                updateStep("auth", "error", "User not authenticated");

                return;
            }
            updateStep("auth", "success");

            updateStep("settings", "loading");
            try {
                await SettingsService.ensureLoaded();
                updateStep("settings", "success");
            } catch (error) {
                const errorMsg =
                    error instanceof Error ? error.message : "Failed to load settings";
                updateStep("settings", "error", errorMsg);

            }

            updateStep("apply-settings", "loading");
            await new Promise((resolve) => setTimeout(resolve, 200));

            updateStep("apply-settings", "success");

            updateStep("realtime", "loading");
            try {
                await RealtimeService.initialize();
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

                await new Promise((resolve) => setTimeout(resolve, 300));
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
            await new Promise((resolve) => setTimeout(resolve, 200));
            updateStep("complete", "success");
            progress = 100;

            await new Promise((resolve) => setTimeout(resolve, 1000));
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

    onMount(() => {
        initializeDashboard();
    });

    function getStepIcon(step: LoadingStep) {
        switch (step.status) {
            case "success":
                return CheckCircle2;
            case "error":
                return XCircle;
            case "loading":
                return Loader2;
            default:
                return AlertCircle;
        }
    }
</script>

{#if !isComplete}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-background"
        transition:fade={{ duration: 300 }}
    >
        <div class="w-full max-w-md px-6 space-y-8">

            <div class="text-center space-y-2">
                <h1 class="text-2xl font-bold">Loading Dashboard</h1>
                <p class="text-sm text-muted-foreground">
                    Initializing services and loading your preferences
                </p>
            </div>

            <div class="space-y-2">
                <Progress value={progress} class="h-2" />
                <div class="flex justify-between text-xs text-muted-foreground">
                    <span>{progress}%</span>
                    <span>
                        {steps.filter((s) => s.status === "success" || s.status === "error")
                            .length}
                        / {steps.length} steps
                    </span>
                </div>
            </div>

            <div class="space-y-1.5">
                <div class="text-xs font-medium text-muted-foreground mb-1.5">
                    Initialization Steps:
                </div>
                {#each steps as step (step.id)}
                    {@const Icon = getStepIcon(step)}
                    <div
                        class="flex items-start gap-2 p-1.5 rounded-md transition-colors {step.status ===
                        "loading"
                            ? "bg-muted"
                            : step.status === "success"
                              ? "bg-green-500/10"
                              : step.status === "error"
                                ? "bg-destructive/10"
                                : ""}"
                    >
                        <Icon
                            class="h-3.5 w-3.5 mt-0.5 flex-shrink-0 {step.status === "loading"
                                ? "animate-spin text-primary"
                                : step.status === "success"
                                  ? "text-green-500"
                                  : step.status === "error"
                                    ? "text-destructive"
                                    : "text-muted-foreground"}"
                        />
                        <div class="flex-1 min-w-0">
                            <div
                                class="text-xs {step.status === "error"
                                    ? "text-destructive"
                                    : step.status === "success"
                                      ? "text-green-600 dark:text-green-400"
                                      : ""}"
                            >
                                {step.label}
                            </div>
                            {#if step.error}
                                <div class="text-[10px] text-destructive mt-0.5">
                                    {step.error}
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </div>
{:else}
    <div transition:fade={{ duration: 300 }}>{@render children()}</div>
{/if}


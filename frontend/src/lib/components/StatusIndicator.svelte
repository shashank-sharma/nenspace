<script lang="ts">
    import { blur, draw } from "svelte/transition";
    import { spring, tweened } from "svelte/motion";
    import { Bell, MonitorDot, Circle, CheckCircle2 } from "lucide-svelte";
    import { onMount } from "svelte";

    // Play with Damping and Stiffness
    let x = spring(100, {
        stiffness: 0.05,
        damping: 0.25,
    });
    let y = spring(28);
    let rounded = tweened(20);
    let isHovered = false;
    let isTimeHovered = false;
    let text = "Ring";
    let showSuccess = false;

    let run: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;
    let isSvgRing = true;

    export let onStatusChange: (status: string) => void = () => {};

    onMount(() => {
        // Show success message on mount
        showSuccess = true;
        x.set(200);
        y.set(35);
        rounded.set(50);

        setTimeout(() => {
            showSuccess = false;
            originalSize();
        }, 3000);
    });

    let clickEffect = () => {
        if (run) clearInterval(run);
        if (timeoutId) clearTimeout(timeoutId);
        originalSize();
        text = "Ring";
        isSvgRing = true;
        isHovered = true;
        isTimeHovered = false;
        x.set(140);
        y.set(35);
        rounded.set(50);
        onStatusChange("ringing");

        run = setInterval(() => {
            isSvgRing = !isSvgRing;
            text = isSvgRing ? "Ring" : "Silent";
            isSvgRing ? x.set(140) : x.set(155);
        }, 1500);

        timeoutId = setTimeout(() => {
            clearInterval(run);
            originalSize();
            onStatusChange("idle");
        }, 10000);
    };

    let originalSize = () => {
        clearInterval(run);
        isTimeHovered = false;
        isHovered = false;
        x.set(100);
        y.set(28);
        rounded.set(20);
        onStatusChange("idle");
    };

    let timerSize = () => {
        clearInterval(run);
        isHovered = false;
        isTimeHovered = true;
        x.set(200);
        y.set(55);
        rounded.set(50);
        onStatusChange("timer");
    };
</script>

<div class="fixed top-4 left-1/2 -translate-x-1/2 z-50">
    <div
        class="bg-black shadow-lg"
        style="width: {$x}px; height:{$y}px; border-radius: {$rounded}px;"
    >
        {#if showSuccess}
            <div
                class="px-4 flex justify-between text-white items-center h-full"
                in:blur={{ amount: 15 }}
            >
                <div>
                    <CheckCircle2 size={16} class="text-green-500" />
                </div>
                <div class="text-xs font-medium text-white" in:blur>
                    Dashboard Loaded
                </div>
            </div>
        {:else if isHovered}
            <div
                class="px-4 flex justify-between text-white items-center h-full"
                in:blur={{ amount: 15 }}
            >
                <div>
                    <Bell size={16} class="text-white" />
                </div>
                {#key text}
                    <div
                        class="text-xs font-medium {isSvgRing
                            ? 'text-white'
                            : 'text-red-500'}"
                        in:blur
                    >
                        {text}
                    </div>
                {/key}
            </div>
        {:else if isTimeHovered}
            <div
                class="px-4 flex justify-between text-white items-center h-full"
                in:blur={{ amount: 2 }}
            >
                <div>
                    <MonitorDot size={22} class="text-white" />
                </div>
                {#key text}
                    <div class="text-sm font-medium text-white" in:blur>
                        Desktop
                    </div>
                {/key}
            </div>
        {:else}
            <div
                class="px-2 flex justify-between text-white items-center h-full"
                in:blur={{ amount: 2 }}
            >
                <div></div>
                {#key text}
                    <div in:blur>
                        <Circle size={16} class="text-white" />
                    </div>
                {/key}
            </div>
        {/if}
    </div>
</div>

<style>
    @keyframes bounce {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-5px);
        }
    }

    .animate-bounce {
        animation: bounce 1s ease infinite;
    }
</style>

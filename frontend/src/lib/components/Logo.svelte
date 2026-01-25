<script lang="ts">
    let {
        size = 32,
        className = "",
        progress,
        progressCircleRef,
        animated = true,
        solid = false,
    }: {
        size?: number;
        className?: string;
        progress?: number; // 0-100, if provided, shows dynamic progress
        progressCircleRef?: (el: SVGCircleElement) => void; // Callback for progress circle element
        animated?: boolean; // Whether to show animations (default: true)
        solid?: boolean; // Whether to show solid white colors without opacity (default: false)
    } = $props();

    let progressCircleElement: SVGCircleElement;

    // Use same CSS classes for all sizes (loaderSize as preferred)

    // SVG circle properties - match inner circle size
    const radius = 70;
    const circumference = 2 * Math.PI * radius;

    // Progress circle: dynamic if progress provided, static otherwise
    const strokeDashoffset =
        progress !== undefined
            ? circumference - (progress / 100) * circumference
            : circumference * 0.75; // Default static offset (~25% progress)

    // Call the callback when element is set
    $effect(() => {
        if (progressCircleElement && progressCircleRef) {
            progressCircleRef(progressCircleElement);
        }
    });
</script>

<div
    class="relative flex items-center justify-center {className}"
    style="width: {size}px; height: {size}px;"
>
    <!-- 1. Outer Static Bracket (Corner Markers) -->
    <div
        class="absolute inset-0 border opacity-100 rotate-45 {solid
            ? 'border-white border-1'
            : 'border-white/5'}"
    ></div>
    <div
        class="absolute border-l border-r {solid
            ? 'border-white border-1'
            : 'border-white/10'}"
        style="inset: 6.25%"
    ></div>

    <!-- 2. Rotating Solid Ring (Slow) -->
    <div
        class="absolute inset-0 rounded-full border {solid
            ? 'border-white border-1'
            : 'border-cyan-500/20'} {animated
            ? 'animate-[spin_10s_linear_infinite]'
            : ''}"
    ></div>

    <!-- 3. Reverse Rotating Ring (Fast) -->
    <div
        class="absolute rounded-full border-t border-b {solid
            ? 'border-white border-1'
            : 'border-white/30'} {animated
            ? 'animate-[spin_3s_linear_infinite_reverse]'
            : ''}"
        style="inset: 12.5%"
    ></div>

    <!-- 4. Progress Circle (SVG) -->
    <svg
        class="absolute inset-0 w-full h-full -rotate-90 {solid
            ? ''
            : 'drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]'}"
        viewBox="0 0 256 256"
    >
        <circle
            cx="147"
            cy="147"
            r="70"
            stroke="white"
            stroke-width={solid ? "4" : "2"}
            fill="transparent"
            stroke-opacity={solid ? "1" : "0.1"}
        />
        <circle
            bind:this={progressCircleElement}
            cx="147"
            cy="147"
            r={radius}
            stroke={solid ? "white" : "gray"}
            stroke-width={solid ? "4" : "2"}
            fill="transparent"
            stroke-dasharray={circumference}
            stroke-dashoffset={strokeDashoffset}
            stroke-linecap="round"
            class="transition-all duration-75 ease-linear"
        />
    </svg>
</div>

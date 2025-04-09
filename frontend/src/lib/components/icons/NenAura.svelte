<script lang="ts">
    import { onMount, afterUpdate } from "svelte";
    import { fade, crossfade } from "svelte/transition";
    import { tweened } from "svelte/motion";
    import { cubicOut } from "svelte/easing";

    export let color = "rgba(88, 28, 135, 0.8)"; // Default to a purple color
    export let size = 400;
    export let intensity = 0.7;
    export let pulseSpeed = 1;
    export let type = "enhancement"; // enhancement, transmutation, manipulation, conjuration, specialization, emission

    let mounted = false;
    let glowFilter: string;
    let previousType = type;
    let transitioning = false;

    $: baseGlowColor = (() => {
        switch (type.toLowerCase()) {
            case "enhancement":
                return "rgba(249, 115, 22, 0.8)"; // Orange
            case "transmutation":
                return "rgba(16, 185, 129, 0.8)"; // Emerald
            case "manipulation":
                return "rgba(14, 165, 233, 0.8)"; // Sky blue
            case "conjuration":
                return "rgba(168, 85, 247, 0.8)"; // Purple
            case "specialization":
                return "rgba(225, 29, 72, 0.8)"; // Red
            case "emission":
                return "rgba(250, 204, 21, 0.8)"; // Yellow
            default:
                return color;
        }
    })();

    $: actualColor = color === "rgba(88, 28, 135, 0.8)" ? baseGlowColor : color;

    // Handle transitions between types
    afterUpdate(() => {
        if (mounted && previousType !== type) {
            transitioning = true;
            setTimeout(() => {
                previousType = type;
                transitioning = false;
            }, 500); // Match with CSS transition duration
        }
    });

    onMount(() => {
        mounted = true;
        previousType = type;

        // Create unique filter ID to avoid conflicts with multiple instances
        const randomId = Math.random().toString(36).substring(2, 9);
        glowFilter = `nenAuraGlow_${randomId}`;
    });
</script>

{#if mounted}
    <div class="nen-aura-container" style="width: {size}px; height: {size}px;">
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            transition:fade={{ duration: 1000 }}
        >
            <defs>
                <filter
                    id={glowFilter}
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                >
                    <feGaussianBlur
                        in="SourceGraphic"
                        stdDeviation="4"
                        result="blur"
                    />
                    <feColorMatrix
                        in="blur"
                        mode="matrix"
                        values="
                    1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 18 -7"
                        result="glow"
                    />
                    <feBlend in="SourceGraphic" in2="glow" mode="screen" />
                </filter>
            </defs>

            <!-- Main Aura Shape -->
            <g class="aura-pulse" style="--pulse-speed: {pulseSpeed}s;">
                <!-- Outer aura -->
                <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={actualColor}
                    stroke-width="0.5"
                    stroke-opacity={intensity * 0.3}
                    filter={`url(#${glowFilter})`}
                    class="aura-outer"
                />

                <!-- Middle aura -->
                <circle
                    cx="50"
                    cy="50"
                    r="30"
                    fill="none"
                    stroke={actualColor}
                    stroke-width="1"
                    stroke-opacity={intensity * 0.5}
                    filter={`url(#${glowFilter})`}
                    class="aura-middle"
                />

                <!-- Inner aura -->
                <circle
                    cx="50"
                    cy="50"
                    r="20"
                    fill="none"
                    stroke={actualColor}
                    stroke-width="1.5"
                    stroke-opacity={intensity * 0.7}
                    filter={`url(#${glowFilter})`}
                    class="aura-inner"
                />

                <!-- Core aura glow -->
                <circle
                    cx="50"
                    cy="50"
                    r="10"
                    fill={actualColor}
                    fill-opacity={intensity * 0.3}
                    filter={`url(#${glowFilter})`}
                    class="aura-core"
                />

                <!-- Aura particles - with transitions -->
                <g class="aura-type-specific">
                    {#key type}
                        <g
                            in:fade={{ duration: 700 }}
                            out:fade={{ duration: 300 }}
                        >
                            {#if type === "emission"}
                                <!-- Emission-specific particles that float away -->
                                {#each Array(12) as _, i}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="2"
                                        fill={actualColor}
                                        class="emission-particle"
                                        style="--delay: {i *
                                            0.5}s; --angle: {i * 30}deg;"
                                    />
                                {/each}
                            {:else if type === "transmutation"}
                                <!-- Transmutation fluid-like effect -->
                                <path
                                    d="M50,40 Q60,50 50,60 Q40,50 50,40 Z"
                                    fill="none"
                                    stroke={actualColor}
                                    stroke-width="1.5"
                                    class="transmutation-flow"
                                />
                            {:else if type === "conjuration"}
                                <!-- Conjuration materialization effect -->
                                <rect
                                    x="40"
                                    y="40"
                                    width="20"
                                    height="20"
                                    fill="none"
                                    stroke={actualColor}
                                    stroke-width="1"
                                    class="conjuration-form"
                                />
                            {:else if type === "manipulation"}
                                <!-- Manipulation control strands -->
                                {#each Array(6) as _, i}
                                    <line
                                        x1="50"
                                        y1="50"
                                        x2={50 +
                                            30 * Math.cos((i * Math.PI) / 3)}
                                        y2={50 +
                                            30 * Math.sin((i * Math.PI) / 3)}
                                        stroke={actualColor}
                                        stroke-width="0.5"
                                        class="manipulation-strand"
                                        style="--delay: {i * 0.2}s;"
                                    />
                                {/each}
                            {:else if type === "enhancement"}
                                <!-- Simple Enhancement shape - just a solid circle -->
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="20"
                                    fill={actualColor}
                                    fill-opacity="0.6"
                                    class="enhancement-solid"
                                />
                            {:else if type === "specialization"}
                                <!-- Specialization effect (mixed abilities) -->
                                <path
                                    d="M50,30 L60,45 L50,60 L40,45 Z"
                                    fill="none"
                                    stroke={actualColor}
                                    stroke-width="1"
                                    class="specialization-shape"
                                />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="15"
                                    fill="none"
                                    stroke={actualColor}
                                    stroke-width="0.7"
                                    stroke-dasharray="3,3"
                                    class="specialization-circle"
                                />
                            {/if}
                        </g>
                    {/key}
                </g>
            </g>
        </svg>
    </div>
{/if}

<style>
    .nen-aura-container {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: none;
        transform-origin: center;
    }

    .aura-pulse {
        animation: pulse var(--pulse-speed, 3s) infinite ease-in-out;
    }

    .aura-type-specific {
        transform-origin: center;
        will-change: opacity;
    }

    @keyframes pulse {
        0% {
            transform: scale(0.95);
            opacity: 0.7;
        }
        50% {
            transform: scale(1.05);
            opacity: 1;
        }
        100% {
            transform: scale(0.95);
            opacity: 0.7;
        }
    }

    .aura-outer {
        animation: rotate 20s infinite linear;
        transition: stroke 0.7s ease-in-out;
    }

    .aura-middle {
        animation: rotate 15s infinite linear reverse;
        transition: stroke 0.7s ease-in-out;
    }

    .aura-inner {
        animation: rotate 10s infinite linear;
        transition: stroke 0.7s ease-in-out;
    }

    .aura-core {
        animation: glow 3s infinite alternate ease-in-out;
        transition: fill 0.7s ease-in-out;
    }

    @keyframes rotate {
        from {
            transform: rotate(0deg) translateX(0) rotate(0deg);
        }
        to {
            transform: rotate(360deg) translateX(0) rotate(-360deg);
        }
    }

    @keyframes glow {
        0% {
            opacity: 0.3;
        }
        100% {
            opacity: 0.8;
        }
    }

    /* Emission particles animation */
    .emission-particle {
        animation: emit 3s infinite both;
        animation-delay: var(--delay, 0s);
        transform-origin: center;
        transform: translateX(0) translateY(0);
        transition: fill 0.7s ease-in-out;
    }

    @keyframes emit {
        0% {
            transform: rotate(var(--angle, 0deg)) translateX(10px);
            opacity: 1;
        }
        100% {
            transform: rotate(var(--angle, 0deg)) translateX(45px);
            opacity: 0;
        }
    }

    /* Transmutation animation */
    .transmutation-flow {
        animation: morph 4s infinite alternate ease-in-out;
        transition:
            stroke 0.7s ease-in-out,
            d 0.7s ease-in-out;
    }

    @keyframes morph {
        0% {
            d: path("M50,40 Q60,50 50,60 Q40,50 50,40 Z");
        }
        50% {
            d: path("M50,40 Q65,45 50,60 Q35,45 50,40 Z");
        }
        100% {
            d: path("M50,40 Q55,60 50,60 Q45,60 50,40 Z");
        }
    }

    /* Conjuration animation */
    .conjuration-form {
        animation: materialize 3s infinite alternate ease-in-out;
        transition: stroke 0.7s ease-in-out;
    }

    @keyframes materialize {
        0% {
            opacity: 0.2;
            stroke-dasharray: 5, 5;
        }
        50% {
            opacity: 0.8;
            stroke-dasharray: 10, 0;
        }
        100% {
            opacity: 0.2;
            stroke-dasharray: 5, 5;
        }
    }

    /* Manipulation animation */
    .manipulation-strand {
        animation: pulse-strand 2s infinite alternate ease-in-out;
        animation-delay: var(--delay, 0s);
        stroke-dasharray: 2, 2;
        transition: stroke 0.7s ease-in-out;
    }

    @keyframes pulse-strand {
        0% {
            stroke-dashoffset: 0;
        }
        100% {
            stroke-dashoffset: 10;
        }
    }

    /* Enhancement animation */
    .enhancement-container {
        transform-origin: center;
    }

    .enhancement-core {
        animation: enhancement-pulse 2s infinite alternate ease-in-out;
    }

    .enhancement-line {
        animation: enhancement-line-pulse 1.5s infinite alternate ease-in-out;
        transform-origin: 50px 50px;
    }

    @keyframes enhancement-pulse {
        0% {
            stroke-width: 2;
            stroke-opacity: 0.6;
        }
        100% {
            stroke-width: 4;
            stroke-opacity: 1;
        }
    }

    @keyframes enhancement-line-pulse {
        0% {
            stroke-width: 1.5;
            stroke-opacity: 0.5;
        }
        100% {
            stroke-width: 3;
            stroke-opacity: 0.9;
        }
    }

    /* Specialization animation */
    .specialization-shape {
        animation: rotate 7s infinite linear;
    }

    .specialization-circle {
        animation: rotate 10s infinite linear reverse;
    }

    /* Enhancement animation */
    .enhancement-solid {
        animation: enhancement-solid-pulse 2s infinite alternate ease-in-out;
        filter: url(#glowFilter);
    }

    @keyframes enhancement-solid-pulse {
        0% {
            r: 18;
            fill-opacity: 0.5;
        }
        100% {
            r: 22;
            fill-opacity: 0.7;
        }
    }
</style>

<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ShimmerProps = HTMLAttributes<HTMLElement> & {
		children?: Snippet;
		content_length?: number;
		as?: keyof HTMLElementTagNameMap;
		duration?: number;
		spread?: number;
	};

	let {
		children,
		content_length = 30,
		as = "p",
		duration = 2,
		spread = 2,
		class: className,
		...restProps
	}: ShimmerProps = $props();

	// Calculate shimmer width based on content length
	let shimmerSpread = $derived(content_length * spread);

	let shimmerStyle = $derived(
		`
		background: linear-gradient(
			90deg,
			transparent 0%,
			transparent 40%,
			rgba(var(--shimmer-color, 255 255 255) / 0.6) 50%,
			transparent 60%,
			transparent 100%
		);
		background-size: ${shimmerSpread}% 100%;
		background-position: -${shimmerSpread}% 0;
		animation: shimmer ${duration}s infinite;
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		`
	);

	let elementClasses = $derived(cn("inline-block", className));
</script>

<svelte:element this={as} class={elementClasses} style={shimmerStyle} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</svelte:element>

<style>
	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	:global(.dark) :where(*) {
		--shimmer-color: 255 255 255;
	}

	:global(:not(.dark)) :where(*) {
		--shimmer-color: 0 0 0;
	}
</style>

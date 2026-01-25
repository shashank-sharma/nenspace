<script lang="ts">
	import * as Carousel from "$lib/components/ui/carousel";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		opts?: any;
		plugins?: any[];
		orientation?: "horizontal" | "vertical";
		children?: Snippet;
	};

	let {
		class: className,
		opts,
		plugins,
		orientation = "horizontal",
		children
	}: Props = $props();
</script>

<Carousel.Root {opts} {plugins} {orientation} class={cn("w-full", className)}>
	{#if children}
		{@render children()}
	{/if}
</Carousel.Root>

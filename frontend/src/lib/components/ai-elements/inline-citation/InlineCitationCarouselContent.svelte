<script lang="ts">
	import * as Carousel from "$lib/components/ui/carousel";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<Carousel.Content class={cn("", className)}>
	{#if children}
		{@render children()}
	{/if}
</Carousel.Content>

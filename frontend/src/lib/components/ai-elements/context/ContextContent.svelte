<script lang="ts">
	import * as HoverCard from "$lib/components/ui/hover-card";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		children?: Snippet;
		class?: string;
	};

	let { children, class: className }: Props = $props();
</script>

<HoverCard.Content class={cn("w-80", className)}>
	{#if children}
		{@render children()}
	{/if}
</HoverCard.Content>

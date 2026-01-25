<script lang="ts">
	import * as HoverCard from "$lib/components/ui/hover-card";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<HoverCard.Content class={cn("w-96", className)}>
	{#if children}
		{@render children()}
	{/if}
</HoverCard.Content>

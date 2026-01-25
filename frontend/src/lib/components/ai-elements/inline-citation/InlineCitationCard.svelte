<script lang="ts">
	import * as HoverCard from "$lib/components/ui/hover-card";
	import type { Snippet } from "svelte";

	type Props = {
		closeDelay?: number;
		openDelay?: number;
		open?: boolean;
		children?: Snippet;
	};

	let { closeDelay = 0, openDelay = 0, open = $bindable(false), children }: Props = $props();
</script>

<HoverCard.Root {closeDelay} {openDelay} bind:open>
	{#if children}
		{@render children()}
	{/if}
</HoverCard.Root>

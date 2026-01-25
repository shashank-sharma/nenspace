<script lang="ts">
	import * as Card from "$lib/components/ui/card";
	import { Shimmer } from "$lib/components/ai-elements/shimmer";
	import { getPlanState } from "./plan-context.svelte.ts";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();

	const planState = getPlanState();
</script>

<Card.Title class={cn("", className)}>
	{#if planState.isStreaming}
		<Shimmer>
			{#if children}
				{@render children()}
			{/if}
		</Shimmer>
	{:else if children}
		{@render children()}
	{/if}
</Card.Title>

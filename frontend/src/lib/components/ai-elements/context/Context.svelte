<script lang="ts">
	import * as HoverCard from "$lib/components/ui/hover-card";
	import { setContextState, type LanguageModelUsage } from "./context.svelte.ts";
	import type { Snippet } from "svelte";

	type Props = {
		usedTokens: number;
		maxTokens: number;
		usage?: LanguageModelUsage;
		modelId?: string;
		closeDelay?: number;
		openDelay?: number;
		children?: Snippet;
	};

	let {
		usedTokens,
		maxTokens,
		usage,
		modelId,
		closeDelay = 0,
		openDelay = 0,
		children
	}: Props = $props();

	setContextState({ usedTokens, maxTokens, usage, modelId });
</script>

<HoverCard.Root {closeDelay} {openDelay}>
	{#if children}
		{@render children()}
	{/if}
</HoverCard.Root>

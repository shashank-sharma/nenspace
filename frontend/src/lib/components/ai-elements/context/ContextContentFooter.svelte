<script lang="ts">
	import { getContextState } from "./context.svelte.ts";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		children?: Snippet;
		class?: string;
	};

	let { children, class: className }: Props = $props();

	const contextState = getContextState();

	// Simple cost estimation (example rates, adjust as needed)
	const estimatedCost = $derived(() => {
		if (!contextState.usage) return 0;
		// Example: $0.01 per 1K input tokens, $0.03 per 1K output tokens
		const inputCost = (contextState.usage.promptTokens / 1000) * 0.01;
		const outputCost = (contextState.usage.completionTokens / 1000) * 0.03;
		return inputCost + outputCost;
	});
</script>

<div class={cn("pt-2 border-t", className)}>
	{#if children}
		{@render children()}
	{:else}
		<p class="text-xs text-muted-foreground">
			Estimated cost: ${estimatedCost().toFixed(4)}
		</p>
	{/if}
</div>

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
	const percentage = $derived(
		contextState.maxTokens > 0
			? ((contextState.usedTokens / contextState.maxTokens) * 100).toFixed(1)
			: "0.0"
	);
</script>

<div class={cn("space-y-2", className)}>
	{#if children}
		{@render children()}
	{:else}
		<div class="flex items-center justify-between">
			<h4 class="text-sm font-semibold">Context Window</h4>
			<span class="text-sm font-medium">{percentage}%</span>
		</div>
		<p class="text-sm text-muted-foreground">
			{contextState.usedTokens.toLocaleString()} / {contextState.maxTokens.toLocaleString()} tokens
		</p>
	{/if}
</div>

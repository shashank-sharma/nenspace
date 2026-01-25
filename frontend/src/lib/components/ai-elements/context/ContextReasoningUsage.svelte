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
	const reasoningTokens = $derived(contextState.usage?.reasoningTokens ?? 0);
</script>

{#if reasoningTokens > 0}
	<div class={cn("flex items-center justify-between text-sm", className)}>
		{#if children}
			{@render children()}
		{:else}
			<span class="text-muted-foreground">Reasoning</span>
			<span class="font-medium">{reasoningTokens.toLocaleString()}</span>
		{/if}
	</div>
{/if}
